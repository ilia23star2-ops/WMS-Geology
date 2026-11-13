from rest_framework import serializers

from apps.storage.serializers import FillSamplesSerializer

from .models import OcrTask, OcrBatch


class OcrTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = OcrTask
        fields = [
            'id', 'batch', 'image', 'status', 'raw_ocr_data',
            'reviewed_data', 'error_message', 'created_at',
        ]
        read_only_fields = [
            'status', 'raw_ocr_data', 'reviewed_data',
            'error_message', 'created_at',
        ]


class OcrBatchSerializer(serializers.ModelSerializer):
    tasks = OcrTaskSerializer(many=True, read_only=True)

    class Meta:
        model = OcrBatch
        fields = [
            'id', 'user', 'cell', 'status',
            'created_at', 'processed_at', 'tasks',
        ]
        read_only_fields = ['user', 'status', 'created_at', 'processed_at']


class OcrApproveSerializer(FillSamplesSerializer):
    """Payload для POST /api/v1/ocr/tasks/{id}/approve/.

    Расширяет FillSamplesSerializer:
    - container_type_id — обязательный (нужен для Container);
    - cell_id — опциональный (если передан, тара сразу размещается).
    """
    container_type_id = serializers.IntegerField(min_value=1)
    cell_id = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None,
    )