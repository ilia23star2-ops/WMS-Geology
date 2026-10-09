"""
Сериализаторы приложения picking.

PickList, PickListItem — без изменений.
Shipment — расширен: direction, laboratory, site, shipment_date,
  driver_name, vehicle_number, status, cancel_reason.
ShipmentItem — без изменений.
"""

from rest_framework import serializers

from .models import PickList, PickListItem, Shipment, ShipmentItem


# ============================================================
# PickList
# ============================================================
class PickListSerializer(serializers.ModelSerializer):
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None,
    )
    items_count = serializers.IntegerField(
        source="items.count", read_only=True,
    )

    class Meta:
        model = PickList
        fields = [
            "id",
            "pick_list_number",
            "created_by",
            "created_by_username",
            "status",
            "items_count",
            "created_at",
            "completed_at",
        ]
        read_only_fields = ["created_at", "completed_at"]


class PickListItemSerializer(serializers.ModelSerializer):
    sample_number = serializers.CharField(
        source="sample.sample_number", read_only=True,
    )
    research_type_code = serializers.CharField(
        source="sample.research_type.code", read_only=True, default=None,
    )
    picked_by_username = serializers.CharField(
        source="picked_by.username", read_only=True, default=None,
    )

    class Meta:
        model = PickListItem
        fields = [
            "id",
            "pick_list",
            "sample",
            "sample_number",
            "research_type_code",
            "status",
            "picked_at",
            "picked_by",
            "picked_by_username",
            "note",
        ]
        read_only_fields = ["picked_at", "picked_by"]


# ============================================================
# Shipment
# ============================================================
class ShipmentSerializer(serializers.ModelSerializer):
    """Отправка. Read-only: `sent_by_username`, `laboratory_name`,
    `site_name`, `items_count`."""

    sent_by_username = serializers.CharField(
        source="sent_by.username", read_only=True, default=None,
    )
    laboratory_name = serializers.CharField(
        source="laboratory.name", read_only=True, default=None,
    )
    site_name = serializers.CharField(
        source="site.name", read_only=True, default=None,
    )
    cancelled_by_username = serializers.CharField(
        source="cancelled_by.username", read_only=True, default=None,
    )
    items_count = serializers.IntegerField(
        source="items.count", read_only=True,
    )

    class Meta:
        model = Shipment
        fields = [
            "id",
            "shipment_number",
            "direction",
            "destination",
            "laboratory",
            "laboratory_name",
            "site",
            "site_name",
            "shipment_date",
            "driver_name",
            "vehicle_number",
            "status",
            "sent_by",
            "sent_by_username",
            "sent_at",
            "assembled_at",
            "received_at",
            "cancelled_at",
            "cancelled_by",
            "cancelled_by_username",
            "cancel_reason",
            "items_count",
            "note",
        ]
        read_only_fields = [
            "sent_at", "assembled_at", "received_at",
            "cancelled_at", "cancelled_by",
        ]


class ShipmentItemSerializer(serializers.ModelSerializer):
    sample_number = serializers.CharField(
        source="sample.sample_number", read_only=True,
    )
    shipment_number = serializers.CharField(
        source="shipment.shipment_number", read_only=True,
    )

    class Meta:
        model = ShipmentItem
        fields = [
            "id",
            "shipment",
            "shipment_number",
            "sample",
            "sample_number",
            "pick_list_item",
        ]