"""Корневая маршрутизация URL проекта WMS Geology."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/v1/storage/", include("apps.storage.urls")),
    path("api/v1/", include("apps.work_orders.urls")),
    path("api/v1/", include("apps.samples.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.picking.urls")),
    path("api/v1/", include("apps.movements.urls")),
]