"""
Views приложения users.

- LoginView — POST /api/v1/auth/login/
- LogoutView — POST /api/v1/auth/logout/ (blacklist refresh)
- MeView — GET /api/v1/auth/me/ (текущий пользователь)

Refresh — стандартный из simplejwt (подключается в urls).
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .serializers import (
    LoginSerializer,
    LogoutRequestSerializer,
    UserInfoSerializer,
)


class LoginView(TokenObtainPairView):
    """POST /api/v1/auth/login/ — выдать access + refresh."""

    serializer_class = LoginSerializer
    permission_classes = [AllowAny]


class LogoutView(APIView):
    """POST /api/v1/auth/logout/ — blacklist refresh-токена."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        request=LogoutRequestSerializer,
        responses={
            200: OpenApiResponse(description="Токен отозван."),
            400: OpenApiResponse(
                description="Ошибка: не передан refresh или токен невалиден."
            ),
        },
        description="Отозвать refresh-токен (blacklist).",
    )
    def post(self, request):
        refresh_token = request.data.get("refresh")
        if not refresh_token:
            return Response(
                {"error": "Поле `refresh` обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
        except Exception as exc:
            return Response(
                {"error": f"Не удалось отозвать токен: {exc}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {"detail": "Токен отозван."}, status=status.HTTP_200_OK
        )


class MeView(APIView):
    """GET /api/v1/auth/me/ — информация о текущем пользователе."""

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={200: UserInfoSerializer},
        description="Информация о текущем пользователе.",
    )
    def get(self, request):
        user = request.user
        role = None
        full_name = ""
        if hasattr(user, "profile"):
            if user.profile.role:
                role = user.profile.role.name
            full_name = user.profile.full_name
        return Response(
            {
                "id": user.pk,
                "username": user.username,
                "email": user.email,
                "full_name": full_name,
                "role": role,
            }
        )