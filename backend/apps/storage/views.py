"""
ViewSets приложения storage.
"""

from django.db.models import ProtectedError
from django.http import FileResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.labels.services import render_container_label

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
    """Фильтр: ?rack_id="""

    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Section.objects.select_related("rack").all()
        rack_id = self.request.query_params.get("rack_id")
        if rack_id:
            qs = qs.filter(rack_id=rack_id)
        return qs


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
    """Фильтры: ?tier_id=, ?is_active="""

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

    Фильтры: ?pallet_id=, ?floor_room_id=, ?container_type_id=,
             ?status=, ?comment_template_id=,
             ?draft_work_order_coded= (icontains),
             ?draft_research_type_id=

    Custom actions:
      - GET  /storage/containers/{id}/label.pdf/     — PDF этикетки.
      - POST /storage/containers/bulk-create/        — создание партии
        тары-заготовок (без проб).
      - POST /storage/containers/{id}/fill-samples/  — заполнение
        тары пробами (с присвоением номера).

    `DELETE` защищён: если на тару ссылаются пробы (`Sample`),
    элементы партии печати (`PrintBatchItem`) или строки приёмки
    (`ReceiptItem`) — вернётся 409 с пояснением. Это осознанно:
    тару, оставившую след в истории, не удаляем молча.
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

        # Draft-контекст группы (Н/З × ТИ) — для реестра тары.
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
        """
        Возвращает PDF-этикетку тары.
        """
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
        """
        Создать партию тары-заготовок (без проб).

        Draft-поля (участок, ТИ, Н/З) сохраняются на каждой таре.
        `container_number` опционален.
        """
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

        Присваивает `container_number`, если у тары он ещё не задан.
        Обнуляет draft-поля.
        Одна тара = один тип исследования.
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