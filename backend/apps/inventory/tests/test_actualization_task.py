"""
Тесты ActualizationTask (3.x-offline-sync-b-2).

Покрывают:
- создание задачи через ORM + чтение через API;
- фильтрацию по resolution / task_type / entity_type;
- resolve accept_mobile / keep_server / reject;
- повторный resolve → 400;
- обязательность поля `action`.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.inventory.models import ActualizationTask


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="act_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def task(db):
    return ActualizationTask.objects.create(
        task_type=ActualizationTask.TYPE_SAMPLE_STATUS_CONFLICT,
        entity_type="Sample",
        entity_id=42,
        server_value={"status": "DISPOSED"},
        mobile_value={"status": "IN_STORAGE"},
        payload={"device_id": "phone-1", "operation_id": "op-123"},
    )


# ============================================================
# List / filter
# ============================================================
@pytest.mark.django_db
def test_list_all_tasks(auth_client, task):
    response = auth_client.get("/api/v1/actualization-tasks/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["entity_id"] == 42


@pytest.mark.django_db
def test_list_filter_by_resolution(auth_client, task):
    ActualizationTask.objects.create(
        task_type=ActualizationTask.TYPE_OTHER,
        entity_type="Container",
        entity_id=10,
        resolution=ActualizationTask.RESOLUTION_ACCEPT_MOBILE,
    )
    response = auth_client.get(
        "/api/v1/actualization-tasks/?resolution=PENDING"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["entity_id"] == 42


@pytest.mark.django_db
def test_list_filter_by_entity(auth_client, task):
    ActualizationTask.objects.create(
        task_type=ActualizationTask.TYPE_OTHER,
        entity_type="Container",
        entity_id=10,
    )
    response = auth_client.get(
        "/api/v1/actualization-tasks/?entity_type=Sample"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Resolve
# ============================================================
@pytest.mark.django_db
def test_resolve_accept_mobile(auth_client, task):
    response = auth_client.post(
        f"/api/v1/actualization-tasks/{task.pk}/resolve/",
        {"action": "accept_mobile", "note": "Подтвердил"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["resolution"] == "ACCEPT_MOBILE"
    assert response.data["resolution_note"] == "Подтвердил"
    task.refresh_from_db()
    assert task.resolution == "ACCEPT_MOBILE"
    assert task.resolved_at is not None
    assert task.resolved_by is not None


@pytest.mark.django_db
def test_resolve_keep_server(auth_client, task):
    response = auth_client.post(
        f"/api/v1/actualization-tasks/{task.pk}/resolve/",
        {"action": "keep_server"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["resolution"] == "KEEP_SERVER"


@pytest.mark.django_db
def test_resolve_reject(auth_client, task):
    response = auth_client.post(
        f"/api/v1/actualization-tasks/{task.pk}/resolve/",
        {"action": "reject", "note": "Ложное срабатывание"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["resolution"] == "REJECTED"


# ============================================================
# Ошибки
# ============================================================
@pytest.mark.django_db
def test_resolve_twice_returns_400(auth_client, task):
    auth_client.post(
        f"/api/v1/actualization-tasks/{task.pk}/resolve/",
        {"action": "accept_mobile"},
        format="json",
    )
    response = auth_client.post(
        f"/api/v1/actualization-tasks/{task.pk}/resolve/",
        {"action": "keep_server"},
        format="json",
    )
    assert response.status_code == 400
    assert "уже разобрана" in response.data["error"]


@pytest.mark.django_db
def test_resolve_without_action_returns_400(auth_client, task):
    response = auth_client.post(
        f"/api/v1/actualization-tasks/{task.pk}/resolve/",
        {},
        format="json",
    )
    assert response.status_code == 400