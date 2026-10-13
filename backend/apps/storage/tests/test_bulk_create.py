"""
Тесты action `POST /api/v1/storage/containers/bulk-create/`.

Только создание тары — без проб.
Заполнение пробами — в `test_fill_samples.py`.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="bulk_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


def _payload(container_type, **overrides):
    base = {
        "containers": [
            {
                "container_number": "T-BULK-001",
                "container_type_id": container_type.pk,
            },
        ],
    }
    base.update(overrides)
    return base


# ============================================================
# Успешное создание
# ============================================================
@pytest.mark.django_db
def test_bulk_create_success(auth_client, container_type):
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        _payload(container_type),
        format="json",
    )
    assert response.status_code == 201
    assert response.data["total_containers"] == 1
    assert Container.objects.count() == 1
    assert Sample.objects.count() == 0

    c = Container.objects.get()
    assert c.container_number == "T-BULK-001"
    assert c.status == Container.STATUS_PENDING_PLACEMENT


@pytest.mark.django_db
def test_bulk_create_multiple_containers(auth_client, container_type):
    payload = {
        "containers": [
            {
                "container_number": f"T-M-{i:03d}",
                "container_type_id": container_type.pk,
            }
            for i in range(1, 4)
        ],
    }
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 201
    assert response.data["total_containers"] == 3
    assert Container.objects.count() == 3
    assert all(
        c.status == Container.STATUS_PENDING_PLACEMENT
        for c in Container.objects.all()
    )


# ============================================================
# Ошибки
# ============================================================
@pytest.mark.django_db
def test_bulk_create_existing_container(auth_client, container_type):
    Container.objects.create(
        container_number="T-BULK-001", container_type=container_type,
    )
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        _payload(container_type),
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_bulk_create_duplicate_numbers_in_request(auth_client, container_type):
    payload = {
        "containers": [
            {"container_number": "T-DUP", "container_type_id": container_type.pk},
            {"container_number": "T-DUP", "container_type_id": container_type.pk},
        ],
    }
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_bulk_create_bad_container_type(auth_client):
    payload = {
        "containers": [
            {"container_number": "T-X", "container_type_id": 99999},
        ],
    }
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_bulk_create_empty_list(auth_client):
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        {"containers": []},
        format="json",
    )
    assert response.status_code == 400