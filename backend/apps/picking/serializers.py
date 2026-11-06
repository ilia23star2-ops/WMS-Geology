"""
Сериализаторы приложения picking.

PickList, PickListItem — + updated_at (3.x-offline-sync-b-1c).
Shipment — расширен: name, direction, laboratory, site, ... (c-2.x-shipments-1).
ShipmentContainerItem — новый (c-2.x-shipments-1).
"""

from rest_framework import serializers

from .models import (
    PickList,
    PickListItem,
    Shipment,
    ShipmentContainerItem,
    ShipmentItem,
)


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
            "updated_at",
        ]
        read_only_fields = ["created_at", "completed_at", "updated_at"]


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
            "updated_at",
        ]
        read_only_fields = ["picked_at", "picked_by", "updated_at"]


# ============================================================
# ShipmentContainerItem
# ============================================================
class ShipmentContainerItemSerializer(serializers.ModelSerializer):
    """Тара в рейсе (OUTBOUND). Read-only денормализация для UI."""

    container_number = serializers.CharField(
        source="container.container_number", read_only=True, default=None,
    )
    container_status = serializers.CharField(
        source="container.status", read_only=True,
    )
    container_type_name = serializers.CharField(
        source="container.container_type.name", read_only=True, default=None,
    )
    draft_work_order_coded = serializers.CharField(
        source="container.draft_work_order_coded", read_only=True, default="",
    )
    draft_research_type_name = serializers.CharField(
        source="container.draft_research_type.name",
        read_only=True,
        default=None,
    )

    class Meta:
        model = ShipmentContainerItem
        fields = [
            "id",
            "shipment",
            "container",
            "position",
            "container_number",
            "container_status",
            "container_type_name",
            "draft_work_order_coded",
            "draft_research_type_name",
        ]
        read_only_fields = ["id", "shipment"]


# ============================================================
# Shipment
# ============================================================
class ShipmentSerializer(serializers.ModelSerializer):
    """Отправка. Read-only: денормализация + `container_items` (c-2.x-shipments-1)."""

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
    containers_count = serializers.IntegerField(read_only=True)
    container_items = ShipmentContainerItemSerializer(
        many=True, read_only=True,
    )

    class Meta:
        model = Shipment
        fields = [
            "id",
            "shipment_number",
            "name",
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
            "containers_count",
            "container_items",
            "note",
            "updated_at",
        ]
        read_only_fields = [
            "sent_at", "assembled_at", "received_at",
            "cancelled_at", "cancelled_by", "updated_at",
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