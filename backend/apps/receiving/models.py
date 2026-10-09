"""
Модели приложения "Приёмка".

- Receipt — партия (одна машина / один день).
- ReceiptItem — строка партии (одна тара).
- ImportSession — загрузка Excel-файла.

Соответствует docs/DATABASE.md v4.
"""

from django.conf import settings
from django.db import models


class Receipt(models.Model):
    """Партия приёмки."""

    STATUS_EXPECTED = "EXPECTED"
    STATUS_IN_PROGRESS = "IN_PROGRESS"
    STATUS_CONFIRMED = "CONFIRMED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (STATUS_EXPECTED, "Ожидается"),
        (STATUS_IN_PROGRESS, "В работе"),
        (STATUS_CONFIRMED, "Подтверждена"),
        (STATUS_CANCELLED, "Отменена"),
    ]

    receipt_number = models.CharField(max_length=100, unique=True)
    laboratory = models.ForeignKey(
        "samples.Laboratory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipts",
    )
    site = models.ForeignKey(
        "samples.Site",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipts",
    )
    shipment = models.ForeignKey(
        "picking.Shipment",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipts",
        help_text="Рейс-источник (INBOUND), если приёмка из рейса.",
    )
    excel_file = models.FileField(
        upload_to="receipts/",
        null=True,
        blank=True,
    )
    imported_at = models.DateTimeField(null=True, blank=True)
    imported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="imported_receipts",
    )
    received_at = models.DateTimeField(null=True, blank=True)
    received_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="received_receipts",
    )
    expected_date = models.DateField(null=True, blank=True)
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_EXPECTED,
    )
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Партия приёмки"
        verbose_name_plural = "Партии приёмки"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["receipt_number"], name="receipt_number_idx"),
            models.Index(fields=["status"], name="receipt_status_idx"),
            models.Index(fields=["expected_date"], name="receipt_expected_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.receipt_number} ({self.get_status_display()})"


class ReceiptItem(models.Model):
    """Строка партии приёмки (одна тара)."""

    STATUS_EXPECTED = "EXPECTED"
    STATUS_MATCHED = "MATCHED"
    STATUS_DISCREPANCY = "DISCREPANCY"
    STATUS_MISSING = "MISSING"
    STATUS_EXTRA = "EXTRA"
    STATUS_PENDING_DECRYPTION = "PENDING_DECRYPTION"
    STATUS_CHOICES = [
        (STATUS_EXPECTED, "Ожидается"),
        (STATUS_MATCHED, "Совпадает"),
        (STATUS_DISCREPANCY, "Расхождение"),
        (STATUS_MISSING, "Отсутствует"),
        (STATUS_EXTRA, "Лишняя"),
        (STATUS_PENDING_DECRYPTION, "Ожидает расшифровки"),
    ]

    receipt = models.ForeignKey(
        Receipt,
        on_delete=models.CASCADE,
        related_name="items",
    )
    container = models.ForeignKey(
        "storage.Container",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_items",
        help_text="Создаётся при подтверждении приёмки.",
    )

    # --- Ожидаемое (из Excel или QR) ---
    expected_container_number = models.CharField(
        max_length=100, blank=True, default="",
    )
    expected_work_order_number = models.CharField(
        max_length=100, blank=True, default="",
    )
    expected_research_type_code = models.CharField(
        max_length=20, blank=True, default="",
    )
    expected_site_code = models.CharField(
        max_length=50, blank=True, default="",
    )
    expected_samples_count = models.IntegerField(null=True, blank=True)

    # --- Фактическое (при разгрузке) ---
    actual_container_number = models.CharField(
        max_length=100, blank=True, default="",
    )
    actual_samples_count = models.IntegerField(null=True, blank=True)
    scanned_barcodes = models.JSONField(
        default=list,
        blank=True,
        help_text="Список ШК проб, отсканированных при приёмке.",
    )

    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_EXPECTED,
    )

    # --- Ссылки (заполняются при подтверждении) ---
    work_order = models.ForeignKey(
        "work_orders.WorkOrder",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_items",
    )
    research_type = models.ForeignKey(
        "samples.ResearchType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_items",
    )
    site = models.ForeignKey(
        "samples.Site",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="receipt_items",
    )
    note = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Строка приёмки"
        verbose_name_plural = "Строки приёмки"
        ordering = ["receipt", "id"]
        indexes = [
            models.Index(fields=["receipt"], name="receipt_item_receipt_idx"),
            models.Index(fields=["status"], name="receipt_item_status_idx"),
        ]

    def __str__(self) -> str:
        num = self.actual_container_number or self.expected_container_number or "?"
        return f"{self.receipt.receipt_number} / {num}"


class ImportSession(models.Model):
    """Загрузка Excel-файла приёмки."""

    STATUS_PARSING = "PARSING"
    STATUS_PARSED = "PARSED"
    STATUS_ERROR = "ERROR"
    STATUS_APPLIED = "APPLIED"
    STATUS_CHOICES = [
        (STATUS_PARSING, "Парсинг"),
        (STATUS_PARSED, "Распарсен"),
        (STATUS_ERROR, "Ошибка"),
        (STATUS_APPLIED, "Применён"),
    ]

    FILE_FORMAT_XLSX = "XLSX"
    FILE_FORMAT_CSV = "CSV"
    FILE_FORMAT_CHOICES = [
        (FILE_FORMAT_XLSX, "XLSX"),
        (FILE_FORMAT_CSV, "CSV"),
    ]

    file = models.FileField(upload_to="imports/")
    file_format = models.CharField(
        max_length=20, choices=FILE_FORMAT_CHOICES, default=FILE_FORMAT_XLSX,
    )
    uploaded_at = models.DateTimeField(auto_now_add=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_sessions",
    )
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_PARSING,
    )
    parse_errors = models.JSONField(
        default=list,
        blank=True,
        help_text="Список ошибок парсинга (строки, сообщения).",
    )
    receipt = models.ForeignKey(
        Receipt,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="import_sessions",
        help_text="Созданная партия после применения импорта.",
    )

    class Meta:
        verbose_name = "Сессия импорта"
        verbose_name_plural = "Сессии импорта"
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["status"], name="import_session_status_idx"),
        ]

    def __str__(self) -> str:
        name = self.file.name if self.file else "?"
        return f"Импорт #{self.pk} ({name}) — {self.get_status_display()}"