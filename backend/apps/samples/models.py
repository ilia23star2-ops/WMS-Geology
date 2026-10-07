"""
Модели приложения "Пробы".

- Well — справочник скважин.
- Sample — физическая единица хранения (проба в таре с типом исследования).
- SampleWorkOrder — M:N-связь пробы с наряд-заказами.

Ключевые доменные правила (см. docs/DECISIONS.md):
- sample_number НЕ уникален (1.6);
- проба всегда привязана к таре (container);
- связь с Н/З — многие-ко-многим (1.7);
- старые этикетки хранятся в legacy_data (JSONB) (1.8).

Соответствует docs/DATABASE.md v1.
"""

from django.db import models

from apps.storage.models import Container
from apps.work_orders.models import WorkOrder


class Well(models.Model):
    """Скважина — источник пробы."""

    well_name = models.CharField(
        max_length=150,
        help_text="Номер или название скважины",
    )
    field_name = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text="Месторождение / площадь",
    )
    cluster = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Куст",
    )
    coordinates = models.TextField(
        blank=True,
        default="",
        help_text="Координаты (в будущем — PostGIS geography)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Скважина"
        verbose_name_plural = "Скважины"
        ordering = ["well_name"]

    def __str__(self) -> str:
        return self.well_name


class Sample(models.Model):
    """
    Проба — физическая единица хранения.

    Одна строка = одна проба с конкретным типом исследования
    в конкретной таре.

    Номер пробы может повторяться (например, для разных типов
    исследования). Уникальность — по sample_id.
    """

    STATUS_IN_STORAGE = "IN_STORAGE"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_ISSUED = "ISSUED"
    STATUS_CONSUMED = "CONSUMED"
    STATUS_CHOICES = [
        (STATUS_IN_STORAGE, "На хранении"),
        (STATUS_IN_TRANSIT, "В пути"),
        (STATUS_ISSUED, "Выдана"),
        (STATUS_CONSUMED, "Израсходована"),
    ]

    sample_number = models.CharField(
        max_length=100,
        help_text="Номер пробы. НЕ уникален — может повторяться для разных типов исследования.",
    )
    research_type = models.CharField(
        max_length=100,
        help_text="Тип исследования: Шлифы, Химия, Изотопы и т.д.",
    )
    well = models.ForeignKey(
        Well,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="samples",
    )
    depth_from = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    depth_to = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    site = models.CharField(
        max_length=150,
        blank=True,
        default="",
        help_text="Участок",
    )
    container = models.ForeignKey(
        Container,
        on_delete=models.PROTECT,
        related_name="samples",
        help_text="Тара, в которой лежит проба. Обязательна.",
    )
    current_work_order = models.ForeignKey(
        WorkOrder,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="current_samples",
        help_text="Актуальный наряд-заказ для быстрого отображения.",
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default=STATUS_IN_STORAGE,
    )
    qr_code = models.TextField(
        unique=True,
        null=True,
        blank=True,
        help_text="QR-код пробы (опционально).",
    )
    legacy_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Данные старой этикетки (для миграции).",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Проба"
        verbose_name_plural = "Пробы"
        ordering = ["sample_number", "research_type"]
        indexes = [
            models.Index(fields=["sample_number"], name="sample_number_idx"),
            models.Index(fields=["research_type"], name="sample_research_type_idx"),
            models.Index(fields=["container"], name="sample_container_idx"),
            models.Index(fields=["current_work_order"], name="sample_work_order_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.sample_number} / {self.research_type}"


class SampleWorkOrder(models.Model):
    """
    M:N-связь пробы с наряд-заказами.

    Проба относится и к входящему, и к зашифрованному Н/З
    одновременно. Фильтр по любому из них даёт одинаковый набор проб.
    """

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