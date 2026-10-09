"""
Сериализаторы приложения storage.
"""

from rest_framework import serializers

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


# ============================================================
# Справочники
# ============================================================
class ContainerCommentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContainerComment
        fields = ["id", "text", "sort_order", "is_active"]


class ContainerTypeSerializer(serializers.ModelSerializer):
    """Тип тары. Read-only: `laboratory_name`."""

    laboratory_name = serializers.CharField(
        source="laboratory.name", read_only=True, default=None,
    )

    class Meta:
        model = ContainerType
        fields = [
            "id",
            "name",
            "laboratory",
            "laboratory_name",
            "size_class",
            "max_on_standard_pallet",
            "is_core",
            "description",
        ]


# ============================================================
# Топология
# ============================================================
class RoomSerializer(serializers.ModelSerializer):
    class Meta:
        model = Room
        fields = ["id", "name", "description"]


class RackSerializer(serializers.ModelSerializer):
    class Meta:
        model = Rack
        fields = ["id", "room", "code", "description"]


class SectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Section
        fields = ["id", "rack", "code", "qr_code", "description"]


class TierSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tier
        fields = ["id", "section", "code", "level_number", "description"]


class CellSerializer(serializers.ModelSerializer):
    class Meta:
        model = Cell
        fields = [
            "id",
            "tier",
            "code",
            "full_address",
            "cell_type",
            "qr_code",
            "is_active",
        ]


# ============================================================
# Поддоны и тара
# ============================================================
class PalletSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pallet
        fields = [
            "id",
            "cell",
            "floor_room",
            "pallet_type",
            "capacity_override",
            "status",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        cell = (
            attrs.get("cell")
            if "cell" in attrs
            else (self.instance.cell if self.instance else None)
        )
        floor_room = (
            attrs.get("floor_room")
            if "floor_room" in attrs
            else (self.instance.floor_room if self.instance else None)
        )
        if cell and floor_room:
            raise serializers.ValidationError(
                "Нельзя одновременно указывать cell и floor_room."
            )
        return attrs


class ContainerSerializer(serializers.ModelSerializer):
    """Тара. Read-only: `comment_template_text`."""

    comment_template_text = serializers.CharField(
        source="comment_template.text", read_only=True, default=None,
    )

    class Meta:
        model = Container
        fields = [
            "id",
            "container_number",
            "container_type",
            "qr_code",
            "pallet",
            "floor_room",
            "position_on_pallet",
            "status",
            "comment",
            "comment_template",
            "comment_template_text",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        pallet = (
            attrs.get("pallet")
            if "pallet" in attrs
            else (self.instance.pallet if self.instance else None)
        )
        floor_room = (
            attrs.get("floor_room")
            if "floor_room" in attrs
            else (self.instance.floor_room if self.instance else None)
        )
        if pallet and floor_room:
            raise serializers.ValidationError(
                "Нельзя одновременно указывать pallet и floor_room."
            )
        return attrs