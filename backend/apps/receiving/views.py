"""
ViewSets приложения receiving.

- ReceiptViewSet — CRUD + custom actions `confirm`, `cancel`,
  `conflicts`, `resolve-conflicts`.
- ReceiptItemViewSet — CRUD.
- ImportSessionViewSet — CRUD + custom actions `upload`, `import-shipment`,
  `resolve-questions` (legacy).
"""

from datetime import date, datetime
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
    ConflictSerializer,
    ImportSessionSerializer,
    ImportUploadResponseSerializer,
    ReceiptItemSerializer,
    ReceiptSerializer,
    ResolveConflictsRequestSerializer,
    ResolveConflictsResponseSerializer,
    ResolveQuestionsRequestSerializer,
    ResolveQuestionsResponseSerializer,
    ShipmentImportResponseSerializer,
)
from .services import (
    apply_import,
    apply_shipment_import,
    count_questions,
    get_unresolved_conflicts,
    resolve_import_questions,
    resolve_receipt_conflicts,
)


# ============================================================
# Вспомогательные
# ============================================================
def _parse_target_date(value) -> date | None:
    """
    Парсинг даты из строки.

    Поддерживаемые форматы:
    - ISO: `YYYY-MM-DD` (`2026-10-12`);
    - русский: `DD.MM.YYYY` (`12.10.2026`).
    """
    if value is None:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


DUPLICATE_ACTIONS = {"cancel", "overwrite", "create"}


