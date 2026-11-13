import subprocess
import json
import os
from django.conf import settings
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from .models import OcrTask, OcrBatch
from .serializers import OcrTaskSerializer

class OcrRecognizeView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        image_file = request.FILES.get('image')
        if not image_file:
            return Response({"error": "No image provided"}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Создаем пакет (батч), если его нет
        batch_id = request.data.get('batch_id')
        if batch_id:
            try:
                batch = OcrBatch.objects.get(id=batch_id)
            except OcrBatch.DoesNotExist:
                return Response({"error": "Batch not found"}, status=status.HTTP_404_NOT_FOUND)
        else:
            # Создаем новый пакет от имени текущего пользователя (или админа)
            user = request.user if request.user.is_authenticated else None
            if not user:
                from django.contrib.auth import get_user_model
                user = get_user_model().objects.first()
            batch = OcrBatch.objects.create(user=user)

        # 2. Сохраняем задачу и картинку
        task = OcrTask.objects.create(batch=batch, image=image_file)
        
        # 3. Запускаем внешний скрипт на портативном Python 3.12
        # ВНИМАНИЕ: путь к портативному питону жестко прописан
        python_exe = r"D:\Dev\python312\python.exe"
        script_path = os.path.join(settings.BASE_DIR, "apps", "ocr", "services", "ocr_runner.py")
        image_path = task.image.path  # Абсолютный путь к сохраненному файлу

        try:
            # Вызываем EasyOCR
            result = subprocess.run(
                [python_exe, script_path, image_path],
                capture_output=True,
                text=True,
                encoding='utf-8',
                errors='replace',
                timeout=120  # Ждем максимум 2 минуты
            )

            if result.returncode == 0:
                # Парсим JSON от EasyOCR
                try:
                    ocr_data = json.loads(result.stdout)
                    task.raw_ocr_data = ocr_data
                    task.status = 'READY'
                    task.save()
                    
                    return Response({
                        "status": "success",
                        "task_id": task.id,
                        "batch_id": batch.id,
                        "data": ocr_data
                    }, status=status.HTTP_200_OK)

                except json.JSONDecodeError:
                    task.status = 'ERROR'
                    task.error_message = f"Invalid JSON from OCR: {result.stdout[:500]}"
                    task.save()
                    return Response({"error": task.error_message}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            else:
                task.status = 'ERROR'
                task.error_message = result.stderr
                task.save()
                return Response({"error": f"OCR failed: {result.stderr}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

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