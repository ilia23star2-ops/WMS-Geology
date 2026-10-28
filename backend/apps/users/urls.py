"""Маршрутизация auth-эндпоинтов приложения users."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    AccessTokenViewSet,
    CodeLoginView,
    LoginView,
    LogoutView,
    MeView,
    OfflineLoginView,
)

router = DefaultRouter()
router.register("auth/access-tokens", AccessTokenViewSet, basename="access-token")

urlpatterns = [
    path("auth/login/", LoginView.as_view(), name="auth-login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="auth-refresh"),
    path("auth/logout/", LogoutView.as_view(), name="auth-logout"),
    path("auth/me/", MeView.as_view(), name="auth-me"),
    path("auth/code-login/", CodeLoginView.as_view(), name="auth-code-login"),
    path("auth/offline-login/", OfflineLoginView.as_view(), name="auth-offline-login"),
    path("", include(router.urls)),
]