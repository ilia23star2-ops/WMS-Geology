"""
Модели приложения "Перемещения" (movements).

- MoveOperation — операция пула перемещений (голова).
- MoveOperationItem — одна строка (поддон или тара).

Решения (см. docs/DECISIONS.md):
- 1.25 — пул перемещений: `MoveOperation` + `MoveOperationItem`.
"""

from django.conf import settings
from django.db import models
from django.db.models import Q

from apps.storage.models import Cell, Container, Pallet, Room


class MoveOperation(models.Model):
    """Операция пула перемещений."""

    STATUS_DRAFT = "DRAFT"
    STATUS_IN_PROGRESS = "IN_PROGRESS"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Черновик"),
        (STATUS_IN_PROGRESS, "В работе"),
        (STATUS_COMPLETED, "Завершена"),
        (STATUS_CANCELLED, "Отменена"),
    ]

    operation_number = models.CharField(max_length=100, unique=True)
    target_cell = models.ForeignKey(
        Cell,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="target_move_operations",
        help_text="Целевая ячейка.",
    )
    target_floor_room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="target_move_operations",
        help_text="Целевая комната (если на пол).",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_move_operations",
    )
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_DRAFT,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Операция перемещения"
        verbose_name_plural = "Операции перемещения"
        ordering = ["-created_at"]
        constraints = [
            models.CheckConstraint(
                condition=~(
                    Q(target_cell__isnull=False) & Q(target_floor_room__isnull=False)
                ),
                name="move_op_target_exclusive",
            ),
        ]
        indexes = [
            models.Index(fields=["status"], name="move_op_status_idx"),
            models.Index(fields=["-created_at"], name="move_op_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.operation_number} ({self.get_status_display()})"


class MoveOperationItem(models.Model):
    """
    Строка операции перемещения.

    Перемещается либо поддон целиком, либо отдельная тара.
    Оба поля заданы одновременно — ошибка.

    Оба NULL — допустимо (например, после удаления поддона:
    строка остаётся как запись в истории, но уже без объекта).
    """

    STATUS_PENDING = "PENDING"
    STATUS_MOVED = "MOVED"
    STATUS_SKIPPED = "SKIPPED"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Ожидает"),
        (STATUS_MOVED, "Перемещён"),
        (STATUS_SKIPPED, "Пропущен"),
    ]

    move_operation = models.ForeignKey(
        MoveOperation, on_delete=models.CASCADE, related_name="items",
    )
    pallet = models.ForeignKey(
        Pallet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="move_items",
    )
    container = models.ForeignKey(
        Container,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="move_items",
    )
    source_cell = models.ForeignKey(
        Cell,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_move_items",
    )
    source_floor_room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="source_move_items",
    )
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_PENDING,
    )

    class Meta:
        verbose_name = "Строка перемещения"
        verbose_name_plural = "Строки перемещения"
        ordering = ["move_operation", "id"]
        constraints = [
            # Запрещено: оба заданы одновременно.
            # Разрешено: одно задано, второе NULL;
            #           оба NULL (история после удаления объекта).
            models.CheckConstraint(
                condition=~(
                    Q(pallet__isnull=False) & Q(container__isnull=False)
                ),
                name="move_item_pallet_xor_container",
            ),
        ]

    def __str__(self) -> str:
        target = self.pallet or self.container or "?"
        return f"{self.move_operation.operation_number} → {target}"