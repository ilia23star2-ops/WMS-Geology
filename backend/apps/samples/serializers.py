"""
Сериализаторы приложения samples.

Справочники:
- ResearchTypeSerializer.
- SiteSerializer.
- LaboratorySerializer.

Модели:
- WellSerializer.
- SampleSerializer.
- SampleWorkOrderSerializer.
"""

from rest_framework import serializers

from .catalogs import Laboratory, ResearchType, Site
from .models import Sample, SampleWorkOrder, Well


# ============================================================
# Справочники
# ============================================================
class ResearchTypeSerializer(serializers.ModelSerializer):
    """Тип исследования."""

    class Meta:
        model = ResearchType
        fields = [
            "id",
            "code",
            "name",
            "description",
            "sort_order",
            "is_active",
        ]


class SiteSerializer(serializers.ModelSerializer):
    """Участок."""

    class Meta:
        model = Site
        fields = [
            "id",
            "code",
            "name",
            "match_patterns",
            "description",
            "sort_order",
            "is_active",
        ]


class LaboratorySerializer(serializers.ModelSerializer):
    """Лаборатория."""

    class Meta:
        model = Laboratory
        fields = [
            "id",
            "code",
            "name",
            "prefixes",
            "description",
            "sort_order",
            "is_active",
        ]


# ============================================================
# Модели
# ============================================================
class WellSerializer(serializers.ModelSerializer):
    """Скважина."""

    class Meta:
        model = Well
        fields = [
            "id",
            "well_name",
            "field_name",
            "cluster",
            "coordinates",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class SampleSerializer(serializers.ModelSerializer):
    """
    Проба (навеска).

    Read-only:
    - `container_number` — номер тары;
    - `well_name` — имя скважины;
    - `current_work_order_number` — номер текущего Н/З.
    """

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

    class Meta:
        model = Sample
        fields = [
            "id",
            "sample_number",
            "research_type",
            "well",
            "well_name",
            "depth_from",
            "depth_to",
            "site",
            "container",
            "container_number",
            "current_work_order",
            "current_work_order_number",
            "status",
            "qr_code",
            "legacy_data",
            "disposed_at",
            "disposed_by",
            "disposal_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at",
            "updated_at",
            "disposed_at",
            "disposed_by",
        ]


class SampleWorkOrderSerializer(serializers.ModelSerializer):
    """Связь пробы с Н/З."""

    class Meta:
        model = SampleWorkOrder
        fields = ["id", "sample", "work_order", "linked_at"]
        read_only_fields = ["linked_at"]