"""
ViewSets приложения movements.

- MoveOperationViewSet — CRUD + custom action `execute`.
- MoveOperationItemViewSet — CRUD.

execute (POST /move-operations/{id}/execute/):
- проверяет status=DRAFT;
- проверяет, что задано целевое место (target_cell или target_floor_room);
- в одной транзакции:
  - для каждого item обновляет адрес pallet/container;
  - item.status = MOVED;
  - move_operation.status = COMPLETED, completed_at = now.
"""

from django.db import transaction
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import MoveOperation, MoveOperationItem
from .serializers import MoveOperationItemSerializer, MoveOperationSerializer


class MoveOperationViewSet(viewsets.ModelViewSet):
    """
    CRUD для операций перемещения.

    Фильтры: ?status=
    Custom:
      - POST /move-operations/{id}/execute/ — выполнить.
    """

    serializer_class = MoveOperationSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = MoveOperation.objects.select_related(
            "target_cell", "target_floor_room", "created_by",
        ).prefetch_related("items").all()
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=["post"])
    def execute(self, request, pk=None):
        """Выполнить операцию: переместить все поддоны/тары в целевое место."""
        op = self.get_object()

        if op.status != MoveOperation.STATUS_DRAFT:
            return Response(
                {"error": "Выполнить можно только операцию в статусе DRAFT."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if op.target_cell is None and op.target_floor_room is None:
            return Response(
                {"error": "Не задано целевое место (target_cell или target_floor_room)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        items = list(op.items.all())
        if not items:
            return Response(
                {"error": "Операция пуста — нет ни одной строки."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        moved = 0
        with transaction.atomic():
            for item in items:
                if item.pallet_id is not None:
                    pallet = item.pallet
                    pallet.cell = op.target_cell
                    pallet.floor_room = op.target_floor_room
                    pallet.save(update_fields=["cell", "floor_room"])
                elif item.container_id is not None:
                    container = item.container
                    container.pallet = None
                    container.floor_room = op.target_floor_room
                    # Если перемещаем тару в ячейку — она должна быть
                    # на поддоне в этой ячейке, но это правило домена,
                    # здесь просто переносим в целевую локацию.
                    container.save(
                        update_fields=["pallet", "floor_room"]
                    )

                item.status = MoveOperationItem.STATUS_MOVED
                item.save(update_fields=["status"])
                moved += 1

            op.status = MoveOperation.STATUS_COMPLETED
            op.completed_at = timezone.now()
            op.save(update_fields=["status", "completed_at"])

        return Response(
            {
                "operation": MoveOperationSerializer(op).data,
                "moved_count": moved,
            }
        )


class MoveOperationItemViewSet(viewsets.ModelViewSet):
    """
    CRUD для строк перемещения.

    Фильтры: ?move_operation_id=, ?status=
    """

    serializer_class = MoveOperationItemSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = MoveOperationItem.objects.select_related(
            "move_operation", "pallet", "container",
            "source_cell", "source_floor_room",
        ).all()
        move_operation_id = self.request.query_params.get("move_operation_id")
        if move_operation_id:
            qs = qs.filter(move_operation_id=move_operation_id)
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs