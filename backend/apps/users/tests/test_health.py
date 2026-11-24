"""Тест-контракт healthcheck (пачка sync-fix-5a).

`/health/` — источник серверного времени для инкрементального Pull:
клиент берёт время сервера, а не свои часы (иначе при спешащих часах
мобилки изменения теряются молча).

Поле `time` обязано быть tz-aware ISO 8601 — backend-фильтр
`apply_updated_since` отвергает naive-даты с 400.
"""
from datetime import timedelta

from django.utils import timezone
from django.utils.dateparse import parse_datetime


def test_health_ok_without_auth(client):
    """Эндпоинт жив без авторизации — им пользуется auto-detect сети."""
    resp = client.get('/health/')
    assert resp.status_code == 200
    assert resp.json()['status'] == 'ok'


def test_health_time_is_tz_aware(client):
    """Время сервера пригодно для updated_since (таймзона обязательна)."""
    data = client.get('/health/').json()
    dt = parse_datetime(data['time'])
    assert dt is not None
    assert dt.tzinfo is not None


def test_health_time_close_to_now(client):
    """Отдаётся текущее время, а не заготовка/константа."""
    data = client.get('/health/').json()
    dt = parse_datetime(data['time'])
    assert abs(timezone.now() - dt) < timedelta(minutes=1)


def test_health_service_name(client):
    """Имя сервиса — чтобы клиент не принял за бэкенд чужой health."""
    data = client.get('/health/').json()
    assert data['service'] == 'wms-geology'