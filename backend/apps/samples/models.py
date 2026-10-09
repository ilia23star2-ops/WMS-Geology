"""
Модели приложения "Пробы" (v3).

- Well — справочник скважин.
- Sample — физическая единица хранения (навеска).
- SampleWorkOrder — M:N-связь пробы с наряд-заказами.

Изменения v3:
- `Sample.research_type` — FK на `ResearchType` (было CharField).
- `Sample.site` — FK на `Site` (было CharField).
"""

from django.conf import settings
from django.db import models

from apps.storage.models import Container
from apps.work_orders.models import WorkOrder

from .catalogs import Laboratory, ResearchType, Site  # noqa: F401


class Well(models.Model):
    """Скважина — источник пробы."""

    well_name = models.CharField(max_length=150)
    field_name = models.CharField(max_length=150, blank=True, default="")
    cluster = models.CharField(max_length=100, blank=True, default="")
    coordinates = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Скважина"
        verbose_name_plural = "Скважины"
        ordering = ["well_name"]

    def __str__(self) -> str:
        return self.well_name


class Sample(models.Model):
    """
    Проба — физическая единица хранения (навеска).

    Одна строка = одна проба с конкретным типом исследования
    в конкретной таре. Номер пробы не уникален.
    """

    STATUS_IN_STORAGE = "IN_STORAGE"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_ISSUED = "ISSUED"
    STATUS_CONSUMED = "CONSUMED"
    STATUS_DISPOSED = "DISPOSED"
    STATUS_PENDING_DECRYPTION = "PENDING_DECRYPTION"
    STATUS_CHOICES = [
        (STATUS_IN_STORAGE, "На хранении"),
        (STATUS_IN_TRANSIT, "В пути"),
        (STATUS_ISSUED, "Выдана"),
        (STATUS_CONSUMED, "Израсходована"),
        (STATUS_DISPOSED, "Утилизирована"),
        (STATUS_PENDING_DECRYPTION, "Ожидает расшифровки"),
    ]

    sample_number = models.CharField(
        max_length=100,
        help_text="Номер пробы. НЕ уникален — может повторяться для разных типов исследования.",
    )
    research_type = models.ForeignKey(
        ResearchType,
        on_delete=models.PROTECT,
        related_name="samples",
    )
    well = models.ForeignKey(
        Well,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="samples",
    )
    depth_from = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
    )
    depth_to = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True,
    )
    site = models.ForeignKey(
        Site,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="samples",
    )
    container = models.ForeignKey(
        Container,
        on_delete=models.PROTECT,
        related_name="samples",
    )
    current_work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_samples",
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default=STATUS_IN_STORAGE,
    )
    qr_code = models.TextField(unique=True, null=True, blank=True)
    legacy_data = models.JSONField(null=True, blank=True)

    disposed_at = models.DateTimeField(null=True, blank=True)
    disposed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="disposed_samples",
    )
    disposal_reason = models.TextField(blank=True, default="")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Проба"
        verbose_name_plural = "Пробы"
        ordering = ["sample_number", "research_type__code"]
        indexes = [
            models.Index(fields=["sample_number"], name="sample_number_idx"),
            models.Index(fields=["container"], name="sample_container_idx"),
            models.Index(fields=["current_work_order"], name="sample_work_order_idx"),
            models.Index(fields=["status"], name="sample_status_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.sample_number} / {self.research_type.code}"


class SampleWorkOrder(models.Model):
    """M:N-связь пробы с наряд-заказами."""

    sample = models.ForeignKey(
        Sample,
        on_delete=models.CASCADE,
        related_name="work_order_links",
    )
    work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.CASCADE,
        related_name="sample_links",
    )
    linked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Связь пробы с Н/З"
        verbose_name_plural = "Связи проб с Н/З"
        ordering = ["-linked_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["sample", "work_order"],
                name="sample_work_order_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sample} ↔ {self.work_order}"