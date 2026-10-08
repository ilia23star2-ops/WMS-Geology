"""Регистрация моделей samples в Django Admin."""

from django.contrib import admin

from .catalogs import Laboratory, ResearchType, Site
from .models import Sample, SampleWorkOrder, Well


@admin.register(ResearchType)
class ResearchTypeAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    ordering = ("sort_order", "code")


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    ordering = ("sort_order", "code")


@admin.register(Laboratory)
class LaboratoryAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "sort_order", "is_active")
    list_filter = ("is_active",)
    search_fields = ("code", "name")
    ordering = ("sort_order", "code")


@admin.register(Well)
class WellAdmin(admin.ModelAdmin):
    list_display = ("well_name", "field_name", "cluster")
    search_fields = ("well_name", "field_name", "cluster")


@admin.register(Sample)
class SampleAdmin(admin.ModelAdmin):
    list_display = (
        "sample_number", "research_type", "container",
        "site", "status",
    )
    list_filter = ("research_type", "status", "site")
    search_fields = ("sample_number", "qr_code")


@admin.register(SampleWorkOrder)
class SampleWorkOrderAdmin(admin.ModelAdmin):
    list_display = ("sample", "work_order", "linked_at")
    list_filter = ("work_order__order_type",)