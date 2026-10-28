"""
ViewSets приложения inventory.

- InventorySessionViewSet — сессии + custom action `complete`.
- InventoryScanViewSet — сканы.
- InventoryIssueViewSet — расхождения + custom action `resolve`.
- ActualizationTaskViewSet — задачи на актуализацию + custom action
  `resolve` (3.x-offline-sync-b-2).
"""

from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import (
    ActualizationTask,
    InventoryIssue,
    InventoryScan,
    InventorySession,
)
from .serializers import (
    ActualizationTaskSerializer,
    InventoryIssueSerializer,
    InventoryScanSerializer,
    InventorySessionSerializer,
    ResolveActualizationTaskSerializer,
)


class InventorySessionViewSet(viewsets.ModelViewSet):
    """
    CRUD для сессий инвентаризации.

    Фильтры: ?status=
    Custom: POST /inventory-sessions/{id}/complete/ — завершить.
    """

    serializer_class = InventorySessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InventorySession.objects.select_related("started_by").all()
        status_ = self.request.query_params.get("status")
        if status_:
            qs = qs.filter(status=status_)
        return qs

    def perform_create(self, serializer):
        """При создании — started_by = текущий пользователь."""
        serializer.save(started_by=self.request.user)

    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Завершить сессию: status=COMPLETED, completed_at=NOW."""
        session = self.get_object()
        if session.status == InventorySession.STATUS_COMPLETED:
            return Response(
                {"error": "Сессия уже завершена."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session.status = InventorySession.STATUS_COMPLETED
        session.completed_at = timezone.now()
        session.save(update_fields=["status", "completed_at"])
        return Response(InventorySessionSerializer(session).data)


class InventoryScanViewSet(viewsets.ModelViewSet):
    """
    CRUD для сканов.

    Фильтры: ?session_id=, ?sample_id=, ?is_expected=
    """

    serializer_class = InventoryScanSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InventoryScan.objects.select_related(
            "session", "sample", "scanned_container"
        ).all()
        session_id = self.request.query_params.get("session_id")
        if session_id:
            qs = qs.filter(session_id=session_id)
        sample_id = self.request.query_params.get("sample_id")
        if sample_id:
            qs = qs.filter(sample_id=sample_id)
        is_expected = self.request.query_params.get("is_expected")
        if is_expected is not None:
            qs = qs.filter(
                is_expected=is_expected.lower() in ("1", "true", "yes")
            )
        return qs


class InventoryIssueViewSet(viewsets.ModelViewSet):
    """
    CRUD для расхождений.

    Фильтры: ?session_id=, ?issue_type=, ?resolved=
    Custom: POST /inventory-issues/{id}/resolve/ — разрешить расхождение.
    """

    serializer_class = InventoryIssueSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = InventoryIssue.objects.select_related(
            "session", "sample", "container", "resolved_by"
        ).all()
        session_id = self.request.query_params.get("session_id")
        if session_id:
            qs = qs.filter(session_id=session_id)
        issue_type = self.request.query_params.get("issue_type")
        if issue_type:
            qs = qs.filter(issue_type=issue_type)
        resolved = self.request.query_params.get("resolved")
        if resolved is not None:
            if resolved.lower() in ("1", "true", "yes"):
                qs = qs.exclude(resolved_at__isnull=True)
            else:
                qs = qs.filter(resolved_at__isnull=True)
        return qs

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """Пометить расхождение как разрешённое."""
        issue = self.get_object()
        if issue.resolved_at is not None:
            return Response(
                {"error": "Расхождение уже разрешено."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        resolution = request.data.get("resolution", "").strip()
        if not resolution:
            return Response(
                {"error": "Поле `resolution` обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        issue.resolution = resolution
        issue.resolved_at = timezone.now()
        issue.resolved_by = request.user
        issue.save(update_fields=["resolution", "resolved_at", "resolved_by"])
        return Response(InventoryIssueSerializer(issue).data)


# ============================================================
# ActualizationTask (3.x-offline-sync-b-2)
# ============================================================
class ActualizationTaskViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Задачи на актуализацию данных (mobile ↔ server).

    Read-only + custom action `resolve` — создать задачу может только
    сервер (из offline-импорта), пользователь только разбирает.

    Фильтры: ?resolution=, ?task_type=, ?entity_type=, ?entity_id=
    Custom: POST /actualization-tasks/{id}/resolve/ — разобрать.
    """

    serializer_class = ActualizationTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ActualizationTask.objects.select_related("resolved_by").all()

        resolution = self.request.query_params.get("resolution")
        if resolution:
            qs = qs.filter(resolution=resolution)

        task_type = self.request.query_params.get("task_type")
        if task_type:
            qs = qs.filter(task_type=task_type)

        entity_type = self.request.query_params.get("entity_type")
        if entity_type:
            qs = qs.filter(entity_type=entity_type)

        entity_id = self.request.query_params.get("entity_id")
        if entity_id:
            qs = qs.filter(entity_id=entity_id)

        return qs

    @action(detail=True, methods=["post"])
    def resolve(self, request, pk=None):
        """Разобрать задачу: принять mobile / оставить сервер / отклонить."""
        task = self.get_object()
        if task.resolution != ActualizationTask.RESOLUTION_PENDING:
            return Response(
                {"error": "Задача уже разобрана."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = ResolveActualizationTaskSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        action_value = ser.validated_data["action"]
        note = ser.validated_data.get("note", "")

        mapping = {
            "accept_mobile": ActualizationTask.RESOLUTION_ACCEPT_MOBILE,
            "keep_server": ActualizationTask.RESOLUTION_KEEP_SERVER,
            "reject": ActualizationTask.RESOLUTION_REJECTED,
        }
        task.resolution = mapping[action_value]
        task.resolution_note = note
        task.resolved_by = request.user
        task.resolved_at = timezone.now()
        task.save(update_fields=[
            "resolution", "resolution_note", "resolved_by", "resolved_at",
        ])

        # Применение изменений (accept_mobile / keep_server) — в b-3
        # (offline-imports). Сейчас — только фиксация решения.

        return Response(ActualizationTaskSerializer(task).data)