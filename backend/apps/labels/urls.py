"""Маршрутизация API приложения labels."""

from rest_framework.routers import DefaultRouter

from .views import PrintBatchViewSet

router = DefaultRouter()

router.register("print-batches", PrintBatchViewSet, basename="print-batch")

urlpatterns = router.urls