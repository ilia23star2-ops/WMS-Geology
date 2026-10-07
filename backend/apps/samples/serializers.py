"""
Сериализаторы приложения samples.

- WellSerializer — скважина.
- SampleSerializer — проба (с удобными read-only полями).
- SampleWorkOrderSerializer — M:N связь пробы с Н/З.
"""

from rest_framework import serializers

from .models import Sample, SampleWorkOrder, Well


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
    Проба.

    Read-only поля:
    - `container_number` — номер тары (для удобства мобильного клиента);
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