"""
Модели приложения "Инвентаризация".

- InventorySession — сессия инвентаризации: кто, когда, статус.
- InventoryScan — отдельный скан внутри сессии.

Сканы фиксируют всё, что было отсканировано, даже если проба
не ожидалась в этой ячейке. Это позволяет строить отчёт
по расхождениям (лишнее / отсутствует).

Соответствует docs/DATABASE.md v1.
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
        max_length=50,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )
    started_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_sessions",
        help_text="Кто начал сессию.",
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
    """
    Один скан в рамках сессии инвентаризации.

    Поля:
    - session — сессия;
    - sample — проба (может быть NULL, если отсканировали что-то
      неизвестное — например, чужую тару);
    - scanned_container — тара, которую фактически отсканировали;
    - scanned_qr_code — «сырое» содержимое QR-кода (для аудита);
    - is_expected — ожидалась ли эта проба в этой ячейке по данным
      системы (заполняется при завершении сессии);
    - note — комментарий кладовщика.
    """

    session = models.ForeignKey(
        InventorySession,
        on_delete=models.CASCADE,
        related_name="scans",
    )
    sample = models.ForeignKey(
        Sample,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_scans",
        help_text="NULL — отсканировано что-то, чего нет в системе.",
    )
    scanned_container = models.ForeignKey(
        Container,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="inventory_scans",
    )
    scanned_qr_code = models.TextField(
        blank=True,
        default="",
        help_text="«Сырое» содержимое QR-кода для аудита.",
    )
    scanned_at = models.DateTimeField(auto_now_add=True)
    is_expected = models.BooleanField(
        null=True,
        blank=True,
        help_text="True — ожидалось, False — лишнее. NULL — ещё не рассчитано.",
    )
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