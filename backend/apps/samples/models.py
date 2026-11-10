"""
РњРѕРґРµР»Рё РїСЂРёР»РѕР¶РµРЅРёСЏ "РџСЂРѕР±С‹" (v5).
"""

from django.conf import settings
from django.db import models

from apps.storage.models import Container
from apps.work_orders.models import WorkOrder

from .catalogs import Laboratory, ResearchType, Site  # noqa: F401


class Well(models.Model):
    """РЎРєРІР°Р¶РёРЅР° вЂ” РёСЃС‚РѕС‡РЅРёРє РїСЂРѕР±С‹."""

    well_name = models.CharField(max_length=150)
    field_name = models.CharField(max_length=150, blank=True, default="")
    cluster = models.CharField(max_length=100, blank=True, default="")
    coordinates = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "РЎРєРІР°Р¶РёРЅР°"
        verbose_name_plural = "РЎРєРІР°Р¶РёРЅС‹"
        ordering = ["well_name"]

    def __str__(self) -> str:
        return self.well_name


class Sample(models.Model):
    """
    РџСЂРѕР±Р° вЂ” С„РёР·РёС‡РµСЃРєР°СЏ РµРґРёРЅРёС†Р° С…СЂР°РЅРµРЅРёСЏ (РЅР°РІРµСЃРєР°).
    """

    STATUS_IN_STORAGE = "IN_STORAGE"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_DISPOSED = "DISPOSED"
    STATUS_PENDING_PLACEMENT = "PENDING_PLACEMENT"
    STATUS_SELECTED = "SELECTED"
    
    STATUS_CHOICES = [
        (STATUS_IN_STORAGE, "РќР° С…СЂР°РЅРµРЅРёРё"),
        (STATUS_IN_TRANSIT, "Р’ РїСѓС‚Рё"),
        (STATUS_DISPOSED, "РЈС‚РёР»РёР·РёСЂРѕРІР°РЅР°"),
        (STATUS_PENDING_PLACEMENT, "РћР¶РёРґР°РµС‚ СЂР°Р·РјРµС‰РµРЅРёСЏ"),
        (STATUS_SELECTED, "Р’С‹Р±СЂР°РЅР°"),
    ]

    sample_number = models.CharField(
        max_length=100,
    help_text="Флаг: проба зашифрована (номер и Н/З изменены).",
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
    is_encrypted = models.BooleanField(
        default=False,
    help_text="Флаг: проба зашифрована (номер и Н/З изменены).",
    )

    # c-2.x-lifecycle-3 (СЂРµС€РµРЅРёРµ 1.119): РїСЂРµРµРјСЃС‚РІРµРЅРЅРѕСЃС‚СЊ. NULL вЂ” РїРµСЂРІРёС‡РЅР°СЏ.
    parent_sample = models.ForeignKey(
        "self",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="returned_as",
    )

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
        verbose_name = "РџСЂРѕР±Р°"
        verbose_name_plural = "РџСЂРѕР±С‹"
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
    """M:N-СЃРІСЏР·СЊ РїСЂРѕР±С‹ СЃ РЅР°СЂСЏРґ-Р·Р°РєР°Р·Р°РјРё."""
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
        verbose_name = "РЎРІСЏР·СЊ РїСЂРѕР±С‹ СЃ Рќ/Р—"
        verbose_name_plural = "РЎРІСЏР·Рё РїСЂРѕР± СЃ Рќ/Р—"
        ordering = ["-linked_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["sample", "work_order"],
                name="sample_work_order_unique",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.sample} в†” {self.work_order}"