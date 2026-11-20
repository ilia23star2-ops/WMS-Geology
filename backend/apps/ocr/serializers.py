from rest_framework import serializers

from apps.storage.serializers import FillSamplesSerializer

from .models import OcrTask, OcrBatch


class OcrTaskSerializer(serializers.ModelSerializer):
    cell_full_address = serializers.SerializerMethodField()

    class Meta:
        model = OcrTask
        fields = [
            'id', 'batch', 'image', 'status',
            'cell', 'cell_full_address',
            'raw_ocr_data', 'reviewed_data', 'zones',
            'error_message', 'created_at',
        ]
        read_only_fields = [
            'status', 'raw_ocr_data', 'reviewed_data',
            'error_message', 'created_at',
        ]

    def get_cell_full_address(self, obj):
        return obj.cell.full_address if obj.cell_id else None


class OcrBatchSerializer(serializers.ModelSerializer):
    tasks = OcrTaskSerializer(many=True, read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)

    class Meta:
        model = OcrBatch
        fields = [
            'id', 'user', 'username', 'cell', 'name', 'status',
            'sent_at', 'created_at', 'processed_at', 'tasks',
        ]
        read_only_fields = ['user', 'status', 'sent_at', 'created_at', 'processed_at']


class OcrApproveSerializer(FillSamplesSerializer):
    """Payload для POST /api/v1/ocr/tasks/{id}/approve/."""
    container_type_id = serializers.IntegerField(min_value=1)
    cell_id = serializers.IntegerField(
        min_value=1, required=False, allow_null=True, default=None,
    )


class OcrZoneSerializer(serializers.Serializer):
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
    zones = OcrZoneSerializer(many=True, allow_empty=True)