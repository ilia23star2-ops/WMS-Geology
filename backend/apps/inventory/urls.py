"""Маршрутизация API приложения inventory."""

from rest_framework.routers import DefaultRouter

from .views import (
    InventoryIssueViewSet,
    InventoryScanViewSet,
    InventorySessionViewSet,
)

router = DefaultRouter()
router.register(
    "inventory-sessions", InventorySessionViewSet, basename="inventory-session"
)
router.register(
    "inventory-scans", InventoryScanViewSet, basename="inventory-scan"
)
router.register(
    "inventory-issues", InventoryIssueViewSet, basename="inventory-issue"
)

urlpatterns = router.urls