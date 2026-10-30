"""
Тесты healthcheck-эндпоинта (c-6a).

Эндпоинт используется Mobile-клиентом (c-6c) для auto-detect сети.
Требования: 200 без авторизации, поля status/service/time.
"""

import pytest


@pytest.mark.django_db
def test_health_returns_200_without_auth(client):
    """Healthcheck не требует JWT."""
    response = client.get("/health/")
    assert response.status_code == 200


@pytest.mark.django_db
def test_health_payload_shape(client):
    """Ответ содержит status, service, time."""
    response = client.get("/health/")
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "wms-geology"
    assert "time" in data