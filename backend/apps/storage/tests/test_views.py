"""
Тесты API приложения storage (справочники + топология).

Справочники:
- ContainerComment: CRUD, фильтр is_active.

Топология:
- Room, Rack, Cell, Pallet, Container: базовые CRUD + фильтры.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.storage.catalogs import ContainerComment
from apps.storage.models import (
    Cell,
    Container,
    ContainerType,
    Pallet,
    Rack,
    Room,
    Section,
    Tier,
)


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="storage_api", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def room(db):
    return Room.objects.create(name="Комната 1")


@pytest.fixture
def rack(db, room):
    return Rack.objects.create(room=room, code="A")


@pytest.fixture
def section(db, rack):
    return Section.objects.create(rack=rack, code="S1")


@pytest.fixture
def tier(db, section):
    return Tier.objects.create(section=section, code="A", level_number=1)


@pytest.fixture
def cell(db, tier):
    return Cell.objects.create(
        tier=tier, code="1", full_address="Комната 1 / A / S1 / A / 1",
    )


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


# ============================================================
# Аутентификация
# ============================================================
def test_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/storage/rooms/")
    assert response.status_code in (401, 403)


# ============================================================
# ContainerComment API
# ============================================================
def test_container_comment_create(auth_client, db):
    response = auth_client.post(
        "/api/v1/storage/container-comments/",
        {"text": "Повреждена"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["text"] == "Повреждена"
    assert response.data["is_active"] is True


def test_container_comment_list(auth_client, db):
    ContainerComment.objects.create(text="Повреждена")
    ContainerComment.objects.create(text="Влажная", is_active=False)

    response = auth_client.get("/api/v1/storage/container-comments/")
    assert response.status_code == 200
    assert response.data["count"] == 2


def test_container_comment_filter_is_active(auth_client, db):
    ContainerComment.objects.create(text="Повреждена")
    ContainerComment.objects.create(text="Влажная", is_active=False)

    response = auth_client.get(
        "/api/v1/storage/container-comments/?is_active=true"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_container_comment_update(auth_client, db):
    cc = ContainerComment.objects.create(text="Повреждена")
    response = auth_client.patch(
        f"/api/v1/storage/container-comments/{cc.pk}/",
        {"text": "Сильно повреждена"},
        format="json",
    )
    assert response.status_code == 200
    cc.refresh_from_db()
    assert cc.text == "Сильно повреждена"


def test_container_comment_delete(auth_client, db):
    cc = ContainerComment.objects.create(text="Повреждена")
    response = auth_client.delete(
        f"/api/v1/storage/container-comments/{cc.pk}/"
    )
    assert response.status_code == 204


# ============================================================
# Topology (быстрые смоук-тесты)
# ============================================================
def test_room_create(auth_client, db):
    response = auth_client.post(
        "/api/v1/storage/rooms/",
        {"name": "Новая комната"},
        format="json",
    )
    assert response.status_code == 201


def test_rack_filter_by_room(auth_client, room):
    room2 = Room.objects.create(name="Комната 2")
    Rack.objects.create(room=room, code="A")
    Rack.objects.create(room=room2, code="B")

    response = auth_client.get(
        f"/api/v1/storage/racks/?room_id={room.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_cell_filter_by_tier(auth_client, tier, cell):
    other_section = Section.objects.create(rack=tier.section.rack, code="S2")
    other_tier = Tier.objects.create(section=other_section, code="B", level_number=2)
    Cell.objects.create(tier=other_tier, code="1", full_address="Другой")

    response = auth_client.get(
        f"/api/v1/storage/cells/?tier_id={tier.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_pallet_create_with_cell(auth_client, cell):
    response = auth_client.post(
        "/api/v1/storage/pallets/",
        {"cell": cell.pk},
        format="json",
    )
    assert response.status_code == 201


def test_pallet_xor_validation(auth_client, cell, room):
    response = auth_client.post(
        "/api/v1/storage/pallets/",
        {"cell": cell.pk, "floor_room": room.pk},
        format="json",
    )
    assert response.status_code == 400


def test_container_create(auth_client, container_type):
    response = auth_client.post(
        "/api/v1/storage/containers/",
        {
            "container_number": "T-API-001",
            "container_type": container_type.pk,
        },
        format="json",
    )
    assert response.status_code == 201