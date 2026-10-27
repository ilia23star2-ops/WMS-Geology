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
    comment_template_text = serializers.CharField(
        source="comment_template.text", read_only=True, default=None,
    )
    draft_site_name = serializers.CharField(
        source="draft_site.name", read_only=True, default=None,
    )
    draft_research_type_name = serializers.CharField(
        source="draft_research_type.name", read_only=True, default=None,
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
            "draft_site",
            "draft_site_name",
            "draft_research_type",
            "draft_research_type_name",
            "draft_work_order_coded",
            "draft_work_order_incoming",
            "label_printed_at",
            "created_at",
        ]
        read_only_fields = ["created_at", "label_printed_at"]

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
# Bulk create — создание тары-заготовки
# ============================================================
class BulkContainerSerializer(serializers.Serializer):
    container_number = serializers.CharField(
        max_length=100,
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
    )
    container_type_id = serializers.IntegerField(min_value=1)

    def validate_container_number(self, value):
        if value is None:
            return None
        value = (value or "").strip()
        return value or None

    def validate_container_type_id(self, value):
        if not ContainerType.objects.filter(pk=value).exists():
            raise serializers.ValidationError(
                f"Тип тары #{value} не найден."
            )
        return value


class BulkCreateSerializer(serializers.Serializer):
    containers = BulkContainerSerializer(many=True, allow_empty=False)
    draft_site_id = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None,
    )
    draft_research_type_id = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None,
    )
    draft_work_order_coded = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default="",
    )
    draft_work_order_incoming = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default="",
    )

    def validate_draft_site_id(self, value):
        if value is None:
            return None
        from apps.samples.catalogs import Site
        if not Site.objects.filter(pk=value).exists():
            raise serializers.ValidationError(f"Участок #{value} не найден.")
        return value

    def validate_draft_research_type_id(self, value):
        if value is None:
            return None
        from apps.samples.catalogs import ResearchType
        if not ResearchType.objects.filter(pk=value).exists():
            raise serializers.ValidationError(f"Тип исследования #{value} не найден.")
        return value

    def validate_containers(self, value):
        # 2f-9b-fix: Убрана проверка на существующие номера в БД.
        # Номер уникален только внутри группы (Н/З × ТИ), а не глобально.
        nums = [
            c["container_number"]
            for c in value
            if c.get("container_number")
        ]
        if len(set(nums)) != len(nums):
            raise serializers.ValidationError(
                "Номера тары в запросе не уникальны."
            )
        return value


# ============================================================
# Fill samples — заполнение существующей тары пробами
# ============================================================
class BulkSampleGroupSerializer(serializers.Serializer):
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
    status = serializers.ChoiceField(
        choices=[("NORMAL", "Обычная"), ("SELECTED", "Выбрана")],
        default="NORMAL",
        required=False,
        help_text="Статус создаваемых проб."
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


class FillSamplesSerializer(serializers.Serializer):
    container_number = serializers.CharField(
        max_length=100,
        required=False,
        allow_null=True,
        allow_blank=True,
        default=None,
    )
    work_order_coded = serializers.CharField(max_length=100)
    work_order_incoming = serializers.CharField(
        max_length=100, required=False, allow_blank=True, default="",
    )
    research_type_id = serializers.IntegerField(min_value=1)
    site_id = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None,
    )
    sample_groups = BulkSampleGroupSerializer(many=True, allow_empty=False)

    def validate_container_number(self, value):
        if value is None:
            return None
        value = (value or "").strip()
        return value or None

    def validate_work_order_coded(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Номер зашифрованного Н/З обязателен.")
        return value

    def validate_research_type_id(self, value):
        from apps.samples.catalogs import ResearchType
        if not ResearchType.objects.filter(pk=value).exists():
            raise serializers.ValidationError(f"Тип исследования #{value} не найден.")
        return value

    def validate_site_id(self, value):
        if value is None:
            return None
        from apps.samples.catalogs import Site
        if not Site.objects.filter(pk=value).exists():
            raise serializers.ValidationError(f"Участок #{value} не найден.")
        return value