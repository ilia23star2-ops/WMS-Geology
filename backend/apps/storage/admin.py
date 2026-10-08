"""Регистрация моделей storage в Django Admin."""

from django.contrib import admin

from .catalogs import ContainerComment
from .models import (
    Cell,
    Container,
    ContainerType,
    Pallet,
    Rack,
    Room,
    Section,
    Tier,
)


@admin.register(ContainerComment)
class ContainerCommentAdmin(admin.ModelAdmin):
    list_display = ("text", "sort_order", "is_active")
    list_filter = ("is_active",)
    ordering = ("sort_order", "text")


@admin.register(Room)
class RoomAdmin(admin.ModelAdmin):
    list_display = ("name",)
    search_fields = ("name",)


@admin.register(Rack)
class RackAdmin(admin.ModelAdmin):
    list_display = ("code", "room")
    list_filter = ("room",)
    search_fields = ("code",)


@admin.register(Section)
class SectionAdmin(admin.ModelAdmin):
    list_display = ("code", "rack", "qr_code")
    list_filter = ("rack",)
    search_fields = ("code",)


@admin.register(Tier)
class TierAdmin(admin.ModelAdmin):
    list_display = ("code", "section", "level_number")
    list_filter = ("section", "code")


@admin.register(Cell)
class CellAdmin(admin.ModelAdmin):
    list_display = ("full_address", "code", "tier", "cell_type", "is_active")
    list_filter = ("cell_type", "is_active", "tier")
    search_fields = ("full_address", "qr_code")


@admin.register(Pallet)
class PalletAdmin(admin.ModelAdmin):
    list_display = ("id", "cell", "floor_room", "pallet_type", "status")
    list_filter = ("pallet_type", "status")


@admin.register(ContainerType)
class ContainerTypeAdmin(admin.ModelAdmin):
    list_display = ("name", "size_class", "max_on_standard_pallet", "is_core")
    list_filter = ("is_core",)


@admin.register(Container)
class ContainerAdmin(admin.ModelAdmin):
    list_display = ("container_number", "container_type", "status", "qr_code")
    list_filter = ("container_type", "status")
    search_fields = ("container_number", "qr_code")