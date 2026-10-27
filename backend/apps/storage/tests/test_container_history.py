"""
Тесты аудита тары (2f-14a).

Покрывают:
- запись AuditLog для CREATE / UPDATE / DELETE;
- запись FILL_SAMPLES при заполнении;
- запись PLACE при размещении;
- пустую историю у новой тары;
- сортировку по убыванию created_at;
- 404 для несуществующей тары.

Примечание: `POST /storage/containers/` (ModelViewSet) создаёт тару
с default-статусом модели (`ACTIVE`), а `PENDING_FILLING` — только
через `bulk-create` / `check_receipt` / `create-in-cell` (см. 1.62).
Поэтому в `test_history_after_create` статус сверяется с фактическим
из БД, а не с захардкоженной константой.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType, Site
from apps.storage.models import Container, ContainerType, Room
from apps.users.models import AuditLog


@pytest.fixture
def auth_user(db):
    return User.objects.create_user(username="history_test", password="x")


@pytest.fixture
def auth_client(auth_user):
    client = APIClient()
    client.force_authenticate(user=auth_user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-HIST-001",
        container_type=container_type,
        status=Container.STATUS_PENDING_PLACEMENT,
    )


def _url(container) -> str:
    return f"/api/v1/storage/containers/{container.pk}/history/"


# ============================================================
# Пустая история
# ============================================================
@pytest.mark.django_db
def test_history_empty_for_new_container(auth_client, container):
    response = auth_client.get(_url(container))
    assert response.status_code == 200
    assert response.data == []


# ============================================================
# CREATE — через API
# ============================================================
@pytest.mark.django_db
def test_history_after_create(auth_client, auth_user, container_type):
    response = auth_client.post(
        "/api/v1/storage/containers/",
        {"container_number": "T-NEW", "container_type": container_type.pk},
        format="json",
    )
    assert response.status_code == 201
    new_id = response.data["id"]

    log = AuditLog.objects.filter(
        entity_type="Container", entity_id=new_id, action="CREATE",
    ).first()
    assert log is not None
    assert log.user == auth_user
    assert log.old_value is None
    assert log.new_value["container_number"] == "T-NEW"
    # Статус — фактический из БД (default модели, не PENDING_FILLING)
    actual_status = Container.objects.get(pk=new_id).status
    assert log.new_value["status"] == actual_status


# ============================================================
# UPDATE — old_value / new_value
# ============================================================
@pytest.mark.django_db
def test_history_after_update(auth_client, container):
    old_number = container.container_number
    response = auth_client.patch(
        f"/api/v1/storage/containers/{container.pk}/",
        {"container_number": "T-NEW-NUMBER"},
        format="json",
    )
    assert response.status_code == 200

    log = AuditLog.objects.filter(
        entity_type="Container", entity_id=container.pk, action="UPDATE",
    ).first()
    assert log is not None
    assert log.old_value["container_number"] == old_number
    assert log.new_value["container_number"] == "T-NEW-NUMBER"


# ============================================================
# DELETE — снимок сохраняется
# ============================================================
@pytest.mark.django_db
def test_history_after_delete(auth_client, container):
    pk = container.pk
    response = auth_client.delete(f"/api/v1/storage/containers/{pk}/")
    assert response.status_code == 204

    log = AuditLog.objects.filter(
        entity_type="Container", entity_id=pk, action="DELETE",
    ).first()
    assert log is not None
    assert log.old_value["container_number"] == "T-HIST-001"
    assert log.new_value is None


# ============================================================
# FILL_SAMPLES — счётчик созданных проб
# ============================================================
@pytest.mark.django_db
def test_history_after_fill_samples(auth_client, container_type):
    site = Site.objects.create(code="TST", name="Тестовый")
    rt = ResearchType.objects.create(code="ШЛ", name="Шлифы")
    c = Container.objects.create(
        container_number=None,
        container_type=container_type,
        status=Container.STATUS_PENDING_FILLING,
    )

    payload = {
        "work_order_coded": "TST0001",
        "research_type_id": rt.pk,
        "site_id": site.pk,
        "sample_groups": [
            {
                "prefix": "TAA-A",
                "middle": "1",
                "sequence_from": 1,
                "sequence_to": 3,
            },
        ],
    }
    response = auth_client.post(
        f"/api/v1/storage/containers/{c.pk}/fill-samples/",
        payload, format="json",
    )
    assert response.status_code == 201

    log = AuditLog.objects.filter(
        entity_type="Container", entity_id=c.pk, action="FILL_SAMPLES",
    ).first()
    assert log is not None
    assert log.new_value["created_samples"] == 3
    assert log.new_value["sample_count"] == 3


# ============================================================
# PLACE — статус ACTIVE + floor_room
# ============================================================
@pytest.mark.django_db
def test_history_after_bulk_place(auth_client, container):
    room = Room.objects.create(name="Комната 1")
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-place/",
        {"container_ids": [container.pk], "floor_room_id": room.pk},
        format="json",
    )
    assert response.status_code == 200

    log = AuditLog.objects.filter(
        entity_type="Container", entity_id=container.pk, action="PLACE",
    ).first()
    assert log is not None
    assert log.new_value["status"] == Container.STATUS_ACTIVE
    assert log.new_value["floor_room_id"] == room.pk
    assert log.old_value["status"] == Container.STATUS_PENDING_PLACEMENT


# ============================================================
# Порядок: новые сверху
# ============================================================
@pytest.mark.django_db
def test_history_order_desc(auth_client, container):
    auth_client.patch(
        f"/api/v1/storage/containers/{container.pk}/",
        {"container_number": "T-A"}, format="json",
    )
    auth_client.patch(
        f"/api/v1/storage/containers/{container.pk}/",
        {"container_number": "T-B"}, format="json",
    )
    response = auth_client.get(_url(container))
    assert response.status_code == 200
    assert len(response.data) == 2
    # Свежая запись — первая
    assert response.data[0]["new_value"]["container_number"] == "T-B"
    assert response.data[1]["new_value"]["container_number"] == "T-A"
    # Поле action_display — русская метка
    assert response.data[0]["action_display"] == "Изменена"


# ============================================================
# 404 для несуществующей тары
# ============================================================
@pytest.mark.django_db
def test_history_404_unknown_container(auth_client):
    response = auth_client.get("/api/v1/storage/containers/99999/history/")
    assert response.status_code == 404