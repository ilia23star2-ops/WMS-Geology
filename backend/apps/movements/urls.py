"""Маршрутизация API приложения movements."""

from rest_framework.routers import DefaultRouter

from .views import MoveOperationItemViewSet, MoveOperationViewSet

router = DefaultRouter()
router.register(
    "move-operations", MoveOperationViewSet, basename="move-operation",
)
router.register(
    "move-operation-items",
    MoveOperationItemViewSet,
    basename="move-operation-item",
)

urlpatterns = router.urls