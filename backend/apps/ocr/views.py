import subprocess
import json
import os

from django.conf import settings
from rest_framework import generics, status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import OcrTask, OcrBatch
from .serializers import (
    OcrApproveSerializer,
    OcrBatchSerializer,
    OcrTaskSerializer,
    OcrZonesPayloadSerializer,
)
from .services.approve import approve_task


def _dicts_for_mapping():
    """Справочники для mapping и resolve (Site, ResearchType, ContainerType)."""
    from apps.samples.catalogs import Site, ResearchType
    from apps.storage.models import ContainerType

    sites_meta = [
        {"code": s.code, "name": s.name, "match_patterns": s.match_patterns}
        for s in Site.objects.filter(is_active=True)
    ]
    rts_meta = [
        {"code": rt.code, "name": rt.name}
        for rt in ResearchType.objects.filter(is_active=True)
    ]
    cts_meta = [{"name": ct.name} for ct in ContainerType.objects.all()]
    vp = set()
    for s in sites_meta:
        if s.get("code"):
            vp.add(s["code"].upper())
        for pat in (s.get("match_patterns") or []):
            if pat:
                vp.add(pat.upper())
    return sites_meta, rts_meta, cts_meta, vp


def _zone_verdicts(extracted: dict) -> list:
    """Вердикты резолвера по извлечённым полям (6e-4-resolve-3).

    Добавочное поле ответа: старые клиенты могут игнорировать его.
    Для каждой присутствующей зоны спрашиваем resolve.py:
    resolved — однозначное совпадение со справочником,
    needs_input — не найдено или неоднозначно (нужен человек).
    """
    from apps.samples.catalogs import Site, ResearchType
    from apps.work_orders.models import WorkOrder

    from .services.resolve import resolve_by_code, resolve_by_number

    site_codes = tuple(s.code for s in Site.objects.filter(is_active=True) if s.code)
    rt_codes = tuple(rt.code for rt in ResearchType.objects.filter(is_active=True) if rt.code)
    wo_numbers = tuple(w.number for w in WorkOrder.objects.all() if w.number)

    checks = (
        ("site", "site", site_codes, "code"),
        ("research_type", "research_type", rt_codes, "code"),
        ("work_order_incoming", "work_order_incoming", wo_numbers, "number"),
        ("work_order_outgoing", "work_order_outgoing", wo_numbers, "number"),
    )
    verdicts = []
    for zone_type, key, dictionary, kind in checks:
        token = (extracted or {}).get(key)
        if not token:
            continue
        if kind == "code":
            r = resolve_by_code(zone_type, token, dictionary)
        else:
            r = resolve_by_number(zone_type, token, dictionary)
        verdicts.append({
            "zone_type": r.zone_type,
            "raw": r.raw,
            "canonical": r.canonical,
            "value": r.value,
            "resolved": r.resolved,
            "needs_input": r.needs_input,
            "reason": r.reason,
        })
    return verdicts


