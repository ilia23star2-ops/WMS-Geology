"""
Регистрация моделей work_orders в админке Django.
"""

from django.contrib import admin

from .models import WorkOrder


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "order_number",
        "order_type",
        "site",
        "status",
        "linked_order",
        "created_at",
    )
    list_filter = ("order_type", "status")
    search_fields = ("order_number", "description")
    raw_id_fields = ("linked_order", "site")
    readonly_fields = ("created_at",)
    list_select_related = ("site", "linked_order")
    ordering = ("-created_at",)