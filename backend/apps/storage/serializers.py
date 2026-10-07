"""
Сериализаторы приложения storage.

DRF ModelSerializer для 8 моделей:
- Room, Rack, Section, Tier — топология;
- Cell — ячейка (место на ярусе);
- Pallet — «тихий» поддон (OneToOne с Cell);
- ContainerType — справочник типов тары;
- Container — тара.

Валидация на уровне сериализатора дублирует CHECK-constraints БД:
- `Pallet`: нельзя одновременно `cell` и `floor_room`;
- `Container`: нельзя одновременно `pallet` и `floor_room`.

Даёт более понятные сообщения об ошибках (в отличие от IntegrityError).
"""

from rest_framework import serializers

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


class RoomSerializer(serializers.ModelSerializer):
    """Комната."""

    class Meta:
        model = Room
        fields = ["id", "name", "description"]


class RackSerializer(serializers.ModelSerializer):
    """Стеллаж."""

    class Meta:
        model = Rack
        fields = ["id", "room", "code", "description"]


class SectionSerializer(serializers.ModelSerializer):
    """Секция (пролёт)."""

    class Meta:
        model = Section
        fields = ["id", "rack", "code", "qr_code", "description"]


class TierSerializer(serializers.ModelSerializer):
    """Ярус (A, B, C, D)."""

    class Meta:
        model = Tier
        fields = ["id", "section", "code", "level_number", "description"]


class CellSerializer(serializers.ModelSerializer):
    """Ячейка (место на ярусе, 1 поддон)."""

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


class PalletSerializer(serializers.ModelSerializer):
    """Поддон — «тихий» объект (OneToOne с Cell)."""

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
        """Нельзя одновременно cell и floor_room."""
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


class ContainerTypeSerializer(serializers.ModelSerializer):
    """Справочник типов тары."""

    class Meta:
        model = ContainerType
        fields = [
            "id",
            "name",
            "size_class",
            "max_on_standard_pallet",
            "is_core",
            "description",
        ]


class ContainerSerializer(serializers.ModelSerializer):
    """Тара."""

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
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        """Нельзя одновременно pallet и floor_room."""
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