"""Маршрутизация API приложения storage."""

from rest_framework.routers import DefaultRouter

from .views import (
    CellViewSet,
    ContainerCommentViewSet,
    ContainerTypeViewSet,
    ContainerViewSet,
    PalletViewSet,
    RackViewSet,
    RoomViewSet,
    SectionViewSet,
    TierViewSet,
)

router = DefaultRouter()

# Справочники
router.register(
    "container-comments", ContainerCommentViewSet, basename="container-comment"
)

# Топология
router.register("rooms", RoomViewSet, basename="room")
router.register("racks", RackViewSet, basename="rack")
router.register("sections", SectionViewSet, basename="section")
router.register("tiers", TierViewSet, basename="tier")
router.register("cells", CellViewSet, basename="cell")
router.register("pallets", PalletViewSet, basename="pallet")
router.register("container-types", ContainerTypeViewSet, basename="container-type")
router.register("containers", ContainerViewSet, basename="container")

urlpatterns = router.urls