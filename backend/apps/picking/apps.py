"""Конфигурация приложения picking."""

from django.apps import AppConfig


class PickingConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.picking"
    verbose_name = "Выборка и отправка"