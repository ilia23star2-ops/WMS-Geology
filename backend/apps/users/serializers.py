"""
Сериализаторы приложения users.

- LoginSerializer — обёртка над TokenObtainPairSerializer,
  добавляет username и role в ответ.
- UserInfoSerializer — информация о текущем пользователе.
"""

from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


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
        # Дополнительные поля в ответе (не в токене).
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