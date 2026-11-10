from rest_framework import serializers
from .models import Pool, PoolItem


class PoolItemSerializer(serializers.ModelSerializer):
    container_number = serializers.CharField(source="container.container_number", read_only=True, default=None)
    draft_work_order_coded = serializers.CharField(source="container.draft_work_order_coded", read_only=True, default="")
    draft_research_type_name = serializers.CharField(source="container.draft_research_type.name", read_only=True, default=None)
    container_status = serializers.CharField(source="container.status", read_only=True, default=None)
    
    sample_number = serializers.CharField(source="sample.sample_number", read_only=True, default=None)
    sample_status = serializers.CharField(source="sample.status", read_only=True, default=None)
    sample_work_order = serializers.CharField(source="sample.current_work_order.order_number", read_only=True, default=None)
    sample_research_type = serializers.CharField(source="sample.research_type.code", read_only=True, default=None)

    class Meta:
        model = PoolItem
        fields = [
            "id", "pool", "container", "container_number",
            "draft_work_order_coded", "draft_research_type_name", "container_status",
            "sample", "sample_number", "sample_status", "sample_work_order", "sample_research_type", "created_at"
        ]


class PoolSerializer(serializers.ModelSerializer):
    items = PoolItemSerializer(many=True, read_only=True)
    items_count = serializers.IntegerField(source="items.count", read_only=True)

    class Meta:
        model = Pool
        fields = ["id", "user", "items", "items_count", "created_at", "updated_at"]
        read_only_fields = ["user", "created_at", "updated_at"]