"""
Сериализаторы приложения samples.

Справочники: ResearchTypeSerializer, SiteSerializer, LaboratorySerializer.
Модели: WellSerializer, SampleSerializer, SampleWorkOrderSerializer.
"""

from rest_framework import serializers

from .catalogs import Laboratory, ResearchType, Site
from .models import Sample, SampleWorkOrder, Well


# ============================================================
# Справочники
# ============================================================
class ResearchTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResearchType
        fields = ["id", "code", "name", "description", "sort_order", "is_active"]


class SiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Site
        fields = [
            "id", "code", "name", "match_patterns",
            "description", "sort_order", "is_active",
        ]


class LaboratorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Laboratory
        fields = [
            "id", "code", "name", "prefixes",
            "description", "sort_order", "is_active",
        ]


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
    """
    Проба (навеска).

    Read-only:
    - `container_number`;
    - `well_name`;
    - `current_work_order_number`;
    - `research_type_name` — полное имя типа;
    - `site_name` — полное имя участка.
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
    research_type_name = serializers.CharField(
        source="research_type.name", read_only=True,
    )
    site_name = serializers.CharField(
        source="site.name", read_only=True, default=None,
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
            "disposed_at",
            "disposed_by",
            "disposal_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at", "updated_at", "disposed_at", "disposed_by",
        ]


class SampleWorkOrderSerializer(serializers.ModelSerializer):
    class Meta:
        model = SampleWorkOrder
        fields = ["id", "sample", "work_order", "linked_at"]
        read_only_fields = ["linked_at"]