class OcrRecognizeView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)

        # 5e-2: zones_json — опционально, вместе с image
        zones: list | None = None
        zones_json = request.data.get('zones_json')
        if zones_json:
            try:
                raw_zones = json.loads(zones_json)
            except json.JSONDecodeError as e:
                return Response(
                    {'error': f'Invalid zones_json: {e}'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            zser = OcrZonesPayloadSerializer(data={'zones': raw_zones})
            zser.is_valid(raise_exception=True)
            zones = zser.validated_data['zones']

        # 6e-1a: cell_id идёт в OcrTask, не в OcrBatch
        cell_id = request.data.get('cell_id')
        if cell_id is not None:
            try:
                cell_id = int(cell_id)
            except (ValueError, TypeError):
                return Response(
                    {'error': 'cell_id должен быть числом'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        batch_id = request.data.get('batch_id')
        if batch_id:
            try:
                batch = OcrBatch.objects.get(id=batch_id)
            except OcrBatch.DoesNotExist:
                return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            user = request.user if request.user.is_authenticated else None
            if not user:
                from django.contrib.auth import get_user_model
                user = get_user_model().objects.first()
            # 6e-1a: batch создаётся без cell (cell в task)
            batch = OcrBatch.objects.create(user=user)

        name = (request.data.get('name') or '').strip()
        if not batch.name:
            if name:
                batch.name = name[:120]
            else:
                from apps.storage.models import Cell
                from .services.batch_name import make_batch_name
                addr = Cell.objects.filter(id=cell_id).values_list('full_address', flat=True).first() if cell_id else None
                batch.name = make_batch_name(addr)
            batch.save(update_fields=['name'])
        task = OcrTask.objects.create(batch=batch, image=image_file, cell_id=cell_id)
        if zones is not None:
            task.zones = zones
            task.save(update_fields=['zones'])

        # 6e-2-web-7 (ТД-95): пересчёт extracted по сохранённым зонам.
        from .services.mapping import extract_fields
        sites_meta, rts_meta, cts_meta, vp = _dicts_for_mapping()
        extracted = extract_fields(
            task.zones or [],
            task.raw_ocr_data or {},
            sites=sites_meta,
            research_types=rts_meta,
            container_types=cts_meta,
            valid_prefixes=vp,
        )
        raw = dict(task.raw_ocr_data or {})
        raw["extracted"] = extracted
        task.raw_ocr_data = raw
        task.save(update_fields=["raw_ocr_data"])

        python_exe = r"D:\Dev\python312\python.exe"
        script_path = os.path.join(
            settings.BASE_DIR, "apps", "ocr", "services", "ocr_runner.py",
        )
        image_path = task.image.path

        try:
            result = subprocess.run(
                [python_exe, script_path, image_path],
                capture_output=True, text=True,
                encoding='utf-8', errors='replace',
                timeout=120,
            )
            if result.returncode == 0:
                try:
                    ocr_data = json.loads(result.stdout)
                    # 5e-2: mapping zones + raw_ocr_data → extracted
                    # 6a-fix5a: fuzzy match справочников (site/research_type/container_type)
                    from .services.mapping import extract_fields
                    sites_meta, rts_meta, cts_meta, vp = _dicts_for_mapping()
                    extracted = extract_fields(
                        task.zones or [],
                        ocr_data,
                        sites=sites_meta,
                        research_types=rts_meta,
                        container_types=cts_meta,
                        valid_prefixes=vp,
                    )
                    ocr_data['extracted'] = extracted
                    task.raw_ocr_data = ocr_data
                    task.status = 'READY'
                    task.save()
                    return Response({
                        "status": "success",
                        "task_id": task.id,
                        "batch_id": batch.id,
                        "data": ocr_data,
                        "extracted": extracted,
                        "zone_verdicts": _zone_verdicts(extracted),
                    }, status=status.HTTP_200_OK)
                except json.JSONDecodeError:
                    task.status = 'ERROR'
                    task.error_message = f"Invalid JSON from OCR: {result.stdout[:500]}"
                    task.save()
                    return Response(
                        {"error": task.error_message},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )
            task.status = 'ERROR'
            task.error_message = result.stderr
            task.save()
            return Response(
                {"error": f"OCR failed: {result.stderr}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        except subprocess.TimeoutExpired:
            task.status = 'ERROR'
            task.error_message = "OCR timeout (exceeded 2 minutes)"
            task.save()
            return Response({"error": task.error_message}, status=status.HTTP_504_GATEWAY_TIMEOUT)
        except Exception as e:
            task.status = 'ERROR'
            task.error_message = str(e)
            task.save()
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class OcrBatchListCreateView(generics.ListCreateAPIView):
    serializer_class = OcrBatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return OcrBatch.objects.all().prefetch_related('tasks')
        return OcrBatch.objects.filter(user=user).prefetch_related('tasks')

    def perform_create(self, serializer):
        batch = serializer.save(user=self.request.user, status='DRAFT')
        if not batch.name:
            from .services.batch_name import make_batch_name
            batch.name = make_batch_name(None, batch.created_at.date())
            batch.save(update_fields=['name'])


class OcrBatchDetailView(generics.RetrieveUpdateAPIView):
    """GET + PATCH {status: "SENT"} → sent_at = now (6e-a3)."""
    serializer_class = OcrBatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return OcrBatch.objects.all().prefetch_related('tasks')
        return OcrBatch.objects.filter(user=user).prefetch_related('tasks')

    def update(self, request, *args, **kwargs):
        batch = self.get_object()
        new_name = request.data.get('name')
        if new_name is not None:
            batch.name = str(new_name)[:120]
            batch.save(update_fields=['name'])
            if 'status' not in request.data:
                return Response(OcrBatchSerializer(batch).data)
        new_status = request.data.get('status')
        if new_status != 'SENT':
            return Response(
                {'error': 'PATCH поддерживает только {status: "SENT"}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if batch.status != 'DRAFT':
            return Response(
                {'error': f'Нельзя отправить из статуса {batch.status}'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # 6e-3-backend-4c: нельзя закрыть пакет, пока есть незавершённые фото.
        unfinished = batch.tasks.exclude(status__in=["DONE", "READY"]).count()
        if unfinished:
            return Response(
                {"error": f"Нельзя отправить: незавершённых фото {unfinished}. Дождись распознавания или повтори отправку."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        from django.utils import timezone
        batch.status = 'SENT'
        batch.sent_at = timezone.now()
        batch.save(update_fields=['status', 'sent_at'])
        return Response(OcrBatchSerializer(batch).data)

class OcrTaskDetailView(generics.RetrieveAPIView):
    serializer_class = OcrTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return OcrTask.objects.all()
        return OcrTask.objects.filter(batch__user=user)


class OcrTaskApproveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            if request.user.is_staff or request.user.is_superuser:
                task = OcrTask.objects.get(pk=pk)
            else:
                task = OcrTask.objects.get(pk=pk, batch__user=request.user)
        except OcrTask.DoesNotExist:
            return Response({'error': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        ser = OcrApproveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            result = approve_task(task, dict(ser.validated_data), request.user)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)


class OcrTaskZonesView(APIView):
    """POST /api/v1/ocr/tasks/{id}/zones/ — сохранить разметку зон на фото.

    c-3.x-migration-5e-1. Payload: {"zones": [{type, bbox|rect, source}, ...]}.
    Нельзя менять у задачи в статусе DONE — она уже подтверждена.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            if request.user.is_staff or request.user.is_superuser:
                task = OcrTask.objects.get(pk=pk)
            else:
                task = OcrTask.objects.get(pk=pk, batch__user=request.user)
        except OcrTask.DoesNotExist:
            return Response({'error': 'Задача не найдена.'}, status=status.HTTP_404_NOT_FOUND)

        if task.status == 'DONE':
            return Response(
                {'error': 'Нельзя менять зоны у подтверждённой задачи.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ser = OcrZonesPayloadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        task.zones = ser.validated_data['zones']
        task.save(update_fields=['zones'])

        # 6e-4-resolve-3: пересчёт extracted + вердикты, чтобы web видел
        # свежие значения и подсказки сразу после переразметки зон.
        from .services.mapping import extract_fields
        sites_meta, rts_meta, cts_meta, vp = _dicts_for_mapping()
        extracted = extract_fields(
            task.zones or [],
            task.raw_ocr_data or {},
            sites=sites_meta,
            research_types=rts_meta,
            container_types=cts_meta,
            valid_prefixes=vp,
        )
        raw = dict(task.raw_ocr_data or {})
        raw["extracted"] = extracted
        task.raw_ocr_data = raw
        task.save(update_fields=['raw_ocr_data'])

        return Response(
            {
                'task_id': task.id,
                'zones_count': len(task.zones),
                'extracted': extracted,
                'zone_verdicts': _zone_verdicts(extracted),
            },
            status=status.HTTP_200_OK,
        )