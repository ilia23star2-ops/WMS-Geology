"""
Настройка Django Admin для приложения users (ТД-73).

Позволяет управлять ролями и профилями пользователей (включая
привязку к лабораториям) прямо через веб-интерфейс.
"""

from django.contrib import admin

from .models import AccessToken, AuditLog, Role, UserProfile


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("name", "description")
    search_fields = ("name",)


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "role", "laboratory", "full_name", "phone")
    list_filter = ("role", "laboratory")
    search_fields = ("user__username", "full_name", "phone")
    list_select_related = ("user", "role", "laboratory")


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "entity_type", "entity_id", "user", "created_at")
    list_filter = ("action", "entity_type", "created_at")
    search_fields = ("entity_type", "entity_id")
    readonly_fields = (
        "user", "action", "entity_type", "entity_id",
        "old_value", "new_value", "created_at",
    )


@admin.register(AccessToken)
class AccessTokenAdmin(admin.ModelAdmin):
    list_display = ("user", "purpose", "device_id", "expires_at", "is_active")
    list_filter = ("purpose", "revoked_at")
    search_fields = ("user__username", "device_id")
    readonly_fields = ("token_hash", "qr_svg", "created_at", "used_at", "revoked_at")