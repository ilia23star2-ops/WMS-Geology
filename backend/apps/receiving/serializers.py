"""
Сериализаторы приложения receiving.

- ReceiptSerializer — партия приёмки (+ updated_at).
- ReceiptItemSerializer — строка партии (включая `container_type_name`,
  updated_at).
- ImportSessionSerializer — сессия импорта.
- ImportUploadResponseSerializer — ответ на загрузку Excel.
- ShipmentImportResponseSerializer — ответ на импорт рейса.
- ResolveQuestionsRequest/Response — legacy разбор вопросов.
- ConflictSerializer — вопрос конфликта с `suggested_count`.
- ResolveConflictsRequest/Response — разбор конфликтов.
- CheckReceiptRequest/Response — сверка.
- CompleteReceiptResponse — завершение.
- ReceiptBriefSerializer — краткая инфо о Receipt.
"""

from rest_framework import serializers

from .models import ImportSession, Receipt, ReceiptItem


# ============================================================
# Receipt
# ============================================================
class ReceiptSerializer(serializers.ModelSerializer):
    """Партия приёмки. Read-only: `laboratory_name`, `site_name`, `items_count`."""

    laboratory_name = serializers.CharField(
        source="laboratory.name", read_only=True, default=None,
    )
    site_name = serializers.CharField(
        source="site.name", read_only=True, default=None,
    )
    items_count = serializers.IntegerField(
        source="items.count", read_only=True,
    )

    class Meta:
        model = Receipt
        fields = [
            "id",
            "receipt_number",
            "laboratory",
            "laboratory_name",
            "site",
            "site_name",
            "shipment",
            "excel_file",
            "imported_at",
            "imported_by",
            "received_at",
            "received_by",
            "expected_date",
            "status",
            "items_count",
            "comment",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "created_at", "imported_at", "received_at", "updated_at",
        ]


class ReceiptBriefSerializer(serializers.ModelSerializer):
    """Краткая инфо о Receipt для ответа импорта."""

    site_code = serializers.CharField(
        source="site.code", read_only=True, default=None,
    )
    items_count = serializers.IntegerField(
        source="items.count", read_only=True,
    )

    class Meta:
        model = Receipt
        fields = ["id", "receipt_number", "site_code", "items_count", "status"]


# ============================================================
# ReceiptItem
# ============================================================
class ReceiptItemSerializer(serializers.ModelSerializer):
    """Строка партии (одна тара). + updated_at (3.x-offline-sync-b-1d)."""

    container_number = serializers.CharField(
        source="container.container_number", read_only=True, default=None,
    )
    work_order_number = serializers.CharField(
        source="work_order.order_number", read_only=True, default=None,
    )
    research_type_code = serializers.CharField(
        source="research_type.code", read_only=True, default=None,
    )
    site_code = serializers.CharField(
        source="site.code", read_only=True, default=None,
    )
    container_type_name = serializers.CharField(
        source="container_type.name", read_only=True, default=None,
    )

    class Meta:
        model = ReceiptItem
        fields = [
            "id",
            "receipt",
            "container",
            "container_number",
            "container_type",
            "container_type_name",
            "expected_container_number",
            "expected_work_order_number",
            "expected_research_type_code",
            "expected_site_code",
            "expected_samples_count",
            "actual_container_number",
            "actual_samples_count",
            "scanned_barcodes",
            "status",
            "work_order",
            "work_order_number",
            "research_type",
            "research_type_code",
            "site",
            "site_code",
            "note",
            "updated_at",
        ]


# ============================================================
# ImportSession
# ============================================================
class ImportSessionSerializer(serializers.ModelSerializer):
    """Сессия импорта Excel-файла."""

    uploaded_by_username = serializers.CharField(
        source="uploaded_by.username", read_only=True, default=None,
    )
    receipt_number = serializers.CharField(
        source="receipt.receipt_number", read_only=True, default=None,
    )

    class Meta:
        model = ImportSession
        fields = [
            "id",
            "file",
            "file_format",
            "uploaded_at",
            "uploaded_by",
            "uploaded_by_username",
            "status",
            "parse_errors",
            "receipt",
            "receipt_number",
        ]
        read_only_fields = ["uploaded_at", "parse_errors"]


class ImportUploadResponseSerializer(serializers.Serializer):
    """Ответ на загрузку Excel-файла (старый импорт)."""

    import_session_id = serializers.IntegerField()
    status = serializers.CharField()
    file_format = serializers.CharField()
    sheets_count = serializers.IntegerField()
    rows_count = serializers.IntegerField()
    containers_count = serializers.IntegerField()
    parse_errors = serializers.ListField()
    receipts = ReceiptBriefSerializer(many=True)


