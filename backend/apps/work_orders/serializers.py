"""
Сериализаторы приложения work_orders.

WorkOrderSerializer:
- `linked_order` — ID парного Н/З.
- Валидация: нельзя линковать на себя, тип должен отличаться
  (INCOMING ↔ CODED).
"""

from rest_framework import serializers

from .models import WorkOrder


class WorkOrderSerializer(serializers.ModelSerializer):
    """Наряд-заказ."""

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "order_number",
            "order_type",
            "linked_order",
            "status",
            "description",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def validate(self, attrs):
        """Нельзя линковать на себя; тип linked_order должен отличаться."""
        instance = self.instance
        linked = attrs.get("linked_order")
        order_type = attrs.get("order_type")

        # Для update: если поле не передано — берём из instance.
        if instance is not None:
            if linked is None and "linked_order" not in attrs:
                linked = instance.linked_order
            if order_type is None:
                order_type = instance.order_type

        if linked is None:
            return attrs

        # Нельзя линковать на себя.
        if instance is not None and linked.pk == instance.pk:
            raise serializers.ValidationError(
                {"linked_order": "Н/З не может ссылаться на себя."}
            )

        # Тип должен отличаться: INCOMING ↔ CODED.
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