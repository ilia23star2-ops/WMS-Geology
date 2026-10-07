"""Маршрутизация API приложения picking."""

from rest_framework.routers import DefaultRouter

from .views import (
    PickListItemViewSet,
    PickListViewSet,
    ShipmentItemViewSet,
    ShipmentViewSet,
)

router = DefaultRouter()
router.register("pick-lists", PickListViewSet, basename="pick-list")
router.register("pick-items", PickListItemViewSet, basename="pick-item")
router.register("shipments", ShipmentViewSet, basename="shipment")
router.register("shipment-items", ShipmentItemViewSet, basename="shipment-item")

urlpatterns = router.urls