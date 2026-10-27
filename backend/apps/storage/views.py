"""
ViewSets приложения storage.
"""

from django.db import transaction
from django.db.models import ProtectedError
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.labels.services import render_container_label
from apps.samples.services import sync_sample_status_for_container

from .catalogs import ContainerComment
from .models import (
    Cell,
    Container,
    ContainerType,
    Pallet,
    Rack,
    Room,
    Section,
    Tier,
)
from .serializers import (
    BulkCreateSerializer,
    CellSerializer,
    ContainerCommentSerializer,
    ContainerSerializer,
    ContainerTypeSerializer,
    FillSamplesSerializer,
    PalletSerializer,
    RackSerializer,
    RoomSerializer,
    SectionSerializer,
    TierSerializer,
)
from .services import bulk_create_containers, fill_container_with_samples
from .services.qr_topology import render_topology_qr_pdf


def _section_address(section: Section) -> str:
    """Адрес секции: Комната / Стеллаж / Секция."""
    return (
        f"{section.rack.room.name} / {section.rack.code} / {section.code}"
    )


class ContainerCommentViewSet(viewsets.ModelViewSet):
    """CRUD для шаблонов комментариев. Фильтр: ?is_active="""

    serializer_class = ContainerCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ContainerComment.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs


class RoomViewSet(viewsets.ModelViewSet):
    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]


class RackViewSet(viewsets.ModelViewSet):
    """Фильтр: ?room_id="""

    serializer_class = RackSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Rack.objects.select_related("room").all()
        room_id = self.request.query_params.get("room_id")
        if room_id:
            qs = qs.filter(room_id=room_id)
        return qs


