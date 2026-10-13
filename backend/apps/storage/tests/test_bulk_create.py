"""
Тесты action `POST /api/v1/storage/containers/bulk-create/`.

Только создание тары-заготовки (без проб).
Заполнение пробами — в `test_fill_samples.py`.

Покрывают:
- успешное создание тары с номером и без;
- сохранение draft-полей на таре;
- ошибки: существующая тара, дубликаты в запросе,
  несуществующий container_type / draft_site / draft_research_type,
  пустой список.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType, Site
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


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


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


@pytest.mark.django_db
def test_bulk_create_without_number(auth_client, container_type):
    """Тара-заготовка без container_number."""
    payload = {
        "containers": [
            {"container_type_id": container_type.pk},
        ],
    }
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 201
    c = Container.objects.get()
    assert c.container_number is None


@pytest.mark.django_db
def test_bulk_create_with_draft_fields(
    auth_client, container_type, research_type, site,
):
    """Draft-поля сохраняются на таре."""
    payload = _payload(
        container_type,
        draft_site_id=site.pk,
        draft_research_type_id=research_type.pk,
        draft_work_order_coded="TST0001",
        draft_work_order_incoming="02-Тест001",
    )
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 201

    c = Container.objects.get()
    assert c.draft_site_id == site.pk
    assert c.draft_research_type_id == research_type.pk
    assert c.draft_work_order_coded == "TST0001"
    assert c.draft_work_order_incoming == "02-Тест001"


@pytest.mark.django_db
def test_bulk_create_mixed_numbers(auth_client, container_type):
    """Часть тар с номером, часть без."""
    payload = {
        "containers": [
            {"container_number": "T-WITH-NUM", "container_type_id": container_type.pk},
            {"container_type_id": container_type.pk},
        ],
    }
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 201
    assert Container.objects.count() == 2
    assert Container.objects.filter(container_number="T-WITH-NUM").exists()
    assert Container.objects.filter(container_number__isnull=True).count() == 1


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
def test_bulk_create_bad_draft_site(auth_client, container_type):
    payload = _payload(container_type, draft_site_id=99999)
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