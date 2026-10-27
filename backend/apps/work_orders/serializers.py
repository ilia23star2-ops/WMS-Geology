"""
Сериализаторы приложения work_orders.
"""

from rest_framework import serializers

from .models import WorkOrder


class WorkOrderSerializer(serializers.ModelSerializer):
    """Наряд-заказ. Read-only: `site_name`, `linked_order_number`, `samples_count`, `containers`."""

    site_name = serializers.CharField(
        source="site.name", read_only=True, default=None,
    )
    linked_order_number = serializers.CharField(
        source="linked_order.order_number", read_only=True, default=None,
    )
    samples_count = serializers.SerializerMethodField()
    containers = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "order_number",
            "order_type",
            "linked_order",
            "linked_order_number",
            "site",
            "site_name",
            "status",
            "description",
            "samples_count",
            "containers",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def get_samples_count(self, obj):
        """Количество проб в этом Н/З."""
        # obj.current_samples уже предзагружен через prefetch_related
        return obj.current_samples.count()

    def get_containers(self, obj):
        """
        Список тар с пробами этого Н/З.
        Возвращает уникальные тары и количество проб в каждой.
        """
        containers_dict = {}
        
        # Используем select_related и prefetch_related для оптимизации
        for sample in obj.current_samples.all():
            c = sample.container
            if c.id not in containers_dict:
                location = "—"
                if c.pallet and c.pallet.cell:
                    location = c.pallet.cell.full_address
                elif c.floor_room:
                    location = f"На полу: {c.floor_room.name}"

                containers_dict[c.id] = {
                    "id": c.id,
                    "number": c.container_number,
                    "container_type_name": c.container_type.name if c.container_type else "—",
                    "location": location,
                    "samples_count": 0,
                }
            containers_dict[c.id]["samples_count"] += 1

        return list(containers_dict.values())

    def validate(self, attrs):
        """Нельзя линковать на себя; тип linked_order должен отличаться."""
        instance = self.instance
        linked = attrs.get("linked_order")
        order_type = attrs.get("order_type")

        if instance is not None:
            if linked is None and "linked_order" not in attrs:
                linked = instance.linked_order
            if order_type is None:
                order_type = instance.order_type

        if linked is None:
            return attrs

        if instance is not None and linked.pk == instance.pk:
            raise serializers.ValidationError(
                {"linked_order": "Н/З не может ссылаться на себя."}
            )

        if linked.order_type == order_type:
            raise serializers.ValidationError(
                {
                    "linked_order": (
                        "Связанный Н/З должен быть другого типа: "
                        "INCOMING ↔ CODED."
                    )
                }
            )

        return attrs


class WorkOrderLinkSerializer(serializers.Serializer):
    """Сериализатор для custom action `link`."""

    linked_order_id = serializers.IntegerField()

    def validate_linked_order_id(self, value):
        if not WorkOrder.objects.filter(pk=value).exists():
            raise serializers.ValidationError("WorkOrder с таким id не найден.")
        return value