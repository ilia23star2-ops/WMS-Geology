from rest_framework import serializers

from apps.storage.serializers import FillSamplesSerializer

from .models import OcrTask, OcrBatch


class OcrTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = OcrTask
        fields = [
            'id', 'batch', 'image', 'status',
            'raw_ocr_data', 'reviewed_data', 'zones',
            'error_message', 'created_at',
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


class OcrZoneSerializer(serializers.Serializer):
    """Одна размеченная зона на фото."""
    type = serializers.ChoiceField(
        choices=[c[0] for c in OcrTask.ZONE_TYPES],
    )
    bbox = serializers.ListField(
        child=serializers.ListField(
            child=serializers.FloatField(), min_length=2, max_length=2,
        ),
        min_length=4, max_length=4,
        required=False,
    )
    rect = serializers.ListField(
        child=serializers.FloatField(),
        min_length=4, max_length=4,
        required=False,
        help_text="[x, y, w, h] — нормализуется в bbox",
    )
    source = serializers.ChoiceField(
        choices=['manual', 'mlkit'], default='manual',
    )

    def validate(self, data):
        if 'bbox' not in data and 'rect' not in data:
            raise serializers.ValidationError('Нужно передать bbox или rect.')
        if 'rect' in data and 'bbox' not in data:
            x, y, w, h = data['rect']
            if w <= 0 or h <= 0:
                raise serializers.ValidationError('Ширина и высота rect должны быть > 0.')
            data['bbox'] = [
                [x, y], [x + w, y], [x + w, y + h], [x, y + h],
            ]
        data.pop('rect', None)
        return data


class OcrZonesPayloadSerializer(serializers.Serializer):
    """Payload POST /api/v1/ocr/tasks/{id}/zones/."""
    zones = OcrZoneSerializer(many=True, allow_empty=True)