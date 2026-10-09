"""Корневая маршрутизация URL проекта WMS Geology."""

from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path("admin/", admin.site.urls),

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
    path("api/v1/", include("apps.work_orders.urls")),
    path("api/v1/", include("apps.samples.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.picking.urls")),
    path("api/v1/", include("apps.movements.urls")),
    path("api/v1/", include("apps.receiving.urls")),
]