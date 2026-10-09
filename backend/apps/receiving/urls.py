"""Маршрутизация API приложения receiving."""

from rest_framework.routers import DefaultRouter

from .views import ImportSessionViewSet, ReceiptItemViewSet, ReceiptViewSet

router = DefaultRouter()
router.register("receipts", ReceiptViewSet, basename="receipt")
router.register("receipt-items", ReceiptItemViewSet, basename="receipt-item")
router.register(
    "import-sessions", ImportSessionViewSet, basename="import-session",
)

urlpatterns = router.urls