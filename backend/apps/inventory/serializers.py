"""
Сериализаторы приложения inventory.

- InventorySessionSerializer — сессия инвентаризации.
- InventoryScanSerializer — один скан.
- InventoryIssueSerializer — расхождение.
- ActualizationTaskSerializer — задача на актуализацию (3.x-offline-sync-b-2).
- ResolveActualizationTaskSerializer — body для resolve.
- OfflineExportSerializer — вход офлайн-импорта (3.x-offline-sync-b-3).
- OfflineImportResponseSerializer — ответ офлайн-импорта.
"""

from rest_framework import serializers

from .models import (
    ActualizationTask,
    InventoryIssue,
    InventoryScan,
    InventorySession,
)


class InventorySessionSerializer(serializers.ModelSerializer):
    """Сессия инвентаризации."""

    started_by_username = serializers.CharField(
        source="started_by.username", read_only=True, default=None,
    )

    class Meta:
        model = InventorySession
        fields = [
            "id",
            "session_name",
            "status",
            "started_by",
            "started_by_username",
            "started_at",
            "completed_at",
        ]
        read_only_fields = ["started_at", "completed_at"]


class InventoryScanSerializer(serializers.ModelSerializer):
    """Один скан."""

    sample_number = serializers.CharField(
        source="sample.sample_number", read_only=True, default=None,
    )
    container_number = serializers.CharField(
        source="scanned_container.container_number",
        read_only=True,
        default=None,
    )

    class Meta:
        model = InventoryScan
        fields = [
            "id",
            "session",
            "sample",
            "sample_number",
            "scanned_container",
            "container_number",
            "scanned_qr_code",
            "raw_barcode",
            "scanned_at",
            "is_expected",
            "note",
        ]
        read_only_fields = ["scanned_at"]


class InventoryIssueSerializer(serializers.ModelSerializer):
    """Расхождение по итогам сессии."""

    session_name = serializers.CharField(
        source="session.session_name", read_only=True,
    )
    sample_number = serializers.CharField(
        source="sample.sample_number", read_only=True, default=None,
    )
    container_number = serializers.CharField(
        source="container.container_number",
        read_only=True,
        default=None,
    )
    resolved_by_username = serializers.CharField(
        source="resolved_by.username", read_only=True, default=None,
    )

    class Meta:
        model = InventoryIssue
        fields = [
            "id",
            "session",
            "session_name",
            "issue_type",
            "sample",
            "sample_number",
            "container",
            "container_number",
            "expected_value",
            "actual_value",
            "resolution",
            "resolved_at",
            "resolved_by",
            "resolved_by_username",
            "created_at",
        ]
        read_only_fields = ["created_at", "resolved_at", "resolved_by"]


# ============================================================
# ActualizationTask (3.x-offline-sync-b-2)
# ============================================================
class ActualizationTaskSerializer(serializers.ModelSerializer):
    """Задача на актуализацию (read-only; создаётся сервером)."""

    task_type_display = serializers.CharField(
        source="get_task_type_display", read_only=True,
    )
    resolution_display = serializers.CharField(
        source="get_resolution_display", read_only=True,
    )
    resolved_by_username = serializers.CharField(
        source="resolved_by.username", read_only=True, default=None,
    )

    class Meta:
        model = ActualizationTask
        fields = [
            "id",
            "task_type",
            "task_type_display",
            "entity_type",
            "entity_id",
            "server_value",
            "mobile_value",
            "payload",
            "resolution",
            "resolution_display",
            "resolution_note",
            "resolved_by",
            "resolved_by_username",
            "resolved_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class ResolveActualizationTaskSerializer(serializers.Serializer):
    """Body для POST /actualization-tasks/{id}/resolve/."""

    ACTION_ACCEPT_MOBILE = "accept_mobile"
    ACTION_KEEP_SERVER = "keep_server"
    ACTION_REJECT = "reject"
    ACTION_CHOICES = [
        (ACTION_ACCEPT_MOBILE, "Принять данные mobile"),
        (ACTION_KEEP_SERVER, "Оставить данные сервера"),
        (ACTION_REJECT, "Отклонить (закрыть без изменений)"),
    ]

    action = serializers.ChoiceField(
        choices=ACTION_CHOICES,
        help_text="Что сделать с задачей.",
    )
    note = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        max_length=2000,
        help_text="Комментарий (опционально).",
    )


# ============================================================
# Offline-import (3.x-offline-sync-b-3 + 3.x-offline-sync-b-4)
# ============================================================
class OfflineExportOperationSerializer(serializers.Serializer):
    """Одна операция офлайн-экспорта."""

    OP_TYPE_CHOICES = [
        ("RECEIVING_MATCH", "Приёмка: тара совпадает"),
        ("RECEIVING_MISSING", "Приёмка: тара не пришла"),
        ("PICKED", "Выборка: извлечена"),
        ("NOT_FOUND", "Выборка: не найдена"),
        ("DISPOSE_SAMPLE", "Утилизация пробы"),
        ("PLACE", "Перемещение тары"),
    ]

    op_id = serializers.CharField(
        max_length=100,
        help_text="Локальный UUID операции (для дедупликации в будущем).",
    )
    type = serializers.ChoiceField(
        choices=OP_TYPE_CHOICES,
        help_text="Тип операции.",
    )
    entity = serializers.CharField(
        max_length=50,
        help_text="Тип сущности: ReceiptItem, PickListItem, Sample, Container, ...",
    )
    entity_id = serializers.IntegerField(
        min_value=1,
        help_text="ID сущности.",
    )
    server_updated_at = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="ISO updated_at сущности на момент экспорта (опционально).",
    )
    data = serializers.JSONField(
        required=False,
        default=dict,
        help_text="Данные операции (container_number, cell_id, note, reason, ...).",
    )


class OfflineExportSerializer(serializers.Serializer):
    """Вход `POST /offline-imports/` — JSON-файл от mobile."""

    format = serializers.CharField(
        help_text="Всегда 'WMSG-OFFLINE-EXCHANGE'.",
    )
    version = serializers.IntegerField(
        min_value=1,
        help_text="Версия формата (сейчас 1).",
    )
    exported_at = serializers.CharField(
        required=False,
        allow_blank=True,
        default="",
        help_text="ISO timestamp экспорта (для аудита).",
    )
    device_id = serializers.CharField(
        max_length=100,
        help_text="UUID устройства (для привязки offline-token).",
    )
    user = serializers.DictField(
        required=False,
        default=dict,
        help_text="Информация о пользователе mobile (для аудита).",
    )
    task_context = serializers.DictField(
        required=False,
        default=dict,
        help_text=(
            "Контекст: task_type, receipt_id (для RECEIVING_*), "
            "pick_list_id (для PICKED/NOT_FOUND)."
        ),
    )
    operations = OfflineExportOperationSerializer(
        many=True,
        allow_empty=False,
    )


class OfflineImportResponseSerializer(serializers.Serializer):
    """Ответ `POST /offline-imports/`."""

    applied = serializers.IntegerField()
    conflicts = serializers.IntegerField()
    tasks_created = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.DictField())