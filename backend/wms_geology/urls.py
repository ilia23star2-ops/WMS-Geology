"""Корневая маршрутизация URL проекта WMS Geology."""

from django.contrib import admin
from django.urls import path

urlpatterns = [
    path("admin/", admin.site.urls),
    # API v1 подключим в следующих заходах
]