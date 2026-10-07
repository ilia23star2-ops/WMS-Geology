"""
Модели приложения "Инвентаризация" (v2).

- InventorySession — сессия инвентаризации.
- InventoryScan — отдельный скан.
- InventoryIssue — расхождение по итогам сессии (NEW в v2).

Изменения v2 (относительно v1):
- InventoryScan.raw_barcode — «сырой» штрих-код (см. 1.27).
- InventoryIssue — модель расхождений (см. 1.28).
"""

from django.conf import settings
from django.db import models

from apps.samples.models import Sample
from apps.storage.models import Container


class InventorySession(models.Model):
    """Сессия инвентаризации."""

    STATUS_ACTIVE = "ACTIVE"
    STATUS_COMPLETED = "COMPLETED"
    STATUS_CANCELLED = "CANCELLED"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Активна"),
        (STATUS_COMPLETED, "Завершена"),
        (STATUS_CANCELLED, "Отменена"),
    ]

    session_name = models.CharField(max_length=100)
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_ACTIVE,
    )
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_sessions",
    )
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Сессия инвентаризации"
        verbose_name_plural = "Сессии инвентаризации"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["status"], name="inv_session_status_idx"),
            models.Index(fields=["-started_at"], name="inv_session_started_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.session_name} ({self.get_status_display()})"


class InventoryScan(models.Model):
    """Один скан в рамках сессии инвентаризации."""

    session = models.ForeignKey(
        InventorySession, on_delete=models.CASCADE, related_name="scans",
    )
    sample = models.ForeignKey(
        Sample,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_scans",
    )
    scanned_container = models.ForeignKey(
        Container,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_scans",
    )
    scanned_qr_code = models.TextField(blank=True, default="")
    raw_barcode = models.TextField(
        blank=True,
        default="",
        help_text="«Сырое» содержимое штрих-кода с этикетки (формат ЛИМС пока неизвестен).",
    )
    scanned_at = models.DateTimeField(auto_now_add=True)
    is_expected = models.BooleanField(null=True, blank=True)
    note = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Скан инвентаризации"
        verbose_name_plural = "Сканы инвентаризации"
        ordering = ["-scanned_at"]
        indexes = [
            models.Index(fields=["session", "-scanned_at"], name="inv_scan_session_idx"),
            models.Index(fields=["sample"], name="inv_scan_sample_idx"),
        ]

    def __str__(self) -> str:
        sample_part = self.sample.sample_number if self.sample else "?"
        return f"[{self.session.session_name}] {sample_part} @ {self.scanned_at:%H:%M:%S}"


class InventoryIssue(models.Model):
    """
    Расхождение по итогам сессии инвентаризации.

    Типы:
    - CONTAINER_MISSING — тары нет физически;
    - CONTAINER_MISPLACED — тара не на своём месте;
    - CONTAINER_EXTRA — лишняя тара (не было в ожиданиях);
    - SAMPLE_MISSING — пробы нет в таре;
    - SAMPLE_STATUS_MISMATCH — статус в БД ≠ физический.
    """

    ISSUE_CONTAINER_MISSING = "CONTAINER_MISSING"
    ISSUE_CONTAINER_MISPLACED = "CONTAINER_MISPLACED"
    ISSUE_CONTAINER_EXTRA = "CONTAINER_EXTRA"
    ISSUE_SAMPLE_MISSING = "SAMPLE_MISSING"
    ISSUE_SAMPLE_STATUS_MISMATCH = "SAMPLE_STATUS_MISMATCH"
    ISSUE_CHOICES = [
        (ISSUE_CONTAINER_MISSING, "Тара отсутствует"),
        (ISSUE_CONTAINER_MISPLACED, "Тара не на своём месте"),
        (ISSUE_CONTAINER_EXTRA, "Лишняя тара"),
        (ISSUE_SAMPLE_MISSING, "Проба отсутствует"),
        (ISSUE_SAMPLE_STATUS_MISMATCH, "Статус пробы не совпадает"),
    ]

    session = models.ForeignKey(
        InventorySession, on_delete=models.CASCADE, related_name="issues",
    )
    issue_type = models.CharField(max_length=50, choices=ISSUE_CHOICES)
    sample = models.ForeignKey(
        Sample,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_issues",
    )
    container = models.ForeignKey(
        Container,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_issues",
    )
    expected_value = models.TextField(blank=True, default="")
    actual_value = models.TextField(blank=True, default="")
    resolution = models.TextField(blank=True, default="")
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="resolved_issues",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Расхождение"
        verbose_name_plural = "Расхождения"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["session", "issue_type"], name="inv_issue_session_type_idx"),
            models.Index(fields=["resolved_at"], name="inv_issue_resolved_idx"),
        ]

    def __str__(self) -> str:
        return f"[{self.session.session_name}] {self.get_issue_type_display()}"