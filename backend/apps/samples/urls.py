"""Маршрутизация API приложения samples."""

from rest_framework.routers import DefaultRouter

from .views import (
    LaboratoryViewSet,
    ResearchTypeViewSet,
    SampleViewSet,
    SampleWorkOrderViewSet,
    SiteViewSet,
    WellViewSet,
)

router = DefaultRouter()

# Справочники
router.register("research-types", ResearchTypeViewSet, basename="research-type")
router.register("sites", SiteViewSet, basename="site")
router.register("laboratories", LaboratoryViewSet, basename="laboratory")

# Модели
router.register("wells", WellViewSet, basename="well")
router.register("samples", SampleViewSet, basename="sample")
router.register(
    "sample-work-orders",
    SampleWorkOrderViewSet,
    basename="sample-work-order",
)

urlpatterns = router.urls