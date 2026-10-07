"""
Сериализаторы приложения movements.

- MoveOperationSerializer — операция пула.
- MoveOperationItemSerializer — одна строка (поддон или тара).
"""

from rest_framework import serializers

from .models import MoveOperation, MoveOperationItem


class MoveOperationItemSerializer(serializers.ModelSerializer):
    """Строка перемещения."""

    pallet_display = serializers.CharField(
        source="pallet.__str__", read_only=True, default=None,
    )
    container_number = serializers.CharField(
        source="container.container_number", read_only=True, default=None,
    )

    class Meta:
        model = MoveOperationItem
        fields = [
            "id",
            "move_operation",
            "pallet",
            "pallet_display",
            "container",
            "container_number",
            "source_cell",
            "source_floor_room",
            "status",
        ]

    def validate(self, attrs):
        """Нельзя оба pallet и container одновременно."""
        pallet = attrs.get("pallet")
        container = attrs.get("container")
        if pallet and container:
            raise serializers.ValidationError(
                "Нельзя одновременно указывать pallet и container."
            )
        return attrs


class MoveOperationSerializer(serializers.ModelSerializer):
    """Операция пула перемещений."""

    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None,
    )
    items_count = serializers.IntegerField(
        source="items.count", read_only=True,
    )
    items = MoveOperationItemSerializer(many=True, read_only=True)

    class Meta:
        model = MoveOperation
        fields = [
            "id",
            "operation_number",
            "target_cell",
            "target_floor_room",
            "created_by",
            "created_by_username",
            "status",
            "items_count",
            "items",
            "created_at",
            "completed_at",
        ]
        read_only_fields = ["created_at", "completed_at"]

    def validate(self, attrs):
        """Нельзя оба target_cell и target_floor_room одновременно."""
        cell = attrs.get("target_cell")
        floor_room = attrs.get("target_floor_room")
        if cell and floor_room:
            raise serializers.ValidationError(
                "Нельзя одновременно указывать target_cell и target_floor_room."
            )
        return attrs