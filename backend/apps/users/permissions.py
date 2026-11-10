"""
Кастомные разрешения для контроля доступа по ролям (RBAC).
"""
from rest_framework import permissions


class RolePermission(permissions.BasePermission):
    """Базовый класс для проверки роли пользователя."""
    allowed_roles = []

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
            
        # Суперюзер (admin из Django) всегда проходит
        if request.user.is_superuser:
            return True
            
        profile = getattr(request.user, "profile", None)
        if not profile or not profile.role:
            return False
        return profile.role.name in self.allowed_roles


class IsAdmin(RolePermission):
    """Только администратор."""
    allowed_roles = ("admin",)


class IsManagerOrAdmin(RolePermission):
    """Менеджер или администратор."""
    allowed_roles = ("admin", "manager")


class IsWorkerOrHigher(RolePermission):
    """Кладовщик, менеджер или администратор (без лабораторий)."""
    allowed_roles = ("admin", "manager", "worker")