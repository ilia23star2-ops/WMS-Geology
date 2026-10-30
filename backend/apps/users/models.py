import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone


class Role(models.Model):
    name = models.CharField(max_length=50, unique=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "roles"
        ordering = ["name"]

    def __str__(self):
        return self.name


class UserProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    role = models.ForeignKey(
        Role, on_delete=models.SET_NULL, null=True, blank=True
    )
    full_name = models.CharField(max_length=200, blank=True)
    phone = models.CharField(max_length=50, blank=True)

    class Meta:
        db_table = "user_profiles"

    def __str__(self):
        role_name = self.role.name if self.role else "без роли"
        return f"{self.user.username} ({role_name})"


class AuditLog(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )
    action = models.CharField(max_length=50)
    entity_type = models.CharField(max_length=50)
    entity_id = models.IntegerField(null=True, blank=True)
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "audit_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.action} {self.entity_type}#{self.entity_id}"


class AccessToken(models.Model):
    PURPOSE_WEB_LOGIN = "web_login"
    PURPOSE_OFFLINE = "offline"
    PURPOSE_CHOICES = [
        (PURPOSE_WEB_LOGIN, "Вход в web"),
        (PURPOSE_OFFLINE, "Офлайн"),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="access_tokens",
    )
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    token_hash = models.CharField(max_length=128, unique=True, db_index=True)
    device_id = models.CharField(max_length=100, blank=True, default="")
    expires_at = models.DateTimeField()
    used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_access_tokens",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    # SVG QR-код (сохраняем, чтобы можно было показать повторно)
    qr_svg = models.TextField(blank=True, default="")

    class Meta:
        db_table = "access_tokens"
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.purpose} для {self.user.username}"

    @property
    def is_active(self) -> bool:
        if self.revoked_at is not None:
            return False
        if self.expires_at <= timezone.now():
            return False
        if self.purpose == self.PURPOSE_WEB_LOGIN and self.used_at is not None:
            return False
        return True