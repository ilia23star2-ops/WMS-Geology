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
)
from .services.approve import approve_task


class OcrRecognizeView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)

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
            batch = OcrBatch.objects.create(user=user)

        task = OcrTask.objects.create(batch=batch, image=image_file)

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
                    task.raw_ocr_data = ocr_data
                    task.status = 'READY'
                    task.save()
                    return Response({
                        "status": "success",
                        "task_id": task.id,
                        "batch_id": batch.id,
                        "data": ocr_data,
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
    """GET /api/v1/ocr/batches/ — список; POST — создать черновик батча.

    Свои батчи — все. Staff/superuser — все.
    """
    serializer_class = OcrBatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return OcrBatch.objects.all().prefetch_related('tasks')
        return OcrBatch.objects.filter(user=user).prefetch_related('tasks')

    def perform_create(self, serializer):
        serializer.save(user=self.request.user, status='DRAFT')


class OcrBatchDetailView(generics.RetrieveAPIView):
    """GET /api/v1/ocr/batches/{id}/ — батч + все задачи."""
    serializer_class = OcrBatchSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return OcrBatch.objects.all().prefetch_related('tasks')
        return OcrBatch.objects.filter(user=user).prefetch_related('tasks')


class OcrTaskDetailView(generics.RetrieveAPIView):
    """GET /api/v1/ocr/tasks/{id}/ — задача + image_url + raw_ocr_data."""
    serializer_class = OcrTaskSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff or user.is_superuser:
            return OcrTask.objects.all()
        return OcrTask.objects.filter(batch__user=user)


class OcrTaskApproveView(APIView):
    """POST /api/v1/ocr/tasks/{id}/approve/ — создать Container + Sample.

    Body — OcrApproveSerializer (наследник FillSamplesSerializer +
    container_type_id + cell_id).
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

        ser = OcrApproveSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            result = approve_task(task, dict(ser.validated_data), request.user)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response(result, status=status.HTTP_200_OK)