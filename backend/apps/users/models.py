"""
Модели приложения "Пользователи".

- Role — справочник ролей (admin, manager, worker).
- UserProfile — расширение стандартной Django User (OneToOne).
- AuditLog — журнал всех значимых действий.

Стандартная `django.contrib.auth.User` используется как есть —
её поля (username, first_name, last_name, is_active и т.д.)
достаточны для аутентификации. Роль и ФИО — в профиле.

Соответствует docs/DATABASE.md v1.
"""

from django.conf import settings
from django.db import models


class Role(models.Model):
    """Роль пользователя: admin, manager, worker."""

    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Роль"
        verbose_name_plural = "Роли"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class UserProfile(models.Model):
    """
    Профиль пользователя.

    Расширяет стандартную Django User: роль, полное имя,
    служебные timestamp'ы.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.ForeignKey(
        Role,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        help_text="Роль пользователя. NULL — роль не назначена.",
    )
    full_name = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Профиль пользователя"
        verbose_name_plural = "Профили пользователей"
        ordering = ["user__username"]

    def __str__(self) -> str:
        role = self.role.name if self.role else "без роли"
        return f"{self.user.username} ({role})"


class AuditLog(models.Model):
    """
    Журнал действий.

    Фиксирует все значимые события: создание, изменение,
    сканирование, перемещение. Записи не удаляются.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
        help_text="Кто выполнил действие. NULL — системное действие.",
    )
    action = models.CharField(
        max_length=100,
        help_text="Тип действия: SCAN, MOVE, CREATE, UPDATE, DELETE",
    )
    entity_type = models.CharField(
        max_length=50,
        help_text="Тип сущности: Sample, Container, WorkOrder, ...",
    )
    entity_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ID сущности, к которой относится действие",
    )
    old_value = models.JSONField(
        null=True,
        blank=True,
        help_text="Состояние до изменения",
    )
    new_value = models.JSONField(
        null=True,
        blank=True,
        help_text="Состояние после изменения",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Запись аудита"
        verbose_name_plural = "Журнал аудита"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["entity_type", "entity_id"]),
            models.Index(fields=["user", "-created_at"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self) -> str:
        who = self.user.username if self.user else "system"
        return f"{self.created_at:%Y-%m-%d %H:%M} {who}: {self.action} {self.entity_type}#{self.entity_id}"