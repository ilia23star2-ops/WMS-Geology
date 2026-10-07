"""
Тесты API приложения movements.

Покрывают:
- CRUD MoveOperation, MoveOperationItem;
- custom action execute (успех для pallet и container, ошибки);
- валидацию XOR target_cell/target_floor_room;
- проверку статуса DRAFT;
- проверку, что целевое место задано;
- проверку, что операция не пуста;
- фильтры (status, move_operation_id).
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.movements.models import MoveOperation, MoveOperationItem
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
    user = User.objects.create_user(username="mov_api", password="test")
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
def cell(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="A", level_number=1)
    return Cell.objects.create(tier=tier, code="1", full_address="Адрес 1")


@pytest.fixture
def cell2(db, room):
    rack = Rack.objects.create(room=room, code="B")
    section = Section.objects.create(rack=rack, code="S2")
    tier = Tier.objects.create(section=section, code="B", level_number=2)
    return Cell.objects.create(tier=tier, code="2", full_address="Адрес 2")


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def pallet(db, cell):
    return Pallet.objects.create(cell=cell)


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-MOV-001", container_type=container_type,
    )


# ============================================================
# Аутентификация
# ============================================================
def test_move_ops_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/move-operations/")
    assert response.status_code in (401, 403)


# ============================================================
# MoveOperation — CRUD
# ============================================================
def test_move_op_create_sets_created_by(auth_client, db):
    response = auth_client.post(
        "/api/v1/move-operations/",
        {"operation_number": "MOV-001"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == "DRAFT"
    assert response.data["created_by"] is not None


def test_move_op_xor_target_validation(auth_client, cell2, room):
    response = auth_client.post(
        "/api/v1/move-operations/",
        {
            "operation_number": "MOV-002",
            "target_cell": cell2.pk,
            "target_floor_room": room.pk,
        },
        format="json",
    )
    assert response.status_code == 400


def test_move_op_list_filter_by_status(auth_client, db):
    MoveOperation.objects.create(operation_number="MOV-010")
    MoveOperation.objects.create(
        operation_number="MOV-011", status=MoveOperation.STATUS_COMPLETED,
    )
    response = auth_client.get("/api/v1/move-operations/?status=DRAFT")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_move_op_retrieve_with_items(auth_client, pallet):
    op = MoveOperation.objects.create(operation_number="MOV-020")
    MoveOperationItem.objects.create(move_operation=op, pallet=pallet)
    response = auth_client.get(f"/api/v1/move-operations/{op.pk}/")
    assert response.status_code == 200
    assert response.data["items_count"] == 1
    assert len(response.data["items"]) == 1


# ============================================================
# MoveOperationItem — CRUD + валидация
# ============================================================
def test_move_item_create_with_pallet(auth_client, pallet):
    op = MoveOperation.objects.create(operation_number="MOV-030")
    response = auth_client.post(
        "/api/v1/move-operation-items/",
        {"move_operation": op.pk, "pallet": pallet.pk},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == "PENDING"


def test_move_item_both_pallet_and_container_raises(
    auth_client, pallet, container,
):
    op = MoveOperation.objects.create(operation_number="MOV-031")
    response = auth_client.post(
        "/api/v1/move-operation-items/",
        {
            "move_operation": op.pk,
            "pallet": pallet.pk,
            "container": container.pk,
        },
        format="json",
    )
    assert response.status_code == 400


def test_move_item_filter_by_operation(auth_client, pallet):
    op1 = MoveOperation.objects.create(operation_number="MOV-040")
    op2 = MoveOperation.objects.create(operation_number="MOV-041")
    MoveOperationItem.objects.create(move_operation=op1, pallet=pallet)
    MoveOperationItem.objects.create(move_operation=op2, pallet=pallet)

    response = auth_client.get(
        f"/api/v1/move-operation-items/?move_operation_id={op1.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Custom action: execute
# ============================================================
def test_execute_pallet_success(auth_client, pallet, cell2):
    op = MoveOperation.objects.create(
        operation_number="MOV-100", target_cell=cell2,
    )
    MoveOperationItem.objects.create(move_operation=op, pallet=pallet)

    response = auth_client.post(
        f"/api/v1/move-operations/{op.pk}/execute/", format="json",
    )
    assert response.status_code == 200
    assert response.data["moved_count"] == 1

    pallet.refresh_from_db()
    assert pallet.cell_id == cell2.pk

    op.refresh_from_db()
    assert op.status == "COMPLETED"
    assert op.completed_at is not None


def test_execute_container_success(auth_client, container, room):
    op = MoveOperation.objects.create(
        operation_number="MOV-101", target_floor_room=room,
    )
    MoveOperationItem.objects.create(move_operation=op, container=container)

    response = auth_client.post(
        f"/api/v1/move-operations/{op.pk}/execute/", format="json",
    )
    assert response.status_code == 200

    container.refresh_from_db()
    assert container.floor_room_id == room.pk


def test_execute_not_draft_raises(auth_client, pallet, cell2):
    op = MoveOperation.objects.create(
        operation_number="MOV-102",
        target_cell=cell2,
        status=MoveOperation.STATUS_COMPLETED,
    )
    MoveOperationItem.objects.create(move_operation=op, pallet=pallet)

    response = auth_client.post(
        f"/api/v1/move-operations/{op.pk}/execute/", format="json",
    )
    assert response.status_code == 400


def test_execute_no_target_raises(auth_client, pallet):
    op = MoveOperation.objects.create(operation_number="MOV-103")
    MoveOperationItem.objects.create(move_operation=op, pallet=pallet)

    response = auth_client.post(
        f"/api/v1/move-operations/{op.pk}/execute/", format="json",
    )
    assert response.status_code == 400


def test_execute_empty_raises(auth_client, cell2):
    op = MoveOperation.objects.create(
        operation_number="MOV-104", target_cell=cell2,
    )
    response = auth_client.post(
        f"/api/v1/move-operations/{op.pk}/execute/", format="json",
    )
    assert response.status_code == 400


def test_execute_updates_item_status(auth_client, pallet, cell2):
    op = MoveOperation.objects.create(
        operation_number="MOV-105", target_cell=cell2,
    )
    item = MoveOperationItem.objects.create(
        move_operation=op, pallet=pallet,
    )
    auth_client.post(
        f"/api/v1/move-operations/{op.pk}/execute/", format="json",
    )
    item.refresh_from_db()
    assert item.status == "MOVED"