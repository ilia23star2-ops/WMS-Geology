"""
Views приложения users.

- LoginView — POST /api/v1/auth/login/
- LogoutView — POST /api/v1/auth/logout/ (blacklist refresh)
- MeView — GET /api/v1/auth/me/ (текущий пользователь)
- AccessTokenViewSet — CRUD токенов доступа (create / list / revoke)
- CodeLoginView — POST /api/v1/auth/code-login/ (web_login → JWT)
- OfflineLoginView — POST /api/v1/auth/offline-login/ (offline → JWT)

Refresh — стандартный из simplejwt (подключается в urls).
"""

from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import AccessToken
from .serializers import (
    AccessTokenCreateSerializer,
    AccessTokenSerializer,
    CodeLoginSerializer,
    LoginSerializer,
    LogoutRequestSerializer,
    OfflineLoginSerializer,
    UserInfoSerializer,
)
from .services import (
    generate_access_token,
    hash_access_token,
    log_audit,
    make_access_token_qr_svg,
)

# Роли, которым разрешено создавать токены для других пользователей.
_ADMIN_LIKE_ROLES = ("admin", "manager")


def _user_role_name(user) -> str | None:
    if hasattr(user, "profile") and user.profile.role:
        return user.profile.role.name
    return None


def _build_login_response(user) -> dict:
    """Единый ответ для code-login / offline-login (как LoginView)."""
    refresh = RefreshToken.for_user(user)
    role = _user_role_name(user)
    full_name = ""
    if hasattr(user, "profile"):
        full_name = user.profile.full_name
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "username": user.username,
        "role": role,
        "full_name": full_name,
    }


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


# ============================================================
# AccessToken (3.x-offline-auth-a + 3.x-offline-auth-b)
# ============================================================
class AccessTokenViewSet(viewsets.GenericViewSet):
    """
    Токены доступа.

    - POST /auth/access-tokens/ — создать (возвращает raw и qr_svg один раз).
    - GET /auth/access-tokens/ — список своих + созданных мной.
    - POST /auth/access-tokens/{id}/revoke/ — отозвать.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = AccessTokenSerializer

    def get_queryset(self):
        from django.db.models import Q
        user = self.request.user
        return (
            AccessToken.objects
            .select_related("user", "created_by")
            .filter(Q(user=user) | Q(created_by=user))
            .order_by("-created_at")
        )

    @extend_schema(
        request=AccessTokenCreateSerializer,
        responses={201: AccessTokenSerializer},
        description="Создать токен доступа (raw + qr_svg возвращаются один раз).",
    )
    def create(self, request):
        ser = AccessTokenCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        # Кому выдаём
        if data.get("user_id") is not None:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            target = User.objects.filter(pk=data["user_id"]).first()
            if target is None:
                return Response(
                    {"error": f"Пользователь #{data['user_id']} не найден."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            # Создание для другого — только admin / manager
            if target.pk != request.user.pk:
                role = _user_role_name(request.user)
                if role not in _ADMIN_LIKE_ROLES:
                    raise PermissionDenied(
                        "Создавать токены для других пользователей могут только admin или manager."
                    )
        else:
            target = request.user

        try:
            obj, raw = generate_access_token(
                user=target,
                purpose=data["purpose"],
                created_by=request.user,
            )
        except ValueError as exc:
            return Response({"error": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        out = AccessTokenSerializer(obj).data
        out["raw_token"] = raw  # единственный раз
        out["qr_svg"] = make_access_token_qr_svg(obj.purpose, raw)  # 3.x-offline-auth-b
        return Response(out, status=status.HTTP_201_CREATED)

    def list(self, request):
        qs = self.get_queryset()
        return Response(AccessTokenSerializer(qs, many=True).data)

    @action(detail=True, methods=["post"], url_path="revoke")
    def revoke(self, request, pk=None):
        obj = self.get_object()
        # Отзывать может владелец или создатель
        if obj.user_id != request.user.pk and obj.created_by_id != request.user.pk:
            raise PermissionDenied("Нет прав на отзыв этого токена.")
        if obj.revoked_at is None:
            obj.revoked_at = timezone.now()
            obj.save(update_fields=["revoked_at"])
        return Response(AccessTokenSerializer(obj).data)


# ============================================================
# Code-login / Offline-login (3.x-offline-auth-a)
# ============================================================
class CodeLoginView(APIView):
    """
    POST /api/v1/auth/code-login/ — обменять одноразовый код на JWT.

    Код: `purpose=web_login`. После использования сгорает (`used_at`).
    """

    permission_classes = [AllowAny]

    @extend_schema(
        request=CodeLoginSerializer,
        responses={200: OpenApiResponse(description="JWT выдан.")},
        description="Вход по коду (одноразовый).",
    )
    def post(self, request):
        ser = CodeLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        code = ser.validated_data["code"]

        token_hash = hash_access_token(code)
        obj = (
            AccessToken.objects
            .select_related("user")
            .filter(token_hash=token_hash, purpose=AccessToken.PURPOSE_WEB_LOGIN)
            .first()
        )
        if obj is None:
            return Response(
                {"error": "Код не найден."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        now = timezone.now()
        if obj.revoked_at is not None:
            return Response(
                {"error": "Код отозван."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if obj.expires_at <= now:
            return Response(
                {"error": "Код истёк."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if obj.used_at is not None:
            return Response(
                {"error": "Код уже использован."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Гасим код
        obj.used_at = now
        obj.save(update_fields=["used_at"])

        log_audit(
            user=obj.user,
            action="CODE_LOGIN",
            entity_type="AccessToken",
            entity_id=obj.pk,
            new_value={"purpose": obj.purpose, "device_id": None},
        )

        return Response(_build_login_response(obj.user), status=status.HTTP_200_OK)


class OfflineLoginView(APIView):
    """
    POST /api/v1/auth/offline-login/ — обменять offline-токен на JWT.

    Токен: `purpose=offline`. TTL — 14 часов (одна смена + запас,
    3.x-offline-sync-b-0). При первом использовании привязывается к
    `device_id`. Второй `device_id` → 409.
    """

    permission_classes = [AllowAny]

    @extend_schema(
        request=OfflineLoginSerializer,
        responses={200: OpenApiResponse(description="JWT выдан.")},
        description="Офлайн-вход по токену (многоразовый, TTL 14 часов).",
    )
    def post(self, request):
        ser = OfflineLoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        raw = ser.validated_data["token"]
        device_id = ser.validated_data["device_id"]

        token_hash = hash_access_token(raw)
        obj = (
            AccessToken.objects
            .select_related("user")
            .filter(token_hash=token_hash, purpose=AccessToken.PURPOSE_OFFLINE)
            .first()
        )
        if obj is None:
            return Response(
                {"error": "Токен не найден."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        now = timezone.now()
        if obj.revoked_at is not None:
            return Response(
                {"error": "Токен отозван."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if obj.expires_at <= now:
            return Response(
                {"error": "Токен истёк."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Привязка к device_id
        if not obj.device_id:
            obj.device_id = device_id
            obj.save(update_fields=["device_id"])
        elif obj.device_id != device_id:
            return Response(
                {
                    "error": (
                        "Токен уже привязан к другому устройству. "
                        "Сгенерируйте новый QR в офисе."
                    ),
                },
                status=status.HTTP_409_CONFLICT,
            )

        log_audit(
            user=obj.user,
            action="OFFLINE_LOGIN",
            entity_type="AccessToken",
            entity_id=obj.pk,
            new_value={"purpose": obj.purpose, "device_id": device_id},
        )

        return Response(_build_login_response(obj.user), status=status.HTTP_200_OK)