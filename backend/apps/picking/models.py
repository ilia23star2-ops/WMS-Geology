"""
Модели приложения "Выборка" (picking).

- PickList — список выборки.
- PickListItem — строка списка.
- Shipment — отправка (INBOUND или OUTBOUND).
- ShipmentItem — строка отправки.

Изменения v2 (этап 1.3):
- `Shipment.direction` (INBOUND / OUTBOUND).
- `Shipment.laboratory`, `Shipment.site` — FK.
- `Shipment.shipment_date`, `driver_name`, `vehicle_number`.
- Расширенные статусы (DRAFT / ASSEMBLED / SENT / RECEIVED / ...).
- `assembled_at`, `sent_at`, `received_at`, `cancelled_at`,
  `cancelled_by`, `cancel_reason`.
"""

from django.conf import settings
from django.db import models

from apps.samples.models import Sample


class PickList(models.Model):
    """Список выборки — задание на извлечение проб."""

    STATUS_DRAFT = "DRAFT"
    STATUS_ACTIVE = "ACTIVE"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Черновик"),
        (STATUS_ACTIVE, "Активен"),
        (STATUS_COMPLETED, "Завершён"),
        (STATUS_CANCELLED, "Отменён"),
    ]

    pick_list_number = models.CharField(max_length=100, unique=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_pick_lists",
    )
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_DRAFT,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Список выборки"
        verbose_name_plural = "Списки выборки"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status"], name="pick_list_status_idx"),
            models.Index(fields=["-created_at"], name="pick_list_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.pick_list_number} ({self.get_status_display()})"


class PickListItem(models.Model):
    """Одна проба в списке выборки."""

    STATUS_PENDING = "PENDING"
    STATUS_PICKED = "PICKED"
    STATUS_NOT_FOUND = "NOT_FOUND"
    STATUS_SENT = "SENT"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Ожидает"),
        (STATUS_PICKED, "Извлечена"),
        (STATUS_NOT_FOUND, "Не найдена"),
        (STATUS_SENT, "Отправлена"),
    ]

    pick_list = models.ForeignKey(
        PickList, on_delete=models.CASCADE, related_name="items",
    )
    sample = models.ForeignKey(
        Sample, on_delete=models.PROTECT, related_name="pick_items",
    )
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_PENDING,
    )
    picked_at = models.DateTimeField(null=True, blank=True)
    picked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="picked_items",
    )
    note = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Строка выборки"
        verbose_name_plural = "Строки выборки"
        ordering = ["pick_list", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["pick_list", "sample"],
                name="pick_list_item_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.pick_list.pick_list_number} → {self.sample}"


class Shipment(models.Model):
    """
    Отправка.

    Направления:
    - OUTBOUND — мы → лаборатория (по умолчанию).
    - INBOUND — лаборатория → мы.

    Статусы (расширенные в 1.3):
    - DRAFT — собирается (лаборатория).
    - ASSEMBLED — собран, ждёт отправки.
    - SENT — отправлен, в пути.
    - RECEIVED — принят полностью.
    - PARTIALLY_RECEIVED — принят с расхождениями.
    - RETURNED — возвращён.
    - CANCELLED — отменён.
    - LOST — утерян (форс-мажор).
    """

    DIRECTION_OUTBOUND = "OUTBOUND"
    DIRECTION_INBOUND = "INBOUND"
    DIRECTION_CHOICES = [
        (DIRECTION_OUTBOUND, "Исходящая (мы → лаборатория)"),
        (DIRECTION_INBOUND, "Входящая (лаборатория → мы)"),
    ]

    STATUS_DRAFT = "DRAFT"
    STATUS_ASSEMBLED = "ASSEMBLED"
    STATUS_SENT = "SENT"
    STATUS_RECEIVED = "RECEIVED"
    STATUS_PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    STATUS_RETURNED = "RETURNED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_LOST = "LOST"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Черновик"),
        (STATUS_ASSEMBLED, "Собран"),
        (STATUS_SENT, "Отправлен"),
        (STATUS_RECEIVED, "Принят"),
        (STATUS_PARTIALLY_RECEIVED, "Принят с расхождениями"),
        (STATUS_RETURNED, "Возвращён"),
        (STATUS_CANCELLED, "Отменён"),
        (STATUS_LOST, "Утерян"),
    ]

    shipment_number = models.CharField(max_length=100, unique=True)
    direction = models.CharField(
        max_length=20,
        choices=DIRECTION_CHOICES,
        default=DIRECTION_OUTBOUND,
    )
    destination = models.CharField(max_length=200, blank=True, default="")
    laboratory = models.ForeignKey(
        "samples.Laboratory",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipments",
    )
    site = models.ForeignKey(
        "samples.Site",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipments",
    )
    shipment_date = models.DateField(null=True, blank=True)
    driver_name = models.CharField(max_length=200, blank=True, default="")
    vehicle_number = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_SENT,
    )
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_shipments",
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    assembled_at = models.DateTimeField(null=True, blank=True)
    received_at = models.DateTimeField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    cancelled_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cancelled_shipments",
    )
    cancel_reason = models.TextField(blank=True, default="")
    note = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Отправка"
        verbose_name_plural = "Отправки"
        ordering = ["-sent_at"]
        indexes = [
            models.Index(fields=["direction"], name="shipment_direction_idx"),
            models.Index(fields=["status"], name="shipment_status_idx"),
            models.Index(
                fields=["laboratory"], name="shipment_laboratory_idx",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.shipment_number} ({self.get_status_display()})"


class ShipmentItem(models.Model):
    """Одна проба в отправке."""

    shipment = models.ForeignKey(
        Shipment, on_delete=models.CASCADE, related_name="items",
    )
    sample = models.ForeignKey(
        Sample, on_delete=models.PROTECT, related_name="shipment_items",
    )
    pick_list_item = models.ForeignKey(
        PickListItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="shipment_items",
        help_text="Если проба взята из списка выборки.",
    )

    class Meta:
        verbose_name = "Строка отправки"
        verbose_name_plural = "Строки отправки"
        ordering = ["shipment", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["shipment", "sample"],
                name="shipment_item_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.shipment.shipment_number} → {self.sample}"