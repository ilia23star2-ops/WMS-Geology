"""
Сериализаторы приложения users.

- LoginSerializer — обёртка над TokenObtainPairSerializer,
  добавляет username и role в ответ.
- LogoutRequestSerializer — body для logout (refresh).
- UserInfoSerializer — информация о текущем пользователе (/me).
- AuditLogSerializer — запись журнала аудита (2f-14a).
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import AuditLog


class LoginSerializer(TokenObtainPairSerializer):
    """
    Расширение стандартного TokenObtainPairSerializer.

    Добавляет в ответ:
    - username;
    - role (из UserProfile, если есть);
    - full_name.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["username"] = user.username

        role = None
        if hasattr(user, "profile") and user.profile.role:
            role = user.profile.role.name
        token["role"] = role

        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        data["username"] = self.user.username
        role = None
        full_name = ""
        if hasattr(self.user, "profile"):
            if self.user.profile.role:
                role = self.user.profile.role.name
            full_name = self.user.profile.full_name
        data["role"] = role
        data["full_name"] = full_name
        return data


class LogoutRequestSerializer(serializers.Serializer):
    """Body для POST /auth/logout/."""

    refresh = serializers.CharField(
        help_text="Refresh-токен для отзыва (blacklist).",
    )


class UserInfoSerializer(serializers.Serializer):
    """Ответ GET /auth/me/."""

    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    full_name = serializers.CharField(allow_blank=True)
    role = serializers.CharField(allow_null=True, allow_blank=True)


# ============================================================
# AuditLog (2f-14a)
# ============================================================
class AuditLogSerializer(serializers.ModelSerializer):
    """Запись журнала аудита."""

    username = serializers.SerializerMethodField()
    action_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "username",
            "action",
            "action_display",
            "entity_type",
            "entity_id",
            "old_value",
            "new_value",
            "created_at",
        ]
        read_only_fields = fields

    def get_username(self, obj) -> str | None:
        return obj.user.username if obj.user else None

    def get_action_display(self, obj) -> str:
        labels = {
            "CREATE": "Создана",
            "FILL_SAMPLES": "Заполнена пробами",
            "PLACE": "Размещена",
            "CREATE_IN_CELL": "Создана в ячейке",
            "UPDATE": "Изменена",
            "DELETE": "Удалена",
        }
        return labels.get(obj.action, obj.action)