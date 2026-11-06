"""
ViewSets приложения picking (v4).

PickList: CRUD + custom actions activate, complete.
PickListItem: CRUD + custom action pick.
Shipment: CRUD + custom actions add-from-pick-list, add-containers,
          remove-container, assemble, send, cancel (c-2.x-shipments-1).
ShipmentItem: CRUD.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.samples.services import sync_sample_status_for_container
from apps.storage.models import Container

from .models import (
    PickList,
    PickListItem,
    Shipment,
    ShipmentContainerItem,
    ShipmentItem,
)
from .serializers import (
    PickListItemSerializer,
    PickListSerializer,
    ShipmentItemSerializer,
    ShipmentSerializer,
)


class PickListViewSet(viewsets.ModelViewSet):
    """CRUD для списков выборки. Фильтр: ?status="""

    serializer_class = PickListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PickList.objects.select_related("created_by").all()
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        pl = self.get_object()
        if pl.status != PickList.STATUS_DRAFT:
            return Response(
                {"error": "Активировать можно только черновик."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pl.status = PickList.STATUS_ACTIVE
        pl.save(update_fields=["status"])
        return Response(PickListSerializer(pl).data)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        pl = self.get_object()
        if pl.status != PickList.STATUS_ACTIVE:
            return Response(
                {"error": "Завершить можно только активный список."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        pl.status = PickList.STATUS_COMPLETED
        pl.completed_at = timezone.now()
        pl.save(update_fields=["status", "completed_at"])
        return Response(PickListSerializer(pl).data)


class PickListItemViewSet(viewsets.ModelViewSet):
    """CRUD для строк выборки. Фильтры: ?pick_list_id=, ?status="""

    serializer_class = PickListItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = PickListItem.objects.select_related(
            "pick_list", "sample", "picked_by",
        ).all()
        pick_list_id = self.request.query_params.get("pick_list_id")
        if pick_list_id:
            qs = qs.filter(pick_list_id=pick_list_id)
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs

    @action(detail=True, methods=["post"])
    def pick(self, request, pk=None):
        item = self.get_object()
        if item.status != PickListItem.STATUS_PENDING:
            return Response(
                {"error": "Извлечь можно только строку со статусом PENDING."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        item.status = PickListItem.STATUS_PICKED
        item.picked_at = timezone.now()
        item.picked_by = request.user
        item.save(update_fields=["status", "picked_at", "picked_by"])
        return Response(PickListItemSerializer(item).data)


class ShipmentViewSet(viewsets.ModelViewSet):
    """
    CRUD для отправок (рейсов).

    Фильтры: ?direction=, ?status=, ?laboratory_id=, ?site_id=

    Custom actions:
      - POST /shipments/{id}/add-from-pick-list/
      - POST /shipments/{id}/add-containers/    (c-2.x-shipments-1, OUTBOUND)
      - POST /shipments/{id}/remove-container/  (c-2.x-shipments-1, OUTBOUND)
      - POST /shipments/{id}/assemble/ — DRAFT → ASSEMBLED
      - POST /shipments/{id}/send/     — DRAFT/ASSEMBLED → SENT (c-2.x-shipments-1)
      - POST /shipments/{id}/cancel/   — отмена (до RECEIVED)
    """

    serializer_class = ShipmentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Shipment.objects.select_related(
            "sent_by", "laboratory", "site", "cancelled_by",
        ).prefetch_related("container_items__container__container_type").all()
        p = self.request.query_params

        if p.get("direction"):
            qs = qs.filter(direction=p["direction"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("laboratory_id"):
            qs = qs.filter(laboratory_id=p["laboratory_id"])
        if p.get("site_id"):
            qs = qs.filter(site_id=p["site_id"])

        return qs

    def perform_create(self, serializer):
        shipment_number = (
            serializer.validated_data.get("shipment_number") or ""
        ).strip()
        if not shipment_number:
            direction = serializer.validated_data.get(
                "direction", Shipment.DIRECTION_OUTBOUND,
            )
            shipment_number = self._generate_shipment_number(direction)
        serializer.save(
            shipment_number=shipment_number,
            sent_by=self.request.user,
        )

    @staticmethod
    def _generate_shipment_number(direction: str) -> str:
        """
        Автогенерация номера рейса (c-2.x-shipments-1a).

        OUTBOUND: ОТ-YYYY-NNN.
        INBOUND:  ПР-YYYY-NNN.

        Race condition: при параллельном создании двух рейсов
        возможен одинаковый номер → IntegrityError. Ретрай
        не реализован; при необходимости — повторная генерация
        с +1 в цикле.
        """
        prefix = (
            "ОТ"
            if direction == Shipment.DIRECTION_OUTBOUND
            else "ПР"
        )
        year = timezone.now().year
        last = (
            Shipment.objects
            .filter(shipment_number__startswith=f"{prefix}-{year}-")
            .order_by("-shipment_number")
            .first()
        )
        if last:
            try:
                last_n = int(last.shipment_number.rsplit("-", 1)[-1])
            except (ValueError, IndexError):
                last_n = 0
        else:
            last_n = 0
        return f"{prefix}-{year}-{last_n + 1:03d}"

    @action(detail=True, methods=["post"], url_path="add-from-pick-list")
    def add_from_pick_list(self, request, pk=None):
        shipment = self.get_object()
        pick_list_id = request.data.get("pick_list_id")
        if not pick_list_id:
            return Response(
                {"error": "Поле `pick_list_id` обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            pick_list = PickList.objects.get(pk=pick_list_id)
        except PickList.DoesNotExist:
            return Response(
                {"error": "PickList не найден."},
                status=status.HTTP_404_NOT_FOUND,
            )

        items_to_send = PickListItem.objects.filter(
            pick_list=pick_list, status=PickListItem.STATUS_PICKED,
        )
        if not items_to_send.exists():
            return Response(
                {"error": "Нет строк со статусом PICKED в этом списке."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        added = 0
        with transaction.atomic():
            for pli in items_to_send:
                _, created = ShipmentItem.objects.get_or_create(
                    shipment=shipment,
                    sample=pli.sample,
                    defaults={"pick_list_item": pli},
                )
                if created:
                    added += 1
                pli.status = PickListItem.STATUS_SENT
                pli.save(update_fields=["status"])

        return Response(
            {
                "shipment": ShipmentSerializer(shipment).data,
                "added_count": added,
            }
        )

    @action(detail=True, methods=["post"], url_path="add-containers")
    def add_containers(self, request, pk=None):
        """
        Добавить тары в рейс (c-2.x-shipments-1).

        Body: `{"container_ids": [1, 2, 3]}`.
        Только для OUTBOUND и статуса DRAFT/ASSEMBLED.
        """
        shipment = self.get_object()
        if shipment.direction != Shipment.DIRECTION_OUTBOUND:
            return Response(
                {"error": "Только для OUTBOUND."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if shipment.status not in (
            Shipment.STATUS_DRAFT,
            Shipment.STATUS_ASSEMBLED,
        ):
            return Response(
                {"error": "Добавлять тары можно только в DRAFT или ASSEMBLED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        container_ids = request.data.get("container_ids") or []
        if not container_ids:
            return Response(
                {"error": "Поле `container_ids` обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        containers = Container.objects.filter(id__in=container_ids)
        found_ids = set(containers.values_list("id", flat=True))
        missing = set(container_ids) - found_ids
        if missing:
            return Response(
                {"error": f"Тары не найдены: {sorted(missing)}"},
                status=status.HTTP_404_NOT_FOUND,
            )

        added = 0
        with transaction.atomic():
            for c in containers:
                _, created = ShipmentContainerItem.objects.get_or_create(
                    shipment=shipment,
                    container=c,
                )
                if created:
                    added += 1

        return Response(
            {
                "shipment": ShipmentSerializer(shipment).data,
                "added_count": added,
            }
        )

    @action(detail=True, methods=["post"], url_path="remove-container")
    def remove_container(self, request, pk=None):
        """
        Убрать тару из рейса (c-2.x-shipments-1).

        Body: `{"container_id": X}`. Только в DRAFT/ASSEMBLED.
        """
        shipment = self.get_object()
        if shipment.status not in (
            Shipment.STATUS_DRAFT,
            Shipment.STATUS_ASSEMBLED,
        ):
            return Response(
                {"error": "Удалять тары можно только в DRAFT или ASSEMBLED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        container_id = request.data.get("container_id")
        if not container_id:
            return Response(
                {"error": "Поле `container_id` обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = ShipmentContainerItem.objects.filter(
            shipment=shipment, container_id=container_id,
        ).delete()

        return Response(
            {
                "shipment": ShipmentSerializer(shipment).data,
                "removed": deleted > 0,
            }
        )

    @action(detail=True, methods=["post"])
    def assemble(self, request, pk=None):
        """DRAFT → ASSEMBLED."""
        shipment = self.get_object()
        if shipment.status != Shipment.STATUS_DRAFT:
            return Response(
                {"error": "Собрать можно только черновик."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        shipment.status = Shipment.STATUS_ASSEMBLED
        shipment.assembled_at = timezone.now()
        shipment.save(update_fields=["status", "assembled_at"])
        return Response(ShipmentSerializer(shipment).data)

    @action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        """
        Отправить рейс (c-2.x-shipments-1).

        DRAFT/ASSEMBLED → SENT. Все тары рейса → `IN_TRANSIT`,
        пробы внутри — синхронизируются (решение 1.110).
        """
        shipment = self.get_object()
        if shipment.status not in (
            Shipment.STATUS_DRAFT,
            Shipment.STATUS_ASSEMBLED,
        ):
            return Response(
                {"error": "Отправить можно только DRAFT или ASSEMBLED."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        container_items = list(shipment.container_items.select_related(
            "container",
        ).all())
        if not container_items:
            return Response(
                {"error": "В рейсе нет тар."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            shipment.status = Shipment.STATUS_SENT
            shipment.sent_at = timezone.now()
            shipment.save(update_fields=["status", "sent_at"])

            for item in container_items:
                container = item.container
                container.status = "IN_TRANSIT"
                container.save(update_fields=["status"])
                sync_sample_status_for_container(container)

        return Response(ShipmentSerializer(shipment).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Отменить отправку (до RECEIVED)."""
        shipment = self.get_object()
        if shipment.status in (
            Shipment.STATUS_RECEIVED,
            Shipment.STATUS_PARTIALLY_RECEIVED,
            Shipment.STATUS_CANCELLED,
        ):
            return Response(
                {"error": "Нельзя отменить эту отправку в текущем статусе."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        reason = request.data.get("reason", "").strip()
        shipment.status = Shipment.STATUS_CANCELLED
        shipment.cancelled_at = timezone.now()
        shipment.cancelled_by = request.user
        if reason:
            shipment.cancel_reason = reason
        shipment.save(update_fields=[
            "status", "cancelled_at", "cancelled_by", "cancel_reason",
        ])
        return Response(ShipmentSerializer(shipment).data)


class ShipmentItemViewSet(viewsets.ModelViewSet):
    """CRUD для строк отправки. Фильтры: ?shipment_id=, ?sample_id="""

    serializer_class = ShipmentItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ShipmentItem.objects.select_related(
            "shipment", "sample", "pick_list_item",
        ).all()
        shipment_id = self.request.query_params.get("shipment_id")
        if shipment_id:
            qs = qs.filter(shipment_id=shipment_id)
        sample_id = self.request.query_params.get("sample_id")
        if sample_id:
            qs = qs.filter(sample_id=sample_id)
        return qs