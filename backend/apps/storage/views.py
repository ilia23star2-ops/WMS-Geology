"""
ViewSets приложения storage.
"""

from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

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
    CellSerializer,
    ContainerCommentSerializer,
    ContainerSerializer,
    ContainerTypeSerializer,
    PalletSerializer,
    RackSerializer,
    RoomSerializer,
    SectionSerializer,
    TierSerializer,
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
    """
    CRUD для типов тары.

    Фильтры:
    - ?laboratory_id=<id> — типы этой лаборатории (включая общие);
    - ?laboratory_isnull=true — только общие;
    - ?is_core=true/false.
    """

    serializer_class = ContainerTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ContainerType.objects.select_related("laboratory").all()
        p = self.request.query_params

        laboratory_id = p.get("laboratory_id")
        if laboratory_id:
            # Общие (laboratory=NULL) + конкретной лаборатории.
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
             ?status=, ?comment_template_id=
    """

    serializer_class = ContainerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Container.objects.select_related(
            "pallet", "floor_room", "container_type", "comment_template"
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

        return qs