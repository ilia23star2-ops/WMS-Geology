"""
ViewSets приложения work_orders.

WorkOrderViewSet — CRUD + custom action `link`.
Фильтры: ?order_number=, ?order_type=, ?status=, ?site_id=, ?site_code=
"""

from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import WorkOrder
from .serializers import WorkOrderLinkSerializer, WorkOrderSerializer


class WorkOrderViewSet(viewsets.ModelViewSet):
    """
    CRUD для наряд-заказов.

    Фильтры: ?order_number=, ?order_type=, ?status=, ?site_id=, ?site_code=
    """

    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = WorkOrder.objects.select_related("linked_order", "site").all()
        p = self.request.query_params

        if p.get("order_number"):
            qs = qs.filter(order_number=p["order_number"])
        if p.get("order_type"):
            qs = qs.filter(order_type=p["order_type"])
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("site_id"):
            qs = qs.filter(site_id=p["site_id"])
        if p.get("site_code"):
            qs = qs.filter(site__code=p["site_code"])

        return qs

    @action(detail=True, methods=["post"])
    def link(self, request, pk=None):
        """Связать текущий Н/З с другим."""
        work_order = self.get_object()
        serializer = WorkOrderLinkSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        linked_id = serializer.validated_data["linked_order_id"]

        if linked_id == work_order.pk:
            return Response(
                {"error": "Н/З не может ссылаться на себя."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        linked = get_object_or_404(WorkOrder, pk=linked_id)
        if linked.order_type == work_order.order_type:
            return Response(
                {
                    "error": (
                        "Связанный Н/З должен быть другого типа: "
                        "INCOMING ↔ CODED."
                    )
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        work_order.linked_order = linked
        work_order.save(update_fields=["linked_order"])
        return Response(WorkOrderSerializer(work_order).data)