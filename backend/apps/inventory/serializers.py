"""
Сериализаторы приложения inventory.

- InventorySessionSerializer — сессия инвентаризации.
- InventoryScanSerializer — один скан.
- InventoryIssueSerializer — расхождение.
"""

from rest_framework import serializers

from .models import InventoryIssue, InventoryScan, InventorySession


class InventorySessionSerializer(serializers.ModelSerializer):
    """Сессия инвентаризации."""

    started_by_username = serializers.CharField(
        source="started_by.username", read_only=True, default=None,
    )

    class Meta:
        model = InventorySession
        fields = [
            "id",
            "session_name",
            "status",
            "started_by",
            "started_by_username",
            "started_at",
            "completed_at",
        ]
        read_only_fields = ["started_at", "completed_at"]


class InventoryScanSerializer(serializers.ModelSerializer):
    """Один скан."""

    sample_number = serializers.CharField(
        source="sample.sample_number", read_only=True, default=None,
    )
    container_number = serializers.CharField(
        source="scanned_container.container_number",
        read_only=True,
        default=None,
    )

    class Meta:
        model = InventoryScan
        fields = [
            "id",
            "session",
            "sample",
            "sample_number",
            "scanned_container",
            "container_number",
            "scanned_qr_code",
            "raw_barcode",
            "scanned_at",
            "is_expected",
            "note",
        ]
        read_only_fields = ["scanned_at"]


class InventoryIssueSerializer(serializers.ModelSerializer):
    """Расхождение по итогам сессии."""

    session_name = serializers.CharField(
        source="session.session_name", read_only=True,
    )
    sample_number = serializers.CharField(
        source="sample.sample_number", read_only=True, default=None,
    )
    container_number = serializers.CharField(
        source="container.container_number",
        read_only=True,
        default=None,
    )
    resolved_by_username = serializers.CharField(
        source="resolved_by.username", read_only=True, default=None,
    )

    class Meta:
        model = InventoryIssue
        fields = [
            "id",
            "session",
            "session_name",
            "issue_type",
            "sample",
            "sample_number",
            "container",
            "container_number",
            "expected_value",
            "actual_value",
            "resolution",
            "resolved_at",
            "resolved_by",
            "resolved_by_username",
            "created_at",
        ]
        read_only_fields = ["created_at", "resolved_at", "resolved_by"]