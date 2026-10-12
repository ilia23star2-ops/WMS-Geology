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


# ============================================================
# Bulk create — создание тары с пробами
# ============================================================
class BulkSampleGroupSerializer(serializers.Serializer):
    """
    Диапазон проб одной скважины (или одной серии для шифрованной).

    Полный номер пробы = `prefix` + `middle` + `sequence`.

    Примеры:
    - шифрованная:  TAA-A + 34076 + 001 = TAA-A34076001
    - нешифрованная: TST  + 124   + 001 = TST124001

    `well_name`:
    - задан — создаём/используем `Well` (для нешифрованных);
    - null — `Well` не создаём (шифрованные — скважина неизвестна).
    """

    prefix = serializers.CharField(max_length=50)
    middle = serializers.CharField(max_length=50)
    sequence_from = serializers.IntegerField(min_value=1)
    sequence_to = serializers.IntegerField(min_value=1)
    sequence_digits = serializers.IntegerField(
        min_value=1, max_value=6, default=3,
        help_text="Сколько цифр в sequence (по умолчанию 3: 001, 002, ...).",
    )
    well_name = serializers.CharField(
        max_length=200, required=False, allow_null=True, allow_blank=True,
        help_text="Имя скважины. NULL — не создавать Well.",
    )

    def validate(self, attrs):
        if attrs["sequence_from"] > attrs["sequence_to"]:
            raise serializers.ValidationError(
                "sequence_from не может быть больше sequence_to."
            )
        count = attrs["sequence_to"] - attrs["sequence_from"] + 1
        if count > 1000:
            raise serializers.ValidationError(
                "Слишком большой диапазон (>1000 проб в одной группе)."
            )
        return attrs

    def build_sample_numbers(self) -> list[str]:
        """Список полных номеров проб для этого диапазона."""
        prefix = self.validated_data["prefix"]
        middle = self.validated_data["middle"]
        digits = self.validated_data["sequence_digits"]
        start = self.validated_data["sequence_from"]
        end = self.validated_data["sequence_to"]
        return [
            f"{prefix}{middle}{i:0{digits}d}"
            for i in range(start, end + 1)
        ]


class BulkContainerSerializer(serializers.Serializer):
    """Одна тара с пробами."""

    container_number = serializers.CharField(max_length=100)
    container_type_id = serializers.IntegerField(min_value=1)
    sample_groups = BulkSampleGroupSerializer(many=True, allow_empty=False)

    def validate_container_type_id(self, value):
        if not ContainerType.objects.filter(pk=value).exists():
            raise serializers.ValidationError(
                f"Тип тары #{value} не найден."
            )
        return value


class BulkCreateSerializer(serializers.Serializer):
    """
    Запрос на создание N тар с пробами.

    Один запрос = партия. Н/З (входящий + текущий) общие для всех тар.
    """

    work_order_coded = serializers.CharField(max_length=100)
    work_order_incoming = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default="",
    )
    research_type_id = serializers.IntegerField(min_value=1)
    site_id = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None,
    )
    containers = BulkContainerSerializer(many=True, allow_empty=False)

    def validate_work_order_coded(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError(
                "Номер зашифрованного Н/З обязателен."
            )
        return value

    def validate_research_type_id(self, value):
        from apps.samples.catalogs import ResearchType
        if not ResearchType.objects.filter(pk=value).exists():
            raise serializers.ValidationError(
                f"Тип исследования #{value} не найден."
            )
        return value

    def validate_site_id(self, value):
        if value is None:
            return None
        from apps.samples.catalogs import Site
        if not Site.objects.filter(pk=value).exists():
            raise serializers.ValidationError(
                f"Участок #{value} не найден."
            )
        return value

    def validate_containers(self, value):
        nums = [c["container_number"] for c in value]
        if len(set(nums)) != len(nums):
            raise serializers.ValidationError(
                "Номера тары в запросе не уникальны."
            )
        existing = sorted(
            Container.objects.filter(
                container_number__in=nums,
            ).values_list("container_number", flat=True)
        )
        if existing:
            raise serializers.ValidationError(
                f"Тара уже существует в системе: {existing}."
            )
        return value