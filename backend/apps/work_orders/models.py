"""
Модели приложения work_orders.

Наполняются в заходе fix/1.0-bundle-7 (WorkOrder).
""""""
Модели приложения "Наряд-заказы".

WorkOrder — наряд-заказ. Бывает двух типов:
- INCOMING — название до шифровки;
- CODED — название после шифровки.

Между собой связаны через self-reference `linked_order_id`.

Один входящий Н/З может быть связан с несколькими кодированными
и наоборот. Связь M:N на уровне Н/З, но реализована как
self-reference (см. docs/DECISIONS.md 1.3, вариант A).

Соответствует docs/DATABASE.md v1.
"""

from django.db import models


class WorkOrder(models.Model):
    """Наряд-заказ. Типы: INCOMING, CODED."""

    TYPE_INCOMING = "INCOMING"
    TYPE_CODED = "CODED"
    TYPE_CHOICES = [
        (TYPE_INCOMING, "Входящий"),
        (TYPE_CODED, "Зашифрованный"),
    ]

    STATUS_ACTIVE = "ACTIVE"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Активен"),
        (STATUS_COMPLETED, "Завершён"),
        (STATUS_CANCELLED, "Отменён"),
    ]

    order_number = models.CharField(
        max_length=100,
        help_text="Название Н/З. До или после шифровки — зависит от order_type.",
    )
    order_type = models.CharField(
        max_length=20,
        choices=TYPE_CHOICES,
        help_text="INCOMING — до шифровки, CODED — после.",
    )
    linked_order = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="linked_from",
        help_text="Парный Н/З: для INCOMING — зашифрованный, для CODED — входящий.",
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )
    description = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Наряд-заказ"
        verbose_name_plural = "Наряд-заказы"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["order_number", "order_type"],
                name="work_order_unique_number_type",
            ),
            models.CheckConstraint(
                condition=~models.Q(id=models.F("linked_order_id")),
                name="work_order_not_linked_to_self",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.order_number} ({self.get_order_type_display()})"