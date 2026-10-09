"""Регистрация моделей receiving в Django Admin."""

from django.contrib import admin

from .models import ImportSession, Receipt, ReceiptItem


class ReceiptItemInline(admin.TabularInline):
    model = ReceiptItem
    extra = 0
    fields = (
        "expected_container_number",
        "actual_container_number",
        "expected_samples_count",
        "actual_samples_count",
        "status",
        "container",
        "work_order",
        "research_type",
        "site",
    )
    readonly_fields = ("status",)


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = (
        "receipt_number", "laboratory", "site",
        "status", "expected_date", "received_at",
    )
    list_filter = ("status", "laboratory", "site")
    search_fields = ("receipt_number", "comment")
    readonly_fields = ("created_at", "imported_at", "received_at")
    inlines = [ReceiptItemInline]


@admin.register(ReceiptItem)
class ReceiptItemAdmin(admin.ModelAdmin):
    list_display = (
        "id", "receipt", "expected_container_number",
        "actual_container_number", "status",
    )
    list_filter = ("status",)
    search_fields = (
        "expected_container_number", "actual_container_number",
        "expected_work_order_number",
    )
    readonly_fields = ("scanned_barcodes",)


@admin.register(ImportSession)
class ImportSessionAdmin(admin.ModelAdmin):
    list_display = (
        "id", "file", "file_format", "status",
        "uploaded_at", "uploaded_by", "receipt",
    )
    list_filter = ("status", "file_format")
    readonly_fields = ("uploaded_at", "parse_errors")