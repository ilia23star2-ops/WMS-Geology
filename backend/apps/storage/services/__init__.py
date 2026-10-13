"""Сервисы приложения storage."""

from .bulk_create import bulk_create_containers, fill_container_with_samples

__all__ = ["bulk_create_containers", "fill_container_with_samples"]