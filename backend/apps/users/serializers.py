"""
Сериализаторы приложения users.
"""

from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import AccessToken, AuditLog


class LoginSerializer(TokenObtainPairSerializer):
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
    refresh = serializers.CharField()


class UserInfoSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    username = serializers.CharField()
    email = serializers.EmailField(allow_blank=True)
    full_name = serializers.CharField(allow_blank=True)
    role = serializers.CharField(allow_null=True, allow_blank=True)


class AuditLogSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    action_display = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            "id", "user", "username", "action", "action_display",
            "entity_type", "entity_id", "old_value", "new_value", "created_at",
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
            "CODE_LOGIN": "Вход по коду",
            "OFFLINE_LOGIN": "Офлайн-вход",
        }
        return labels.get(obj.action, obj.action)


class AccessTokenSerializer(serializers.ModelSerializer):
    username = serializers.SerializerMethodField()
    purpose_display = serializers.CharField(source="get_purpose_display", read_only=True)
    created_by_username = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    class Meta:
        model = AccessToken
        fields = [
            "id", "user", "username", "purpose", "purpose_display",
            "device_id", "expires_at", "used_at", "revoked_at",
            "is_active", "created_by", "created_by_username", "created_at",
            "qr_svg",
        ]
        read_only_fields = fields

    def get_username(self, obj) -> str | None:
        return obj.user.username if obj.user else None

    def get_created_by_username(self, obj) -> str | None:
        return obj.created_by.username if obj.created_by else None


class AccessTokenCreateSerializer(serializers.Serializer):
    purpose = serializers.ChoiceField(choices=AccessToken.PURPOSE_CHOICES)
    user_id = serializers.IntegerField(required=False, allow_null=True, default=None)


class CodeLoginSerializer(serializers.Serializer):
    code = serializers.CharField(trim_whitespace=True)


class OfflineLoginSerializer(serializers.Serializer):
    token = serializers.CharField(trim_whitespace=True)
    device_id = serializers.CharField(max_length=100, trim_whitespace=True)