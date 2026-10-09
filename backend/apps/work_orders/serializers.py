"""
Сериализаторы приложения work_orders.

WorkOrderSerializer — с `site` FK и read-only `site_name`.
WorkOrderLinkSerializer — для custom action `link`.
"""

from rest_framework import serializers

from .models import WorkOrder


class WorkOrderSerializer(serializers.ModelSerializer):
    """Наряд-заказ. Read-only: `site_name`."""

    site_name = serializers.CharField(
        source="site.name", read_only=True, default=None,
    )

    class Meta:
        model = WorkOrder
        fields = [
            "id",
            "order_number",
            "order_type",
            "linked_order",
            "site",
            "site_name",
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