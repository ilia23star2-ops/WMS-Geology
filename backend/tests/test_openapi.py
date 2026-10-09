"""
Contract-тесты OpenAPI-схемы.
"""

import pytest
from django.urls import reverse


@pytest.fixture
def auth_client(db):
    from django.contrib.auth.models import User
    from rest_framework.test import APIClient

    user = User.objects.create_user(username="schema_user", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def test_schema_endpoint_responds(auth_client):
    url = reverse("schema")
    response = auth_client.get(url)
    assert response.status_code == 200


def test_schema_contains_paths(auth_client):
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
    # Приёмка
    assert "/api/v1/receipts/" in content
    assert "/api/v1/receipt-items/" in content
    assert "/api/v1/import-sessions/" in content


def test_schema_contains_custom_actions(auth_client):
    url = reverse("schema")
    response = auth_client.get(url)
    content = response.content.decode("utf-8")

    assert "/api/v1/work-orders/{id}/link/" in content
    assert "/api/v1/inventory-sessions/{id}/complete/" in content
    assert "/api/v1/inventory-issues/{id}/resolve/" in content
    assert "/api/v1/pick-lists/{id}/activate/" in content
    assert "/api/v1/pick-lists/{id}/complete/" in content
    assert "/api/v1/pick-items/{id}/pick/" in content
    assert "/api/v1/shipments/{id}/add-from-pick-list/" in content
    assert "/api/v1/move-operations/{id}/execute/" in content
    # Приёмка
    assert "/api/v1/receipts/{id}/confirm/" in content
    assert "/api/v1/receipts/{id}/cancel/" in content


def test_schema_contains_title(auth_client):
    url = reverse("schema")
    response = auth_client.get(url)
    content = response.content.decode("utf-8")
    assert "WMS Geology API" in content


def test_swagger_ui_responds(client, db):
    url = reverse("swagger-ui")
    response = client.get(url)
    assert response.status_code == 200


def test_schema_validates_with_command(db):
    from io import StringIO
    from django.core.management import call_command

    out = StringIO()
    call_command("spectacular", "--validate", stdout=out)
    output = out.getvalue()
    assert "WMS Geology" in output or output == ""


def test_schema_command_dry_run(db):
    from io import StringIO
    from django.core.management import call_command

    out = StringIO()
    call_command("spectacular", stdout=out)
    content = out.getvalue()
    assert "openapi" in content
    assert "WMS Geology API" in content