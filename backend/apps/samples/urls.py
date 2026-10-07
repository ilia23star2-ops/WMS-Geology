"""Маршрутизация API приложения samples."""

from rest_framework.routers import DefaultRouter

from .views import SampleViewSet, SampleWorkOrderViewSet, WellViewSet

router = DefaultRouter()
router.register("wells", WellViewSet, basename="well")
router.register("samples", SampleViewSet, basename="sample")
router.register(
    "sample-work-orders",
    SampleWorkOrderViewSet,
    basename="sample-work-order",
)

urlpatterns = router.urls