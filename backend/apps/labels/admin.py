"""
Регистрация моделей labels в админке Django.
"""

from django.contrib import admin

from .models import PrintBatch, PrintBatchItem


class PrintBatchItemInline(admin.TabularInline):
    """Показывает тары внутри партии печати."""
    model = PrintBatchItem
    extra = 0
    raw_id_fields = ("container",)


@admin.register(PrintBatch)
class PrintBatchAdmin(admin.ModelAdmin):
    list_display = (
        "batch_number",
        "print_type",
        "status",
        "total_items",
        "created_by",
        "created_at",
    )
    list_filter = ("status", "print_type")
    search_fields = ("batch_number",)
    readonly_fields = ("created_at", "updated_at")
    inlines = [PrintBatchItemInline]


@admin.register(PrintBatchItem)
class PrintBatchItemAdmin(admin.ModelAdmin):
    list_display = ("batch", "container", "position")
    list_filter = ("batch",)
    raw_id_fields = ("batch", "container")