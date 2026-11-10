"""
Сериализаторы приложения samples.
"""

from rest_framework import serializers

from .catalogs import Laboratory, ResearchType, Site
from .models import Sample, SampleWorkOrder, Well


# ============================================================
# Вспомогательные
# ============================================================
def compute_sample_location(container) -> str:
    """Адрес хранения тары для отображения в UI."""
    if container is None:
        return "—"

    pallet = container.pallet
    if pallet is not None and pallet.cell is not None:
        return pallet.cell.full_address

    if container.floor_room is not None:
        return f"На полу: {container.floor_room.name}"

    return "Место не указано"


# ============================================================
# Справочники (ТД-38: can_delete)
# ============================================================
class ResearchTypeSerializer(serializers.ModelSerializer):
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = ResearchType
        fields = [
            "id", "code", "name", "description", 
            "sort_order", "is_active", "can_delete"
        ]

    def get_can_delete(self, obj) -> bool:
        """Можно ли удалить (нет ли привязанных проб или тар)."""
        from apps.storage.models import Container
        if Sample.objects.filter(research_type=obj).exists():
            return False
        if Container.objects.filter(draft_research_type=obj).exists():
            return False
        return True


class SiteSerializer(serializers.ModelSerializer):
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = [
            "id", "code", "name", "match_patterns",
            "description", "sort_order", "is_active", "can_delete"
        ]

    def get_can_delete(self, obj) -> bool:
        from apps.storage.models import Container
        from apps.picking.models import Shipment
        from apps.work_orders.models import WorkOrder
        
        if Sample.objects.filter(site=obj).exists():
            return False
        if Container.objects.filter(draft_site=obj).exists():
            return False
        if Shipment.objects.filter(site=obj).exists():
            return False
        if WorkOrder.objects.filter(site=obj).exists():
            return False
        return True


class LaboratorySerializer(serializers.ModelSerializer):
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Laboratory
        fields = [
            "id", "code", "name", "prefixes",
            "description", "sort_order", "is_active", "can_delete"
        ]

    def get_can_delete(self, obj) -> bool:
        from apps.storage.models import ContainerType
        from apps.picking.models import Shipment
        from apps.users.models import UserProfile
        
        if Shipment.objects.filter(laboratory=obj).exists() or Shipment.objects.filter(origin_laboratory=obj).exists():
            return False
        if UserProfile.objects.filter(laboratory=obj).exists():
            return False
        if ContainerType.objects.filter(laboratory=obj).exists():
            return False
        return True


# ============================================================
# Модели
# ============================================================
class WellSerializer(serializers.ModelSerializer):
    class Meta:
        model = Well
        fields = [
            "id", "well_name", "field_name", "cluster",
            "coordinates", "created_at",
        ]
        read_only_fields = ["created_at"]


class SampleSerializer(serializers.ModelSerializer):
    container_number = serializers.CharField(
        source="container.container_number", read_only=True,
    )
    well_name = serializers.CharField(
        source="well.well_name", read_only=True, default=None,
    )
    current_work_order_number = serializers.CharField(
        source="current_work_order.order_number",
        read_only=True,
        default=None,
    )
    research_type_name = serializers.CharField(
        source="research_type.name", read_only=True,
    )
    site_name = serializers.CharField(
        source="site.name", read_only=True, default=None,
    )
    current_location = serializers.SerializerMethodField()
    # c-2.x-lab-portal-1: где сейчас проба.
    current_holder = serializers.SerializerMethodField()
    # c-2.x-lifecycle-3: преемственность (родительская проба).
    parent_sample_number = serializers.CharField(
        source="parent_sample.sample_number",
        read_only=True,
        default=None,
    )

    class Meta:
        model = Sample
        fields = [
            "id",
            "sample_number",
            "research_type",
            "research_type_name",
            "well",
            "well_name",
            "depth_from",
            "depth_to",
            "site",
            "site_name",
            "container",
            "container_number",
            "current_work_order",
            "current_work_order_number",
            "status",
            "qr_code",
            "legacy_data",
            "parent_sample",
            "parent_sample_number",
            "disposed_at",
            "disposed_by",
            "disposal_reason",
            "current_location",
            "current_holder",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at", "updated_at", "disposed_at", "disposed_by",
        ]

    def get_current_location(self, obj: Sample) -> str:
        return compute_sample_location(obj.container)

    def get_current_holder(self, obj: Sample) -> str:
        """Где сейчас проба (c-2.x-lab-portal-1)."""
        c = obj.container
        if c is None:
            return "—"
        from apps.storage.models import Container
        status = c.status
        if status == Container.STATUS_DISPOSED:
            return "Утилизирована"
        if status in (
            Container.STATUS_ACTIVE,
            Container.STATUS_PENDING_FILLING,
            Container.STATUS_PENDING_PLACEMENT,
        ):
            return "У нас на складе"
        if status == Container.STATUS_ISSUED:
            from apps.picking.models import Shipment
            last = (
                c.shipment_items
                .filter(shipment__direction=Shipment.DIRECTION_OUTBOUND)
                .select_related("shipment__laboratory")
                .order_by("-shipment__sent_at")
                .first()
            )
            if last and last.shipment.laboratory:
                return f"У лаборатории {last.shipment.laboratory.name}"
            return "У лаборатории"
        if status == Container.STATUS_IN_TRANSIT:
            from apps.picking.models import Shipment
            last_out = (
                c.shipment_items
                .filter(shipment__direction=Shipment.DIRECTION_OUTBOUND)
                .select_related("shipment__laboratory")
                .order_by("-shipment__sent_at")
                .first()
            )
            if last_out and last_out.shipment.laboratory:
                return f"В пути к {last_out.shipment.laboratory.name}"
            return "В пути"
        return "—"


class SampleWorkOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleWorkOrder
        fields = ["id", "sample", "work_order", "linked_at"]
        read_only_fields = ["linked_at"]


# ============================================================
# Группировка проб
# ============================================================
class GroupedWorkOrderSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    number = serializers.CharField()
    type = serializers.CharField()


class GroupedResearchTypeSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    code = serializers.CharField()
    name = serializers.CharField()


class GroupedContainerBriefSerializer(serializers.Serializer):
    """Краткая инфа о таре. Добавлены cell_id и pallet_id (2f-11c)."""

    id = serializers.IntegerField()
    number = serializers.CharField()
    status = serializers.CharField()
    cell_id = serializers.IntegerField(allow_null=True, required=False)
    pallet_id = serializers.IntegerField(allow_null=True, required=False)


class GroupedSampleBriefSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    sample_number = serializers.CharField()
    status = serializers.CharField()
    updated_at = serializers.DateTimeField()


class GroupedContainerSerializer(serializers.Serializer):
    container = GroupedContainerBriefSerializer()
    location = serializers.CharField()
    samples = GroupedSampleBriefSerializer(many=True)


class SampleGroupSerializer(serializers.Serializer):
    work_order = GroupedWorkOrderSerializer(allow_null=True)
    research_type = GroupedResearchTypeSerializer()
    total_samples = serializers.IntegerField()
    containers = GroupedContainerSerializer(many=True)