"""
Модели приложения labels.

Модели партии печати этикеток (`PrintBatch`) и её элементов
(`PrintBatchItem`). Генерация QR и PDF выполняется на уровне
сервисов (`services/`).
"""

from django.conf import settings
from django.db import models


class PrintBatch(models.Model):
    """
    Партия печати — «корзина» тар, подготовленная к массовой
    печати.

    Жизненный цикл:
      DRAFT → READY → PRINTED
      (в любой момент до PRINTED можно CANCELLED)

    Soft-delete: отмена через `status = CANCELLED`. Записи не
    удаляются физически.
    """

    PRINT_TYPE_LABELS = "LABELS"
    PRINT_TYPE_QR_ONLY = "QR_ONLY"
    PRINT_TYPE_CHOICES = [
        (PRINT_TYPE_LABELS, "Этикетки"),
        (PRINT_TYPE_QR_ONLY, "Только QR"),
    ]

    STATUS_DRAFT = "DRAFT"
    STATUS_READY = "READY"
    STATUS_PRINTED = "PRINTED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Черновик"),
        (STATUS_READY, "Готов к печати"),
        (STATUS_PRINTED, "Напечатан"),
        (STATUS_CANCELLED, "Отменён"),
    ]

    batch_number = models.CharField(
        max_length=100,
        unique=True,
        help_text="Номер партии печати, например ПЕЧ-2026-001.",
    )
    print_type = models.CharField(
        max_length=20,
        choices=PRINT_TYPE_CHOICES,
        default=PRINT_TYPE_LABELS,
        help_text="Что печатаем: полные этикетки или только QR.",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default=STATUS_DRAFT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_print_batches",
        help_text="Кто создал партию печати.",
    )
    printed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Когда партия была напечатана.",
    )
    printed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="printed_print_batches",
        help_text="Кто напечатал партию.",
    )
    total_items = models.IntegerField(
        default=0,
        help_text="Сколько тар в партии (снимок на момент печати).",
    )
    total_pages = models.IntegerField(
        default=0,
        help_text="Сколько листов A4 требуется (снимок на момент печати).",
    )
    comment = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Партия печати"
        verbose_name_plural = "Партии печати"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.batch_number


class PrintBatchItem(models.Model):
    """
    Элемент партии печати — одна тара в корзине.

    Уникальность: одна тара не может дважды попасть в одну партию.
    При удалении партии элементы удаляются каскадом.
    Тара защищена от удаления (`PROTECT`), пока фигурирует в
    партии печати.
    """

    batch = models.ForeignKey(
        PrintBatch,
        on_delete=models.CASCADE,
        related_name="items",
    )
    container = models.ForeignKey(
        "storage.Container",
        on_delete=models.PROTECT,
        related_name="print_batch_items",
    )
    position = models.IntegerField(
        default=0,
        help_text="Порядок тары в партии (для стабильной раскладки).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Элемент партии печати"
        verbose_name_plural = "Элементы партии печати"
        ordering = ["batch", "position", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["batch", "container"],
                name="print_batch_item_unique_batch_container",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.batch.batch_number} / {self.container.container_number}"