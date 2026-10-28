"""Маршрутизация API приложения inventory."""

from rest_framework.routers import DefaultRouter

from .views import (
    ActualizationTaskViewSet,
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
# 3.x-offline-sync-b-2
router.register(
    "actualization-tasks",
    ActualizationTaskViewSet,
    basename="actualization-task",
)

urlpatterns = router.urls