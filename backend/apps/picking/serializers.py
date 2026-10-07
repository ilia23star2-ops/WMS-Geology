"""
Сериализаторы приложения picking.

- PickListSerializer — список выборки.
- PickListItemSerializer — одна строка (проба + статус).
- ShipmentSerializer — отправка в лабораторию.
- ShipmentItemSerializer — одна проба в отправке.
"""

from rest_framework import serializers

from .models import PickList, PickListItem, Shipment, ShipmentItem


class PickListSerializer(serializers.ModelSerializer):
    """Список выборки."""

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
    """Строка выборки."""

    sample_number = serializers.CharField(
        source="sample.sample_number", read_only=True,
    )
    research_type = serializers.CharField(
        source="sample.research_type", read_only=True,
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
            "research_type",
            "status",
            "picked_at",
            "picked_by",
            "picked_by_username",
            "note",
        ]
        read_only_fields = ["picked_at", "picked_by"]


class ShipmentSerializer(serializers.ModelSerializer):
    """Отправка в лабораторию."""

    sent_by_username = serializers.CharField(
        source="sent_by.username", read_only=True, default=None,
    )
    items_count = serializers.IntegerField(
        source="items.count", read_only=True,
    )

    class Meta:
        model = Shipment
        fields = [
            "id",
            "shipment_number",
            "destination",
            "sent_by",
            "sent_by_username",
            "items_count",
            "sent_at",
            "note",
        ]
        read_only_fields = ["sent_at"]


class ShipmentItemSerializer(serializers.ModelSerializer):
    """Одна проба в отправке."""

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