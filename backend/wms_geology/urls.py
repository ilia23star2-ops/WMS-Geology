"""Корневая маршрутизация URL проекта WMS Geology."""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

from wms_geology.health import health_view

urlpatterns = [
    path("admin/", admin.site.urls),

    # Healthcheck (c-6a) — без авторизации, вне /api/v1/,
    # чтобы Mobile мог пинговать без JWT.
    path("health/", health_view, name="health"),

    # OpenAPI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),

    # API v1
    path("api/v1/", include("apps.users.urls")),
    path("api/v1/storage/", include("apps.storage.urls")),
    path("api/v1/labels/", include("apps.labels.urls")),
    path("api/v1/", include("apps.work_orders.urls")),
    path("api/v1/", include("apps.samples.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.picking.urls")),
    path("api/v1/", include("apps.movements.urls")),
    path("api/v1/", include("apps.receiving.urls")),
    path("api/v1/", include("apps.pool.urls")),
    path('api/v1/ocr/', include('apps.ocr.urls')),
]

# ТД-16: Раздача медиафайлов (Excel, PDF) в режиме разработки.
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)