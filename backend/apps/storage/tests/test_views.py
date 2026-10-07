"""
Тесты API-эндпоинтов приложения storage.

Покрывают:
- 401 без аутентификации;
- CRUD (list, create, retrieve, update, delete) для Room;
- пагинацию;
- фильтры (rack?room_id=, cell?tier_id=, container?status= и т.д.);
- валидацию XOR (Pallet, Container).
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

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
    """Аутентифицированный APIClient."""
    user = User.objects.create_user(username="api_user", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    """Неаутентифицированный APIClient."""
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
def test_rooms_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/storage/rooms/")
    assert response.status_code in (401, 403)


def test_rooms_list_authenticated(auth_client, room):
    response = auth_client.get("/api/v1/storage/rooms/")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Room — CRUD
# ============================================================
def test_room_create(auth_client, db):
    response = auth_client.post(
        "/api/v1/storage/rooms/",
        {"name": "Новая комната", "description": ""},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["name"] == "Новая комната"


def test_room_retrieve(auth_client, room):
    response = auth_client.get(f"/api/v1/storage/rooms/{room.pk}/")
    assert response.status_code == 200
    assert response.data["name"] == "Комната 1"


def test_room_update(auth_client, room):
    response = auth_client.patch(
        f"/api/v1/storage/rooms/{room.pk}/",
        {"name": "Обновлённая"},
        format="json",
    )
    assert response.status_code == 200
    room.refresh_from_db()
    assert room.name == "Обновлённая"


def test_room_delete(auth_client, room):
    response = auth_client.delete(f"/api/v1/storage/rooms/{room.pk}/")
    assert response.status_code == 204
    assert not Room.objects.filter(pk=room.pk).exists()


# ============================================================
# Пагинация
# ============================================================
def test_rooms_pagination(auth_client, db):
    for i in range(60):
        Room.objects.create(name=f"Комната {i:02d}")
    response = auth_client.get("/api/v1/storage/rooms/")
    assert response.status_code == 200
    assert response.data["count"] == 60
    assert len(response.data["results"]) == 50


# ============================================================
# Rack — фильтры
# ============================================================
def test_rack_list_filter_by_room(auth_client, room):
    room2 = Room.objects.create(name="Комната 2")
    Rack.objects.create(room=room, code="A")
    Rack.objects.create(room=room2, code="B")
    response = auth_client.get(f"/api/v1/storage/racks/?room_id={room.pk}")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Cell — фильтры
# ============================================================
def test_cell_list_filter_by_tier(auth_client, tier, cell):
    other_section = Section.objects.create(rack=tier.section.rack, code="S2")
    other_tier = Tier.objects.create(section=other_section, code="B", level_number=2)
    Cell.objects.create(tier=other_tier, code="1", full_address="Другой")

    response = auth_client.get(f"/api/v1/storage/cells/?tier_id={tier.pk}")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_cell_list_filter_is_active(auth_client, cell):
    Cell.objects.create(
        tier=cell.tier, code="2",
        full_address="Комната 1 / A / S1 / A / 2",
        is_active=False,
    )
    response = auth_client.get("/api/v1/storage/cells/?is_active=false")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Pallet — валидация XOR
# ============================================================
def test_pallet_create_with_cell(auth_client, cell):
    response = auth_client.post(
        "/api/v1/storage/pallets/",
        {"cell": cell.pk},
        format="json",
    )
    assert response.status_code == 201


def test_pallet_create_xor_validation(auth_client, cell, room):
    response = auth_client.post(
        "/api/v1/storage/pallets/",
        {"cell": cell.pk, "floor_room": room.pk},
        format="json",
    )
    assert response.status_code == 400
    assert "non_field_errors" in response.data


# ============================================================
# Container — CRUD + валидация
# ============================================================
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
    assert response.data["container_number"] == "T-API-001"


def test_container_xor_validation(auth_client, container_type, room):
    pallet = Pallet.objects.create()
    response = auth_client.post(
        "/api/v1/storage/containers/",
        {
            "container_number": "T-API-002",
            "container_type": container_type.pk,
            "pallet": pallet.pk,
            "floor_room": room.pk,
        },
        format="json",
    )
    assert response.status_code == 400


def test_container_list_filter_by_status(auth_client, container_type):
    Container.objects.create(
        container_number="T-001", container_type=container_type,
        status=Container.STATUS_ACTIVE,
    )
    Container.objects.create(
        container_number="T-002", container_type=container_type,
        status=Container.STATUS_ISSUED,
    )
    response = auth_client.get("/api/v1/storage/containers/?status=ISSUED")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_container_list_filter_by_type(auth_client, container_type):
    other_type = ContainerType.objects.create(name="Ящик")
    Container.objects.create(
        container_number="T-100", container_type=container_type,
    )
    Container.objects.create(
        container_number="T-101", container_type=other_type,
    )
    response = auth_client.get(
        f"/api/v1/storage/containers/?container_type_id={container_type.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# ContainerType
# ============================================================
def test_container_type_create(auth_client, db):
    response = auth_client.post(
        "/api/v1/storage/container-types/",
        {
            "name": "Кернобокс",
            "max_on_standard_pallet": 3,
            "is_core": True,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["is_core"] is True