"""
Healthcheck-эндпоинт (c-6a).

Используется Mobile-клиентом (c-6c) для auto-detect сети:
пинг `127.0.0.1` и `192.168.0.77` без авторизации.
Не обращается к БД — отвечает, пока процесс Django жив.
"""

from django.http import JsonResponse
from django.utils import timezone


def health_view(request):
    """Простой healthcheck без авторизации и без обращения к БД."""
    return JsonResponse({
        "status": "ok",
        "service": "wms-geology",
        "time": timezone.now().isoformat(),
    })