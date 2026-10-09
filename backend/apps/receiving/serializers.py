"""
Сериализаторы приложения receiving.

- ReceiptSerializer — партия приёмки.
- ReceiptItemSerializer — строка партии.
- ImportSessionSerializer — сессия импорта.
- ImportUploadResponseSerializer — ответ на загрузку Excel.
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
        ]
        read_only_fields = [
            "created_at", "imported_at", "received_at",
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
    """Строка партии (одна тара)."""

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

    class Meta:
        model = ReceiptItem
        fields = [
            "id",
            "receipt",
            "container",
            "container_number",
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
    """Ответ на загрузку Excel-файла."""

    import_session_id = serializers.IntegerField()
    status = serializers.CharField()
    file_format = serializers.CharField()
    sheets_count = serializers.IntegerField()
    rows_count = serializers.IntegerField()
    containers_count = serializers.IntegerField()
    parse_errors = serializers.ListField()
    receipts = ReceiptBriefSerializer(many=True)