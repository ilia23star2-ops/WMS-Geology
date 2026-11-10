from django.apps import AppConfig


class PoolConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.pool"
    verbose_name = "Пул (буфер)"