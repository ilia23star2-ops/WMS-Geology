"""
ViewSets приложения storage.

Справочники:
- ContainerCommentViewSet.

Модели:
- RoomViewSet, RackViewSet, SectionViewSet, TierViewSet, CellViewSet,
  PalletViewSet, ContainerTypeViewSet, ContainerViewSet.
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
    """
    CRUD для шаблонов комментариев к таре.

    Фильтры: ?is_active=
    """

    serializer_class = ContainerCommentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ContainerComment.objects.all()
        is_active = self.request.query_params.get("is_active")
        if is_active is not None:
            qs = qs.filter(
                is_active=is_active.lower() in ("1", "true", "yes")
            )
        return qs


class RoomViewSet(viewsets.ModelViewSet):
    """CRUD для комнат."""

    queryset = Room.objects.all()
    serializer_class = RoomSerializer
    permission_classes = [IsAuthenticated]


class RackViewSet(viewsets.ModelViewSet):
    """CRUD для стеллажей. Фильтр: ?room_id="""

    serializer_class = RackSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Rack.objects.select_related("room").all()
        room_id = self.request.query_params.get("room_id")
        if room_id:
            qs = qs.filter(room_id=room_id)
        return qs


class SectionViewSet(viewsets.ModelViewSet):
    """CRUD для секций. Фильтр: ?rack_id="""

    serializer_class = SectionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Section.objects.select_related("rack").all()
        rack_id = self.request.query_params.get("rack_id")
        if rack_id:
            qs = qs.filter(rack_id=rack_id)
        return qs


class TierViewSet(viewsets.ModelViewSet):
    """CRUD для ярусов. Фильтр: ?section_id="""

    serializer_class = TierSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Tier.objects.select_related("section").all()
        section_id = self.request.query_params.get("section_id")
        if section_id:
            qs = qs.filter(section_id=section_id)
        return qs


class CellViewSet(viewsets.ModelViewSet):
    """CRUD для ячеек. Фильтры: ?tier_id=, ?is_active="""

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
    """CRUD для поддонов. Фильтры: ?cell_id=, ?floor_room_id=, ?status="""

    serializer_class = PalletSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Pallet.objects.select_related("cell", "floor_room").all()
        cell_id = self.request.query_params.get("cell_id")
        if cell_id:
            qs = qs.filter(cell_id=cell_id)
        floor_room_id = self.request.query_params.get("floor_room_id")
        if floor_room_id:
            qs = qs.filter(floor_room_id=floor_room_id)
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs


class ContainerTypeViewSet(viewsets.ModelViewSet):
    """CRUD для типов тары."""

    queryset = ContainerType.objects.all()
    serializer_class = ContainerTypeSerializer
    permission_classes = [IsAuthenticated]


class ContainerViewSet(viewsets.ModelViewSet):
    """
    CRUD для тары.

    Фильтры: ?pallet_id=, ?floor_room_id=, ?container_type_id=, ?status=
    """

    serializer_class = ContainerSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Container.objects.select_related(
            "pallet", "floor_room", "container_type"
        ).all()
        pallet_id = self.request.query_params.get("pallet_id")
        if pallet_id:
            qs = qs.filter(pallet_id=pallet_id)
        floor_room_id = self.request.query_params.get("floor_room_id")
        if floor_room_id:
            qs = qs.filter(floor_room_id=floor_room_id)
        container_type_id = self.request.query_params.get("container_type_id")
        if container_type_id:
            qs = qs.filter(container_type_id=container_type_id)
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs