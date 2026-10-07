"""
Тесты моделей приложения movements.

Покрывают:
- MoveOperation: статусы, XOR target_cell/target_floor_room;
- MoveOperationItem: «не оба сразу» pallet/container, статусы, каскады;
- допустимость обоих NULL (история после удаления объекта).
"""

import pytest
from django.db import IntegrityError

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
def room(db):
    return Room.objects.create(name="Комната 1")


@pytest.fixture
def cell(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="A", level_number=1)
    return Cell.objects.create(
        tier=tier, code="1", full_address="Адрес 1",
    )


@pytest.fixture
def cell2(db, room):
    rack = Rack.objects.create(room=room, code="B")
    section = Section.objects.create(rack=rack, code="S2")
    tier = Tier.objects.create(section=section, code="B", level_number=2)
    return Cell.objects.create(
        tier=tier, code="2", full_address="Адрес 2",
    )


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
# MoveOperation
# ============================================================
def test_move_op_default_status_draft(db):
    op = MoveOperation.objects.create(operation_number="MOV-001")
    assert op.status == "DRAFT"


def test_move_op_number_unique(db):
    MoveOperation.objects.create(operation_number="MOV-002")
    with pytest.raises(IntegrityError):
        MoveOperation.objects.create(operation_number="MOV-002")


def test_move_op_target_cell_valid(db, cell2):
    op = MoveOperation.objects.create(
        operation_number="MOV-003", target_cell=cell2,
    )
    assert op.target_cell == cell2


def test_move_op_target_floor_valid(db, room):
    op = MoveOperation.objects.create(
        operation_number="MOV-004", target_floor_room=room,
    )
    assert op.target_floor_room == room


def test_move_op_target_both_raises(db, cell2, room):
    with pytest.raises(IntegrityError):
        MoveOperation.objects.create(
            operation_number="MOV-005",
            target_cell=cell2,
            target_floor_room=room,
        )


def test_move_op_target_none_valid(db):
    op = MoveOperation.objects.create(operation_number="MOV-006")
    assert op.target_cell is None
    assert op.target_floor_room is None


def test_move_op_str(db):
    op = MoveOperation.objects.create(operation_number="MOV-007")
    text = str(op)
    assert "MOV-007" in text
    assert "Черновик" in text


# ============================================================
# MoveOperationItem
# ============================================================
def test_move_item_with_pallet(db, cell, pallet):
    op = MoveOperation.objects.create(operation_number="MOV-100")
    item = MoveOperationItem.objects.create(
        move_operation=op, pallet=pallet, source_cell=cell,
    )
    assert item.pk is not None
    assert item.status == "PENDING"


def test_move_item_with_container(db, container):
    op = MoveOperation.objects.create(operation_number="MOV-101")
    item = MoveOperationItem.objects.create(
        move_operation=op, container=container,
    )
    assert item.container == container


def test_move_item_both_raises(db, pallet, container):
    """Оба заданы — ошибка."""
    op = MoveOperation.objects.create(operation_number="MOV-102")
    with pytest.raises(IntegrityError):
        MoveOperationItem.objects.create(
            move_operation=op, pallet=pallet, container=container,
        )


def test_move_item_both_null_allowed(db):
    """Оба NULL — допустимо (история после удаления объекта)."""
    op = MoveOperation.objects.create(operation_number="MOV-103")
    item = MoveOperationItem.objects.create(move_operation=op)
    assert item.pk is not None
    assert item.pallet is None
    assert item.container is None


def test_move_item_status_moved(db, pallet):
    op = MoveOperation.objects.create(operation_number="MOV-104")
    item = MoveOperationItem.objects.create(
        move_operation=op, pallet=pallet,
    )
    item.status = MoveOperationItem.STATUS_MOVED
    item.save()
    item.refresh_from_db()
    assert item.status == "MOVED"


def test_move_op_delete_cascades_to_items(db, pallet):
    op = MoveOperation.objects.create(operation_number="MOV-105")
    MoveOperationItem.objects.create(move_operation=op, pallet=pallet)
    pk = op.pk
    op.delete()
    assert MoveOperationItem.objects.filter(move_operation_id=pk).count() == 0


def test_move_item_pallet_delete_sets_null(db, pallet):
    """Удаление поддона обнуляет pallet в строке, но строка остаётся."""
    op = MoveOperation.objects.create(operation_number="MOV-106")
    item = MoveOperationItem.objects.create(move_operation=op, pallet=pallet)
    pallet.delete()
    item.refresh_from_db()
    assert item.pallet is None
    assert item.pk is not None