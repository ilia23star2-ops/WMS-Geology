"""Маршрутизация приложения labels."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LabelConfigView, PrintBatchViewSet

router = DefaultRouter()
router.register("print-batches", PrintBatchViewSet, basename="print-batch")

urlpatterns = [
    path("labels/config/", LabelConfigView.as_view(), name="labels-config"),
    path("", include(router.urls)),
]