# ============================================================
# Receipt
# ============================================================
class ReceiptViewSet(viewsets.ModelViewSet):
    """CRUD для партий приёмки + confirm/cancel/conflicts/resolve-conflicts."""

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

    @action(detail=True, methods=["get"], url_path="conflicts")
    def conflicts(self, request, pk=None):
        """
        Неразобранные конфликты `Receipt`.

        Каждый элемент: поля вопроса + `question_index` +
        `suggested_count` (остаток по истории `MATCHED`).
        """
        receipt = self.get_object()
        items = get_unresolved_conflicts(receipt)
        total, resolved = count_questions(receipt)

        return Response(
            {
                "receipt_id": receipt.pk,
                "conflicts": ConflictSerializer(items, many=True).data,
                "total_conflicts_count": total,
                "resolved_conflicts_count": resolved,
            }
        )

    @action(detail=True, methods=["post"], url_path="resolve-conflicts")
    def resolve_conflicts(self, request, pk=None):
        """
        Разобрать конфликты `Receipt`.

        Тело:
        - `conflicts: [{question_index: int, containers_count: int}]`.

        Создаёт N `ReceiptItem` (без `Container`), помечает вопрос
        `resolved`.
        """
        receipt = self.get_object()
        ser = ResolveConflictsRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        created, errors = resolve_receipt_conflicts(
            receipt, ser.validated_data["conflicts"],
        )

        if errors:
            return Response(
                {"errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        total, resolved = count_questions(receipt)

        return Response(
            ResolveConflictsResponseSerializer({
                "receipt_id": receipt.pk,
                "created_items_count": created,
                "resolved_conflicts_count": resolved,
                "total_conflicts_count": total,
                "errors": [],
            }).data,
            status=status.HTTP_200_OK,
        )


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

    Фильтры: `?status=`, `?receipt_id=`
    Custom actions:
      - POST /import-sessions/upload/          — Excel → Receipt + ReceiptItem.
      - POST /import-sessions/import-shipment/ — Excel → Shipment + Receipt + Container.
      - POST /import-sessions/{id}/resolve-questions/ — legacy.
    """

    serializer_class = ImportSessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = ImportSession.objects.select_related(
            "uploaded_by", "receipt",
        ).all()
        p = self.request.query_params
        status_ = p.get("status")
        if status_:
            qs = qs.filter(status=status_)
        receipt_id = p.get("receipt_id")
        if receipt_id:
            qs = qs.filter(receipt_id=receipt_id)
        return qs

    def perform_create(self, serializer):
        serializer.save(uploaded_by=self.request.user)

    @action(
        detail=False,
        methods=["post"],
        url_path="import-shipment",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_shipment(self, request):
        """Импорт рейса: Shipment INBOUND + Receipt + Container."""
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

        raw_date = request.data.get("target_date")
        target_date = _parse_target_date(raw_date)
        if target_date is None:
            return Response(
                {
                    "error": (
                        "Поле `target_date` обязательно. "
                        "Форматы: `2026-10-14` или `14.10.2026`."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        shipment_number = (
            request.data.get("shipment_number") or ""
        ).strip() or None

        laboratory = None
        laboratory_id = request.data.get("laboratory_id")
        if laboratory_id:
            from apps.samples.catalogs import Laboratory
            laboratory = Laboratory.objects.filter(
                pk=laboratory_id,
            ).first()

        content = file_obj.read()

        import_session = ImportSession.objects.create(
            file=ContentFile(content, name=file_obj.name),
            file_format=ImportSession.FILE_FORMAT_XLSX,
            uploaded_by=request.user,
        )

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

        shipment, errors = apply_shipment_import(
            parsed,
            import_session,
            target_date=target_date,
            laboratory=laboratory,
            shipment_number=shipment_number,
            sent_by=request.user,
        )

        import_session.refresh_from_db()
        containers_count = (
            import_session.receipt.items.count()
            if import_session.receipt is not None
            else 0
        )
        questions_count = sum(
            1 for e in errors if e.get("code") == "NEEDS_CONFIRMATION"
        )

        response_data = {
            "import_session_id": import_session.pk,
            "status": import_session.status,
            "shipment_id": shipment.pk if shipment else None,
            "shipment_number": (
                shipment.shipment_number if shipment else None
            ),
            "receipt_id": (
                import_session.receipt.pk
                if import_session.receipt else None
            ),
            "receipt_number": (
                import_session.receipt.receipt_number
                if import_session.receipt else None
            ),
            "containers_count": containers_count,
            "questions_count": questions_count,
            "parse_errors": errors,
        }
        serializer = ShipmentImportResponseSerializer(response_data)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @action(
        detail=False,
        methods=["post"],
        url_path="upload",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload(self, request):
        """Старый импорт: Excel → Receipt + ReceiptItem."""
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

        raw_date = request.data.get("target_date")
        target_date = _parse_target_date(raw_date)
        if target_date is None:
            return Response(
                {
                    "error": (
                        "Поле `target_date` обязательно. "
                        "Форматы: `2026-10-12` или `12.10.2026`."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        duplicate_action = (
            request.data.get("duplicate_action") or "cancel"
        ).strip().lower()
        if duplicate_action not in DUPLICATE_ACTIONS:
            return Response(
                {
                    "error": (
                        f"Недопустимое `duplicate_action`: "
                        f"{duplicate_action}. Допустимые: "
                        f"{sorted(DUPLICATE_ACTIONS)}."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        content = file_obj.read()

        import_session = ImportSession.objects.create(
            file=ContentFile(content, name=file_obj.name),
            file_format=ImportSession.FILE_FORMAT_XLSX,
            uploaded_by=request.user,
        )

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

        receipts, errors = apply_import(
            parsed,
            import_session,
            target_date=target_date,
            duplicate_action=duplicate_action,
        )

        duplicate_error = next(
            (e for e in errors if e.get("error") == "DUPLICATE_DATE"),
            None,
        )
        if duplicate_error is not None:
            return Response(duplicate_error, status=status.HTTP_409_CONFLICT)

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

    @action(
        detail=True,
        methods=["post"],
        url_path="resolve-questions",
    )
    def resolve_questions(self, request, pk=None):
        """Legacy: разбор вопросов `NEEDS_CONFIRMATION` через distribution."""
        import_session = self.get_object()

        if import_session.status != ImportSession.STATUS_PARSED:
            return Response(
                {
                    "error": (
                        f"Разбор вопросов доступен только в статусе "
                        f"PARSED, сейчас — {import_session.status}."
                    ),
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = ResolveQuestionsRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        created, errors = resolve_import_questions(
            import_session,
            ser.validated_data["resolutions"],
        )

        if errors:
            return Response(
                {"errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        import_session.refresh_from_db()
        parse_errors = import_session.parse_errors or []
        questions = [
            e for e in parse_errors
            if e.get("code") == "NEEDS_CONFIRMATION"
        ]
        resolved = [q for q in questions if q.get("resolved")]

        response_data = {
            "import_session_id": import_session.pk,
            "status": import_session.status,
            "created_containers_count": created,
            "resolved_questions_count": len(resolved),
            "total_questions_count": len(questions),
            "errors": [],
        }
        serializer = ResolveQuestionsResponseSerializer(response_data)
        return Response(serializer.data, status=status.HTTP_200_OK)