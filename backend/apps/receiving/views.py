"""
ViewSets приложения receiving.

- ReceiptViewSet — CRUD + custom actions `confirm`, `cancel`.
- ReceiptItemViewSet — CRUD.
- ImportSessionViewSet — CRUD (загрузка Excel).
"""

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import ImportSession, Receipt, ReceiptItem
from .serializers import (
    ImportSessionSerializer,
    ReceiptItemSerializer,
    ReceiptSerializer,
)


class ReceiptViewSet(viewsets.ModelViewSet):
    """
    CRUD для партий приёмки.

    Фильтры: ?status=, ?laboratory_id=, ?site_id=, ?shipment_id=
    Custom actions:
      - POST /receipts/{id}/confirm/ — подтвердить партию.
      - POST /receipts/{id}/cancel/ — отменить.
    """

    serializer_class = ReceiptSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Receipt.objects.select_related(
            "laboratory", "site", "shipment", "imported_by", "received_by",
        ).all()
        p = self.request.query_params

        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("laboratory_id"):
            qs = qs.filter(laboratory_id=p["laboratory_id"])
        if p.get("site_id"):
            qs = qs.filter(site_id=p["site_id"])
        if p.get("shipment_id"):
            qs = qs.filter(shipment_id=p["shipment_id"])

        return qs

    def perform_create(self, serializer):
        serializer.save(imported_by=self.request.user)

    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Подтвердить партию: status=CONFIRMED, received_at=NOW."""
        receipt = self.get_object()
        if receipt.status == Receipt.STATUS_CONFIRMED:
            return Response(
                {"error": "Партия уже подтверждена."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if receipt.status == Receipt.STATUS_CANCELLED:
            return Response(
                {"error": "Нельзя подтвердить отменённую партию."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        receipt.status = Receipt.STATUS_CONFIRMED
        receipt.received_at = timezone.now()
        receipt.received_by = request.user
        receipt.save(update_fields=["status", "received_at", "received_by"])
        return Response(ReceiptSerializer(receipt).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        """Отменить партию: status=CANCELLED."""
        receipt = self.get_object()
        if receipt.status == Receipt.STATUS_CANCELLED:
            return Response(
                {"error": "Партия уже отменена."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if receipt.status == Receipt.STATUS_CONFIRMED:
            return Response(
                {"error": "Нельзя отменить подтверждённую партию."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        receipt.status = Receipt.STATUS_CANCELLED
        receipt.save(update_fields=["status"])
        return Response(ReceiptSerializer(receipt).data)


class ReceiptItemViewSet(viewsets.ModelViewSet):
    """
    CRUD для строк приёмки.

    Фильтры: ?receipt_id=, ?status=, ?container_id=
    """

    serializer_class = ReceiptItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ReceiptItem.objects.select_related(
            "receipt", "container", "work_order",
            "research_type", "site",
        ).all()
        p = self.request.query_params

        if p.get("receipt_id"):
            qs = qs.filter(receipt_id=p["receipt_id"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("container_id"):
            qs = qs.filter(container_id=p["container_id"])

        return qs


class ImportSessionViewSet(viewsets.ModelViewSet):
    """
    CRUD для сессий импорта Excel.

    Фильтры: ?status=
    """

    serializer_class = ImportSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ImportSession.objects.select_related(
            "uploaded_by", "receipt",
        ).all()
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)