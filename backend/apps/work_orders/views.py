"""
ViewSets приложения work_orders.

- WorkOrderViewSet — CRUD + custom action `link`.
- `link` (POST /work-orders/{id}/link/):
  body: {"linked_order_id": X}
  Связывает текущий Н/З с другим, проверяя тип.
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

    Фильтры: ?order_number=, ?order_type=, ?status=
    """

    serializer_class = WorkOrderSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = WorkOrder.objects.select_related("linked_order").all()
        order_number = self.request.query_params.get("order_number")
        if order_number:
            qs = qs.filter(order_number=order_number)
        order_type = self.request.query_params.get("order_type")
        if order_type:
            qs = qs.filter(order_type=order_type)
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs

    @action(detail=True, methods=["post"])
    def link(self, request, pk=None):
        """
        Связать текущий Н/З с другим.

        Body: {"linked_order_id": X}
        Проверяет, что тип другого Н/З отличается.
        """
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