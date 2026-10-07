"""
Модели приложения "Выборка" (picking).

- PickList — список выборки (создаёт менеджер).
- PickListItem — одна проба в списке.
- Shipment — отправка в лабораторию.
- ShipmentItem — одна проба в отправке.

Решения (см. docs/DECISIONS.md):
- 1.23 — выборка на уровне пробы, `PickList` + `PickListItem` + `Shipment`.
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
    """Отправка проб в лабораторию."""

    shipment_number = models.CharField(max_length=100, unique=True)
    destination = models.CharField(max_length=200)
    sent_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_shipments",
    )
    sent_at = models.DateTimeField(auto_now_add=True)
    note = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Отправка"
        verbose_name_plural = "Отправки"
        ordering = ["-sent_at"]

    def __str__(self) -> str:
        return f"{self.shipment_number} → {self.destination}"


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