class ShipmentImportResponseSerializer(serializers.Serializer):
    """Ответ на импорт рейса (`POST /import-sessions/import-shipment/`)."""

    import_session_id = serializers.IntegerField()
    status = serializers.CharField()
    shipment_id = serializers.IntegerField(allow_null=True)
    shipment_number = serializers.CharField(allow_null=True)
    receipt_id = serializers.IntegerField(allow_null=True)
    receipt_number = serializers.CharField(allow_null=True)
    containers_count = serializers.IntegerField()
    questions_count = serializers.IntegerField()
    parse_errors = serializers.ListField()


# ============================================================
# Разбор вопросов `NEEDS_CONFIRMATION` (legacy, по distribution)
# ============================================================
class DistributionItemSerializer(serializers.Serializer):
    """Одна запись распределения: дата + количество тар."""

    date = serializers.DateField()
    containers_count = serializers.IntegerField(min_value=0)


class QuestionResolutionSerializer(serializers.Serializer):
    """Один разобранный вопрос (legacy)."""

    question_index = serializers.IntegerField(min_value=0)
    distribution = DistributionItemSerializer(
        many=True, allow_empty=False,
    )


class ResolveQuestionsRequestSerializer(serializers.Serializer):
    """Запрос на разбор вопросов (legacy)."""

    resolutions = QuestionResolutionSerializer(
        many=True, allow_empty=False,
    )


class ResolveQuestionsResponseSerializer(serializers.Serializer):
    """Ответ на разбор вопросов (legacy)."""

    import_session_id = serializers.IntegerField()
    status = serializers.CharField()
    created_containers_count = serializers.IntegerField()
    resolved_questions_count = serializers.IntegerField()
    total_questions_count = serializers.IntegerField()
    errors = serializers.ListField()


# ============================================================
# Разбор конфликтов рейса (`receipts/{id}/conflicts/`) — 3b-1
# ============================================================
class ConflictSerializer(serializers.Serializer):
    """
    Неразобранный конфликт `Receipt` с `suggested_count`.

    `suggested_count` — остаток по истории `MATCHED`-строк.
    """

    question_index = serializers.IntegerField()
    code = serializers.CharField()
    title = serializers.CharField()
    reason = serializers.CharField()
    sheet = serializers.CharField()
    work_order = serializers.CharField()
    research_type = serializers.CharField()
    container_type = serializers.CharField()
    containers_count = serializers.IntegerField()
    raw_dates = serializers.ListField(child=serializers.CharField())
    target_date = serializers.CharField()
    message = serializers.CharField()
    suggested_count = serializers.IntegerField()


class ConflictResolutionSerializer(serializers.Serializer):
    """Один ответ кладовщика по конфликту."""

    question_index = serializers.IntegerField(min_value=0)
    containers_count = serializers.IntegerField(min_value=0)


class ResolveConflictsRequestSerializer(serializers.Serializer):
    """Запрос на разбор конфликтов."""

    conflicts = ConflictResolutionSerializer(
        many=True, allow_empty=False,
    )


class ResolveConflictsResponseSerializer(serializers.Serializer):
    """Ответ на разбор конфликтов."""

    receipt_id = serializers.IntegerField()
    created_items_count = serializers.IntegerField()
    resolved_conflicts_count = serializers.IntegerField()
    total_conflicts_count = serializers.IntegerField()
    errors = serializers.ListField()


# ============================================================
# Сверка (`receipts/{id}/check/`) — 3b-2
# ============================================================
class CheckReceiptItemSerializer(serializers.Serializer):
    """Одна отметка сверки."""

    item_id = serializers.IntegerField(min_value=1)
    matched = serializers.BooleanField()
    container_number = serializers.CharField(
        max_length=100,
        required=False,
        allow_blank=True,
        allow_null=True,
        default=None,
    )

    def validate_container_number(self, value):
        if value is None:
            return None
        value = (value or "").strip()
        return value or None


class CheckReceiptRequestSerializer(serializers.Serializer):
    """Запрос на сверку партии."""

    items = CheckReceiptItemSerializer(many=True, allow_empty=False)


class CheckReceiptResponseSerializer(serializers.Serializer):
    """Ответ на сверку партии."""

    receipt_id = serializers.IntegerField()
    total_items_count = serializers.IntegerField()
    matched_count = serializers.IntegerField()
    missing_count = serializers.IntegerField()
    errors = serializers.ListField()


# ============================================================
# Завершение приёмки (`receipts/{id}/complete/`) — 3c
# ============================================================
class CompleteReceiptResponseSerializer(serializers.Serializer):
    """Ответ на завершение приёмки."""

    receipt_id = serializers.IntegerField()
    status = serializers.CharField()
    total_items_count = serializers.IntegerField()
    matched_count = serializers.IntegerField()
    missing_count = serializers.IntegerField()
    other_count = serializers.IntegerField()
    shipment_id = serializers.IntegerField(allow_null=True)
    shipment_status = serializers.CharField(allow_null=True)