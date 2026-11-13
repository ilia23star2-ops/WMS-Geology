from rest_framework import serializers
from .models import OcrTask, OcrBatch

class OcrTaskSerializer(serializers.ModelSerializer):
    class Meta:
        model = OcrTask
        fields = ['id', 'batch', 'image', 'status', 'raw_ocr_data', 'reviewed_data', 'error_message', 'created_at']
        read_only_fields = ['status', 'raw_ocr_data', 'reviewed_data', 'error_message', 'created_at']

class OcrBatchSerializer(serializers.ModelSerializer):
    tasks = OcrTaskSerializer(many=True, read_only=True)
    
    class Meta:
        model = OcrBatch
        fields = ['id', 'user', 'cell', 'status', 'created_at', 'processed_at', 'tasks']
        read_only_fields = ['user', 'status', 'created_at', 'processed_at']