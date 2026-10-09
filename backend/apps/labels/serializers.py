"""
Сериализаторы приложения labels.

- `PrintBatchItemSerializer` — элемент корзины (тара + позиция).
- `PrintBatchSerializer` — партия печати с вложенными элементами.
- `AddContainersSerializer` — входной для action `add-containers`.
"""

from rest_framework import serializers

from apps.storage.models import Container

from .models import PrintBatch, PrintBatchItem


class PrintBatchItemSerializer(serializers.ModelSerializer):
    """Элемент партии печати. Тара read-only по номеру."""

    container_number = serializers.CharField(
        source="container.container_number", read_only=True,
    )

    class Meta:
        model = PrintBatchItem
        fields = [
            "id",
            "container",
            "container_number",
            "position",
            "created_at",
        ]
        read_only_fields = ["created_at"]


class PrintBatchSerializer(serializers.ModelSerializer):
    """
    Партия печати.

    Поля `items` — read-only, наполняются через action
    `add-containers`. Счётчики и номер партии — read-only.
    """

    items = PrintBatchItemSerializer(many=True, read_only=True)

    status_display = serializers.CharField(
        source="get_status_display", read_only=True,
    )
    print_type_display = serializers.CharField(
        source="get_print_type_display", read_only=True,
    )
    created_by_username = serializers.CharField(
        source="created_by.username", read_only=True, default=None,
    )
    printed_by_username = serializers.CharField(
        source="printed_by.username", read_only=True, default=None,
    )

    class Meta:
        model = PrintBatch
        fields = [
            "id",
            "batch_number",
            "print_type",
            "print_type_display",
            "status",
            "status_display",
            "created_by",
            "created_by_username",
            "printed_by",
            "printed_by_username",
            "printed_at",
            "total_items",
            "total_pages",
            "comment",
            "items",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "batch_number",
            "status",
            "printed_at",
            "printed_by",
            "printed_by_username",
            "total_items",
            "total_pages",
            "created_at",
            "updated_at",
        ]


class AddContainersSerializer(serializers.Serializer):
    """
    Входной сериализатор для action `add-containers`.

    Принимает список ID тар. Проверяет:
    - нет дубликатов внутри запроса;
    - все ID существуют в БД.

    Проверка «тара ещё не в этой партии» — во ViewSet, где
    известен объект партии.
    """

    container_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
        help_text="Список ID тар для добавления.",
    )

    def validate_container_ids(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError(
                "Список container_ids содержит дубликаты."
            )
        existing = set(
            Container.objects.filter(pk__in=value).values_list("id", flat=True)
        )
        missing = sorted(set(value) - existing)
        if missing:
            raise serializers.ValidationError(
                f"Тары не найдены: {missing}."
            )
        return value