class SectionViewSet(viewsets.ModelViewSet):
    """Фильтр: ?rack_id=. QR: `.qr.pdf`, batch — `.qr-batch`."""

    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Section.objects.select_related("rack__room").all()
        rack_id = self.request.query_params.get("rack_id")
        if rack_id:
            qs = qs.filter(rack_id=rack_id)
        return qs

    @action(detail=True, methods=["get"], url_path="qr.pdf")
    def qr_pdf(self, request, pk=None):
        """PDF с QR-кодом одной секции."""
        section = self.get_object()
        buf = render_topology_qr_pdf([
            {
                "type": "SECTION",
                "id": section.pk,
                "address": _section_address(section),
            },
        ])
        return FileResponse(
            buf,
            as_attachment=False,
            filename=f"qr-section-{section.pk}.pdf",
            content_type="application/pdf",
        )

    @action(detail=False, methods=["post"], url_path="qr-batch")
    def qr_batch(self, request):
        """PDF с партией QR (Section + Cell)."""
        items = request.data.get("items")
        if not isinstance(items, list) or not items:
            return Response(
                {"error": "Поле `items` обязательно и не пусто."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        resolved = []
        for idx, item in enumerate(items):
            t = (item.get("type") or "").upper()
            i = item.get("id")
            if t == "SECTION":
                obj = Section.objects.select_related(
                    "rack__room",
                ).filter(pk=i).first()
                if obj is None:
                    return Response(
                        {"error": f"Секция #{i} не найдена (item #{idx})."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                resolved.append({
                    "type": "SECTION",
                    "id": obj.pk,
                    "address": _section_address(obj),
                })
            elif t == "CELL":
                obj = Cell.objects.filter(pk=i).first()
                if obj is None:
                    return Response(
                        {"error": f"Ячейка #{i} не найдена (item #{idx})."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
                resolved.append({
                    "type": "CELL",
                    "id": obj.pk,
                    "address": obj.full_address,
                })
            else:
                return Response(
                    {
                        "error": (
                            f"Неизвестный `type` «{t}» (item #{idx}). "
                            "Допустимые: SECTION, CELL."
                        ),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        buf = render_topology_qr_pdf(resolved)
        return FileResponse(
            buf,
            as_attachment=False,
            filename="qr-topology-batch.pdf",
            content_type="application/pdf",
        )


class TierViewSet(viewsets.ModelViewSet):
    """Фильтр: ?section_id="""

    serializer_class = TierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Tier.objects.select_related("section").all()
        section_id = self.request.query_params.get("section_id")
        if section_id:
            qs = qs.filter(section_id=section_id)
        return qs


class CellViewSet(viewsets.ModelViewSet):
    """Фильтры: ?tier_id=, ?is_active=. QR: `.qr.pdf`."""

    serializer_class = CellSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Cell.objects.select_related("tier").all()
        tier_id = self.request.query_params.get("tier_id")
        if tier_id:
            qs = qs.filter(tier_id=tier_id)
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() in ("1", "true", "yes"))
        return qs

    @action(detail=True, methods=["get"], url_path="qr.pdf")
    def qr_pdf(self, request, pk=None):
        """PDF с QR-кодом одной ячейки."""
        cell = self.get_object()
        buf = render_topology_qr_pdf([
            {
                "type": "CELL",
                "id": cell.pk,
                "address": cell.full_address,
            },
        ])
        return FileResponse(
            buf,
            as_attachment=False,
            filename=f"qr-cell-{cell.pk}.pdf",
            content_type="application/pdf",
        )


class PalletViewSet(viewsets.ModelViewSet):
    """Фильтры: ?cell_id=, ?floor_room_id=, ?status="""

    serializer_class = PalletSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Pallet.objects.select_related("cell", "floor_room").all()
        p = self.request.query_params
        if p.get("cell_id"):
            qs = qs.filter(cell_id=p["cell_id"])
        if p.get("floor_room_id"):
            qs = qs.filter(floor_room_id=p["floor_room_id"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        return qs


class ContainerTypeViewSet(viewsets.ModelViewSet):
    """CRUD для типов тары."""

    serializer_class = ContainerTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ContainerType.objects.select_related("laboratory").all()
        p = self.request.query_params

        laboratory_id = p.get("laboratory_id")
        if laboratory_id:
            from django.db.models import Q
            qs = qs.filter(
                Q(laboratory__isnull=True) | Q(laboratory_id=laboratory_id)
            )

        laboratory_isnull = p.get("laboratory_isnull")
        if laboratory_isnull is not None:
            if laboratory_isnull.lower() in ("1", "true", "yes"):
                qs = qs.filter(laboratory__isnull=True)
            else:
                qs = qs.filter(laboratory__isnull=False)

        is_core = p.get("is_core")
        if is_core is not None:
            qs = qs.filter(is_core=is_core.lower() in ("1", "true", "yes"))

        return qs


class ContainerViewSet(viewsets.ModelViewSet):
    """
    CRUD для тары.
    """

    serializer_class = ContainerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Container.objects.select_related(
            "pallet", "floor_room", "container_type", "comment_template",
            "draft_site", "draft_research_type",
        ).all()
        p = self.request.query_params

        if p.get("pallet_id"):
            qs = qs.filter(pallet_id=p["pallet_id"])
        if p.get("floor_room_id"):
            qs = qs.filter(floor_room_id=p["floor_room_id"])
        if p.get("container_type_id"):
            qs = qs.filter(container_type_id=p["container_type_id"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("comment_template_id"):
            qs = qs.filter(comment_template_id=p["comment_template_id"])

        draft_wo = p.get("draft_work_order_coded")
        if draft_wo:
            qs = qs.filter(draft_work_order_coded__icontains=draft_wo)
        draft_rt = p.get("draft_research_type_id")
        if draft_rt:
            qs = qs.filter(draft_research_type_id=draft_rt)

        return qs

    def destroy(self, request, *args, **kwargs):
        """Удаление тары с защитой от `ProtectedError`."""
        instance = self.get_object()
        try:
            self.perform_destroy(instance)
        except ProtectedError as exc:
            return Response(
                {
                    "error": (
                        "Нельзя удалить тару: на неё ссылаются "
                        f"связанные объекты ({len(exc.protected_objects)})."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="label.pdf")
    def label_pdf(self, request, pk=None):
        """Возвращает PDF-этикетку тары."""
        container = self.get_object()

        try:
            buf = render_container_label(container)
        except FileNotFoundError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        number = container.container_number or f"draft-{container.pk}"
        filename = f"label-{number}.pdf"
        response = FileResponse(
            buf,
            as_attachment=False,
            filename=filename,
            content_type="application/pdf",
        )
        return response

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        """Создать партию тары-заготовок (без проб)."""
        ser = BulkCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            containers = bulk_create_containers(
                containers_data=data["containers"],
                draft_site_id=data.get("draft_site_id"),
                draft_research_type_id=data.get("draft_research_type_id"),
                draft_work_order_coded=data.get("draft_work_order_coded", ""),
                draft_work_order_incoming=data.get(
                    "draft_work_order_incoming", "",
                ),
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                "created_containers": ContainerSerializer(
                    containers, many=True, context={"request": request},
                ).data,
                "total_containers": len(containers),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="fill-samples")
    def fill_samples(self, request, pk=None):
        """
        Заполнить существующую тару пробами.
        """
        container = self.get_object()
        ser = FillSamplesSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        try:
            samples = fill_container_with_samples(
                container=container,
                container_number=data.get("container_number"),
                work_order_coded=data["work_order_coded"],
                work_order_incoming=data.get("work_order_incoming", ""),
                research_type_id=data["research_type_id"],
                site_id=data.get("site_id"),
                sample_groups=data["sample_groups"],
            )
        except ValueError as exc:
            return Response(
                {"error": str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        container.refresh_from_db()
        
        container.draft_site_id = data.get("site_id")
        container.draft_research_type_id = data["research_type_id"]
        container.draft_work_order_coded = data["work_order_coded"]
        container.draft_work_order_incoming = data.get(
            "work_order_incoming", ""
        )
        container.save(update_fields=[
            "draft_site", "draft_research_type", 
            "draft_work_order_coded", "draft_work_order_incoming"
        ])

        return Response(
            {
                "container_id": container.pk,
                "container_number": container.container_number,
                "created_samples": [
                    {
                        "id": s.pk,
                        "sample_number": s.sample_number,
                        "status": s.status,
                    }
                    for s in samples
                ],
                "total_samples": len(samples),
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="bulk-place")
    def bulk_place(self, request):
        """
        Размещение одной или нескольких тар (2f-10a).
        Принимает либо cell_id (в ячейку), либо floor_room_id (на пол).
        """
        container_ids = request.data.get("container_ids", [])
        cell_id = request.data.get("cell_id")
        floor_room_id = request.data.get("floor_room_id")

        if not container_ids:
            return Response(
                {"error": "Укажите container_ids."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not cell_id and not floor_room_id:
            return Response(
                {"error": "Укажите cell_id (в ячейку) или floor_room_id (на пол)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        containers = Container.objects.filter(pk__in=container_ids)
        if not containers.exists():
            return Response(
                {"error": "Тары не найдены."},
                status=status.HTTP_404_NOT_FOUND,
            )

        target_pallet = None
        target_cell = None
        target_room = None
        msg = ""

        if cell_id:
            target_cell = Cell.objects.filter(pk=cell_id, is_active=True).first()
            if not target_cell:
                return Response(
                    {"error": "Ячейка не найдена или неактивна."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            # Для ячейки должен быть поддон (OneToOne). Создаем, если нет.
            target_pallet, _ = Pallet.objects.get_or_create(
                cell=target_cell,
                defaults={"status": Pallet.STATUS_ACTIVE},
            )
            msg = f"Успешно размещено в ячейку {target_cell.full_address}: {len(containers)} тар."
        else:
            target_room = Room.objects.filter(pk=floor_room_id).first()
            if not target_room:
                return Response(
                    {"error": "Комната не найдена."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            msg = f"Успешно размещено на пол в комнате {target_room.name}: {len(containers)} тар."

        with transaction.atomic():
            for c in containers:
                if target_cell:
                    c.pallet = target_pallet
                    c.floor_room = None
                else:
                    c.pallet = None
                    c.floor_room = target_room
                
                c.status = Container.STATUS_ACTIVE
                c.save(update_fields=["pallet", "floor_room", "status"])
                
                sync_sample_status_for_container(c)

        return Response({"message": msg})