"""
ViewSets приложения labels.
"""

from django.db import transaction
from django.db.models import Max
from django.http import FileResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import PrintBatch, PrintBatchItem
from .serializers import AddContainersSerializer, PrintBatchSerializer
from .services.label_service import (
    count_pdf_pages,
    render_batch_labels_pdf,
    render_batch_qr_pdf,
)
from .services.print_batch_service import generate_batch_number


class PrintBatchViewSet(viewsets.ModelViewSet):
    """
    CRUD для партий печати (корзины этикеток).

    Особенности:
    - `PUT` и `DELETE` запрещены: только `GET/POST/PATCH`.
      Отмена — через action `cancel` (soft: статус CANCELLED).
    - Номер партии генерируется автоматически.
    - Изменять (PATCH) и наполнять можно только черновик.

    Custom actions:
    - POST /print-batches/{id}/add-containers/
    - POST /print-batches/{id}/remove-container/
    - POST /print-batches/{id}/mark-ready/
    - POST /print-batches/{id}/cancel/
    - GET  /print-batches/{id}/pdf/      (гибрид: авто-пометка)
    - POST /print-batches/{id}/mark-printed/  (ручная пометка)
    """

    serializer_class = PrintBatchSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "head", "options"]

    def get_queryset(self):
        qs = (
            PrintBatch.objects
            .select_related("created_by", "printed_by")
            .prefetch_related("items__container")
            .all()
        )
        p = self.request.query_params
        if p.get("status"):
            qs = qs.filter(status=p["status"])
        if p.get("print_type"):
            qs = qs.filter(print_type=p["print_type"])
        return qs

    def perform_create(self, serializer):
        serializer.save(
            batch_number=generate_batch_number(),
            created_by=self.request.user,
        )

    def update(self, request, *args, **kwargs):
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Изменять можно только партию в статусе «Черновик»."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().update(request, *args, **kwargs)

    # ------------------------------------------------------------
    # Actions: наполнение корзины
    # ------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="add-containers")
    def add_containers(self, request, pk=None):
        """Добавляет список тар в корзину. Только для черновика."""
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Добавлять тары можно только в черновик."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = AddContainersSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        container_ids = ser.validated_data["container_ids"]

        already = set(
            PrintBatchItem.objects
            .filter(batch=batch, container_id__in=container_ids)
            .values_list("container_id", flat=True)
        )
        if already:
            return Response(
                {"error": f"Уже в партии: {sorted(already)}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_pos = (
            PrintBatchItem.objects
            .filter(batch=batch)
            .aggregate(m=Max("position"))["m"]
        ) or 0

        with transaction.atomic():
            for offset, cid in enumerate(container_ids, start=1):
                PrintBatchItem.objects.create(
                    batch=batch,
                    container_id=cid,
                    position=max_pos + offset,
                )
            self._refresh_totals(batch)

        batch = self.get_queryset().get(pk=batch.pk)
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    @action(detail=True, methods=["post"], url_path="remove-container")
    def remove_container(self, request, pk=None):
        """Убирает одну тару из корзины. Только для черновика."""
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Убирать тары можно только из черновика."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        container_id = request.data.get("container_id")
        if not container_id:
            return Response(
                {"error": "Поле container_id обязательно."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted, _ = (
            PrintBatchItem.objects
            .filter(batch=batch, container_id=container_id)
            .delete()
        )
        if not deleted:
            return Response(
                {"error": "Тара не найдена в партии."},
                status=status.HTTP_404_NOT_FOUND,
            )

        self._refresh_totals(batch)

        batch = self.get_queryset().get(pk=batch.pk)
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    @action(detail=True, methods=["post"], url_path="mark-ready")
    def mark_ready(self, request, pk=None):
        """Переводит партию из DRAFT в READY. Требует непустую корзину."""
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Перевести в READY можно только черновик."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not PrintBatchItem.objects.filter(batch=batch).exists():
            return Response(
                {"error": "Партия пуста — нечего печатать."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch.status = PrintBatch.STATUS_READY
        batch.save(update_fields=["status", "updated_at"])
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Отменяет партию (soft-delete). Нельзя отменить напечатанную."""
        batch = self.get_object()
        if batch.status in (
            PrintBatch.STATUS_PRINTED,
            PrintBatch.STATUS_CANCELLED,
        ):
            return Response(
                {"error": f"Нельзя отменить партию в статусе {batch.status}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        batch.status = PrintBatch.STATUS_CANCELLED
        batch.save(update_fields=["status", "updated_at"])
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    # ------------------------------------------------------------
    # Actions: PDF и пометка печати
    # ------------------------------------------------------------
    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """
        Отдаёт PDF партии. Гибридная логика:

        - `DRAFT` → 400 (сначала `mark-ready`).
        - `CANCELLED` → 400.
        - Пустая корзина → 400.
        - `READY` → отдаёт PDF и **автоматически** переводит в
          `PRINTED`: `printed_at=now`, `printed_by=user`,
          `total_items`, `total_pages`.
        - `PRINTED` → отдаёт PDF повторно, но не меняет
          `printed_at`/`printed_by` (первая печать — решающая).

        Ручная пометка для случаев, когда печатали не через
        систему — action `mark-printed`.
        """
        batch = self.get_object()

        if batch.status == PrintBatch.STATUS_CANCELLED:
            return Response(
                {"error": "Нельзя скачать PDF отменённой партии."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if batch.status == PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Переведите партию в READY перед печатью."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not PrintBatchItem.objects.filter(batch=batch).exists():
            return Response(
                {"error": "Партия пуста — нечего печатать."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        buf, pages = self._render_pdf(batch)

        if batch.status == PrintBatch.STATUS_READY:
            batch.status = PrintBatch.STATUS_PRINTED
            batch.printed_at = timezone.now()
            batch.printed_by = request.user
            batch.total_items = (
                PrintBatchItem.objects.filter(batch=batch).count()
            )
            batch.total_pages = pages
            batch.save(update_fields=[
                "status",
                "printed_at",
                "printed_by",
                "total_items",
                "total_pages",
                "updated_at",
            ])

        filename = f"batch-{batch.batch_number}.pdf"
        return FileResponse(
            buf,
            as_attachment=False,
            filename=filename,
            content_type="application/pdf",
        )

    @action(detail=True, methods=["post"], url_path="mark-printed")
    def mark_printed(self, request, pk=None):
        """
        Ручная пометка `READY → PRINTED`.

        Нужна, когда PDF ушёл не через `GET /pdf/` (например,
        печатали из другого инструмента). Считает `total_pages`
        тем же сервисом, что и авто-печать.
        """
        batch = self.get_object()

        if batch.status != PrintBatch.STATUS_READY:
            return Response(
                {"error": "Пометить напечатанной можно только READY."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not PrintBatchItem.objects.filter(batch=batch).exists():
            return Response(
                {"error": "Партия пуста — нечего печатать."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _buf, pages = self._render_pdf(batch)

        batch.status = PrintBatch.STATUS_PRINTED
        batch.printed_at = timezone.now()
        batch.printed_by = request.user
        batch.total_items = PrintBatchItem.objects.filter(batch=batch).count()
        batch.total_pages = pages
        batch.save(update_fields=[
            "status",
            "printed_at",
            "printed_by",
            "total_items",
            "total_pages",
            "updated_at",
        ])

        batch = self.get_queryset().get(pk=batch.pk)
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    # ------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------
    @staticmethod
    def _refresh_totals(batch: PrintBatch) -> None:
        """
        Пересчитывает `total_items` и сохраняет партию.

        Считает через явный queryset, а не через `batch.items.count()`:
        у prefetch-кэша значение устаревает после создания/удаления
        элементов партии.
        """
        batch.total_items = (
            PrintBatchItem.objects.filter(batch=batch).count()
        )
        batch.save(update_fields=["total_items", "updated_at"])

    @staticmethod
    def _render_pdf(batch: PrintBatch):
        """
        Рендерит PDF партии по `print_type`.

        :returns: (BytesIO с PDF, число страниц A4).
        """
        if batch.print_type == PrintBatch.PRINT_TYPE_QR_ONLY:
            buf = render_batch_qr_pdf(batch)
        else:
            buf = render_batch_labels_pdf(batch)
        pages = count_pdf_pages(buf.getvalue())
        return buf, pages