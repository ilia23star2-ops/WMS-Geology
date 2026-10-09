"""
ViewSets приложения labels.
"""

from django.db import transaction
from django.db.models import Max
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PrintBatch, PrintBatchItem
from .serializers import AddContainersSerializer, PrintBatchSerializer
from .services.print_batch_service import generate_batch_number


class PrintBatchViewSet(viewsets.ModelViewSet):
    """
    CRUD для партий печати (корзины этикеток).

    Особенности:
    - `PUT` и `DELETE` запрещены: только `GET/POST/PATCH`.
      Отмена — через action `cancel` (soft: статус CANCELLED).
    - Номер партии генерируется автоматически.
    - Изменять (PATCH) и наполнять можно только черновик.

    Custom actions:
    - POST /print-batches/{id}/add-containers/
    - POST /print-batches/{id}/remove-container/
    - POST /print-batches/{id}/mark-ready/
    - POST /print-batches/{id}/cancel/
    """

    serializer_class = PrintBatchSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = (
            PrintBatch.objects
            .select_related("created_by", "printed_by")
            .prefetch_related("items__container")
            .all()
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("print_type"):
            qs = qs.filter(print_type=p["print_type"])
        return qs

    def perform_create(self, serializer):
        serializer.save(
            batch_number=generate_batch_number(),
            created_by=self.request.user,
        )

    def update(self, request, *args, **kwargs):
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Изменять можно только партию в статусе «Черновик»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    # ------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="add-containers")
    def add_containers(self, request, pk=None):
        """Добавляет список тар в корзину. Только для черновика."""
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Добавлять тары можно только в черновик."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = AddContainersSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        container_ids = ser.validated_data["container_ids"]

        already = set(
            PrintBatchItem.objects
            .filter(batch=batch, container_id__in=container_ids)
            .values_list("container_id", flat=True)
        )
        if already:
            return Response(
                {"error": f"Уже в партии: {sorted(already)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_pos = (
            PrintBatchItem.objects
            .filter(batch=batch)
            .aggregate(m=Max("position"))["m"]
        ) or 0

        with transaction.atomic():
            for offset, cid in enumerate(container_ids, start=1):
                PrintBatchItem.objects.create(
                    batch=batch,
                    container_id=cid,
                    position=max_pos + offset,
                )
            self._refresh_totals(batch)

        # Перечитываем партию, чтобы prefetch-кэш отдал актуальный items.
        batch = self.get_queryset().get(pk=batch.pk)
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    @action(detail=True, methods=["post"], url_path="remove-container")
    def remove_container(self, request, pk=None):
        """Убирает одну тару из корзины. Только для черновика."""
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Убирать тары можно только из черновика."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        container_id = request.data.get("container_id")
        if not container_id:
            return Response(
                {"error": "Поле container_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = (
            PrintBatchItem.objects
            .filter(batch=batch, container_id=container_id)
            .delete()
        )
        if not deleted:
            return Response(
                {"error": "Тара не найдена в партии."},
                status=status.HTTP_404_NOT_FOUND,
            )

        self._refresh_totals(batch)

        # Перечитываем партию, чтобы prefetch-кэш отдал актуальный items.
        batch = self.get_queryset().get(pk=batch.pk)
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    @action(detail=True, methods=["post"], url_path="mark-ready")
    def mark_ready(self, request, pk=None):
        """Переводит партию из DRAFT в READY. Требует непустую корзину."""
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Перевести в READY можно только черновик."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not PrintBatchItem.objects.filter(batch=batch).exists():
            return Response(
                {"error": "Партия пуста — нечего печатать."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch.status = PrintBatch.STATUS_READY
        batch.save(update_fields=["status", "updated_at"])
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Отменяет партию (soft-delete). Нельзя отменить напечатанную."""
        batch = self.get_object()
        if batch.status in (
            PrintBatch.STATUS_PRINTED,
            PrintBatch.STATUS_CANCELLED,
        ):
            return Response(
                {"error": f"Нельзя отменить партию в статусе {batch.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch.status = PrintBatch.STATUS_CANCELLED
        batch.save(update_fields=["status", "updated_at"])
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    # ------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------
    @staticmethod
    def _refresh_totals(batch: PrintBatch) -> None:
        """
        Пересчитывает `total_items` и сохраняет партию.

        Считает через явный queryset, а не через `batch.items.count()`:
        у prefetch-кэша значение устаревает после создания/удаления
        элементов партии.
        """
        batch.total_items = (
            PrintBatchItem.objects.filter(batch=batch).count()
        )
        batch.save(update_fields=["total_items", "updated_at"])