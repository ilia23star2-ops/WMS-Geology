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

from apps.storage.models import Container

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
    """

    serializer_class = PrintBatchSerializer
    permission_classes = [IsAuthenticated]
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

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
        # Разрешаем редактировать название и комментарий в любом статусе (2f-7e).
        # Ограничение на редактирование тар (только DRAFT) проверяется в add-containers.
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        """
        Hard-delete партии (2f-7a).
        """
        batch = self.get_object()
        if batch.status in (
            PrintBatch.STATUS_READY,
            PrintBatch.STATUS_PRINTED,
        ):
            return Response(
                {
                    "error": "Удалить можно только черновик или отменённую "
                             "партию. Сначала отмените её (POST /cancel/)."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        batch.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    # ------------------------------------------------------------
    # Actions: наполнение корзины
    # ------------------------------------------------------------
    @action(detail=True, methods=["post"], url_path="add-containers")
    def add_containers(self, request, pk=None):
        """
        Добавляет список тар в корзину. Только для черновика.
        """
        batch = self.get_object()
        if batch.status != PrintBatch.STATUS_DRAFT:
            return Response(
                {"error": "Добавлять тары можно только в черновик."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = AddContainersSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        container_ids = ser.validated_data["container_ids"]
        force = request.data.get("force", False) is True

        # Проверка на уже напечатанные этикетки
        if not force:
            already_printed = Container.objects.filter(
                pk__in=container_ids, label_printed_at__isnull=False
            ).values_list("id", flat=True)
            
            if already_printed:
                return Response(
                    {
                        "error": "Некоторые тары уже имеют напечатанные этикетки.",
                        "printed_container_ids": list(already_printed),
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

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
            
            # 2f-7d: Обновляем label_printed_at для всех тар
            Container.objects.filter(
                print_batch_items__batch=batch
            ).update(label_printed_at=timezone.now())

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
        
        # 2f-7d: Обновляем label_printed_at для всех тар
        Container.objects.filter(
            print_batch_items__batch=batch
        ).update(label_printed_at=timezone.now())

        batch = self.get_queryset().get(pk=batch.pk)
        return Response(
            PrintBatchSerializer(batch, context={"request": request}).data,
        )

    # ------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------
    @staticmethod
    def _refresh_totals(batch: PrintBatch) -> None:
        """Пересчитывает `total_items` и сохраняет партию."""
        batch.total_items = (
            PrintBatchItem.objects.filter(batch=batch).count()
        )
        batch.save(update_fields=["total_items", "updated_at"])

    @staticmethod
    def _render_pdf(batch: PrintBatch):
        """Рендерит PDF партии по `print_type`."""
        if batch.print_type == PrintBatch.PRINT_TYPE_QR_ONLY:
            buf = render_batch_qr_pdf(batch)
        else:
            buf = render_batch_labels_pdf(batch)
        pages = count_pdf_pages(buf.getvalue())
        return buf, pages