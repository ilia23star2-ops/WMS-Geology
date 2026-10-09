"""
ViewSets приложения receiving.

- ReceiptViewSet — CRUD + custom actions `confirm`, `cancel`.
- ReceiptItemViewSet — CRUD.
- ImportSessionViewSet — CRUD + custom action `upload`.
"""

from io import BytesIO

from django.core.files.base import ContentFile
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.samples.catalogs import ResearchType

from .models import ImportSession, Receipt, ReceiptItem
from .parsers import parse_excel
from .serializers import (
    ImportSessionSerializer,
    ImportUploadResponseSerializer,
    ReceiptItemSerializer,
    ReceiptSerializer,
)
from .services import apply_import


# ============================================================
# Receipt
# ============================================================
class ReceiptViewSet(viewsets.ModelViewSet):
    """CRUD для партий приёмки + confirm/cancel."""

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


# ============================================================
# ReceiptItem
# ============================================================
class ReceiptItemViewSet(viewsets.ModelViewSet):
    """CRUD для строк приёмки."""

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


# ============================================================
# ImportSession
# ============================================================
class ImportSessionViewSet(viewsets.ModelViewSet):
    """
    CRUD для сессий импорта.

    Фильтры: ?status=
    Custom action:
      - POST /import-sessions/upload/ — загрузить Excel-файл.
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

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        """
        Принять Excel-файл, распарсить, применить импорт.

        Form-data:
        - `file` — обязательный, .xlsx / .xlsm.

        Возвращает:
        - import_session_id, status, counts, parse_errors, receipts.
        """
        file_obj = request.FILES.get("file")
        if not file_obj:
            return Response(
                {"error": "Файл не передан (поле `file`)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = (
            file_obj.name.rsplit(".", 1)[-1].lower()
            if "." in file_obj.name
            else ""
        )
        if ext not in ("xlsx", "xlsm"):
            return Response(
                {"error": "Поддерживаются только .xlsx / .xlsm."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Читаем содержимое ДО сохранения файла (иначе указатель
        # окажется в конце и read() вернёт пусто).
        content = file_obj.read()

        # Создаём ImportSession с копией файла.
        import_session = ImportSession.objects.create(
            file=ContentFile(content, name=file_obj.name),
            file_format=ImportSession.FILE_FORMAT_XLSX,
            uploaded_by=request.user,
        )

        # Парсим.
        try:
            parsed = parse_excel(
                BytesIO(content),
                research_type_codes=set(
                    ResearchType.objects.values_list("code", flat=True)
                ),
            )
        except Exception as exc:
            import_session.status = ImportSession.STATUS_ERROR
            import_session.parse_errors = [
                {"error": f"Ошибка парсинга: {exc}"}
            ]
            import_session.save(update_fields=["status", "parse_errors"])
            return Response(
                {
                    "error": f"Не удалось распарсить файл: {exc}",
                    "import_session_id": import_session.pk,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Применяем.
        receipts, errors = apply_import(parsed, import_session)

        # Формируем ответ.
        import_session.refresh_from_db()
        response_data = {
            "import_session_id": import_session.pk,
            "status": import_session.status,
            "file_format": import_session.file_format,
            "sheets_count": len(parsed.sheets),
            "rows_count": parsed.total_rows,
            "containers_count": parsed.total_containers,
            "parse_errors": errors,
            "receipts": receipts,
        }
        serializer = ImportUploadResponseSerializer(response_data)
        return Response(serializer.data, status=status.HTTP_200_OK)