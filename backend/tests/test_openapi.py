"""
Contract-тесты OpenAPI-схемы.

Проверяют:
- схема генерируется без ошибок;
- в схеме присутствуют ключевые эндпоинты из docs/API.md
  (storage, work-orders, samples, inventory, picking, movements, auth);
- доступные теги/группы.
"""

import pytest
from django.urls import reverse


@pytest.fixture
def auth_client(db):
    """Аутентифицированный клиент (нужен для /api/schema/)."""
    from django.contrib.auth.models import User
    from rest_framework.test import APIClient

    user = User.objects.create_user(username="schema_user", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


# ============================================================
# Генерация схемы
# ============================================================
def test_schema_endpoint_responds(auth_client):
    """GET /api/schema/ возвращает 200 и YAML."""
    url = reverse("schema")
    response = auth_client.get(url)
    assert response.status_code == 200


def test_schema_contains_paths(auth_client):
    """В схеме есть ключевые префиксы эндпоинтов."""
    url = reverse("schema")
    response = auth_client.get(url)
    content = response.content.decode("utf-8")

    assert "/api/v1/storage/rooms/" in content
    assert "/api/v1/storage/containers/" in content
    assert "/api/v1/work-orders/" in content
    assert "/api/v1/samples/" in content
    assert "/api/v1/inventory-sessions/" in content
    assert "/api/v1/pick-lists/" in content
    assert "/api/v1/move-operations/" in content
    assert "/api/v1/auth/login/" in content
    assert "/api/v1/auth/refresh/" in content
    assert "/api/v1/auth/logout/" in content


def test_schema_contains_custom_actions(auth_client):
    """В схеме есть custom actions."""
    url = reverse("schema")
    response = auth_client.get(url)
    content = response.content.decode("utf-8")

    # work_orders: link
    assert "/api/v1/work-orders/{id}/link/" in content
    # inventory sessions: complete
    assert "/api/v1/inventory-sessions/{id}/complete/" in content
    # inventory issues: resolve
    assert "/api/v1/inventory-issues/{id}/resolve/" in content
    # picking: activate, complete, pick, add-from-pick-list
    assert "/api/v1/pick-lists/{id}/activate/" in content
    assert "/api/v1/pick-lists/{id}/complete/" in content
    assert "/api/v1/pick-items/{id}/pick/" in content
    assert "/api/v1/shipments/{id}/add-from-pick-list/" in content
    # movements: execute
    assert "/api/v1/move-operations/{id}/execute/" in content


def test_schema_contains_title(auth_client):
    """В схеме указан title из SPECTACULAR_SETTINGS."""
    url = reverse("schema")
    response = auth_client.get(url)
    content = response.content.decode("utf-8")
    assert "WMS Geology API" in content


def test_swagger_ui_responds(client, db):
    """GET /api/docs/ возвращает 200 (UI)."""
    url = reverse("swagger-ui")
    response = client.get(url)
    assert response.status_code == 200


# ============================================================
# Валидность схемы через команду
# ============================================================
def test_schema_validates_with_command(db):
    """`manage.py spectacular --validate` — без ошибок."""
    from io import StringIO
    from django.core.management import call_command

    out = StringIO()
    # Команда не возвращает ошибок, если схема валидна.
    call_command("spectacular", "--validate", stdout=out)
    output = out.getvalue()
    # Если бы схема была невалидной — было бы поднято исключение.
    assert "WMS Geology" in output or output == ""


def test_schema_command_dry_run(db):
    """`manage.py spectacular --file /dev/null` без ошибок."""
    from io import StringIO
    from django.core.management import call_command

    out = StringIO()
    call_command("spectacular", stdout=out)
    content = out.getvalue()
    assert "openapi" in content
    assert "WMS Geology API" in content