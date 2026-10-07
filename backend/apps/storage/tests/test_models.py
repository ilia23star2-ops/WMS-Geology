"""
Тесты моделей приложения storage.

Покрывают доменные правила из docs/DATABASE.md:
- уникальность кодов внутри родителей;
- ограничения Pallet (ячейка XOR пол);
- ограничения Container (не на поддоне и на полу одновременно);
- допустимые значения position_in_cell.
"""

import pytest
from django.db import IntegrityError

from apps.storage.models import (
    Cell,
    Container,
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
    """Комната для тестов."""
    return Room.objects.create(name="Комната 1")


@pytest.fixture
def full_topology(db, room):
    """Полная цепочка: комната → стеллаж → пролёт → ярус → ячейка."""
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="T1", level_number=1)
    cell = Cell.objects.create(
        tier=tier,
        code="C1",
        full_address="Комната 1 / A / S1 / T1 / C1",
    )
    return {"room": room, "rack": rack, "section": section, "tier": tier, "cell": cell}


# ============================================================
# Room
# ============================================================
def test_room_create_returns_str_name(db):
    """Комната создаётся, __str__ возвращает имя."""
    room = Room.objects.create(name="Склад А")
    assert str(room) == "Склад А"


# ============================================================
# Rack
# ============================================================
def test_rack_unique_code_within_room_raises(db, room):
    """Одинаковый код стеллажа в одной комнате — ошибка."""
    Rack.objects.create(room=room, code="A")
    with pytest.raises(IntegrityError):
        Rack.objects.create(room=room, code="A")


def test_rack_same_code_in_different_rooms_allowed(db, room):
    """Одинаковый код стеллажа в разных комнатах — допустимо."""
    room2 = Room.objects.create(name="Комната 2")
    Rack.objects.create(room=room, code="A")
    rack2 = Rack.objects.create(room=room2, code="A")
    assert rack2.pk is not None


# ============================================================
# Section, Tier, Cell — уникальность кодов внутри родителей
# ============================================================
def test_section_unique_code_within_rack_raises(db, full_topology):
    """Одинаковый код пролёта в одном стеллаже — ошибка."""
    rack = full_topology["rack"]
    with pytest.raises(IntegrityError):
        Section.objects.create(rack=rack, code="S1")


def test_tier_unique_code_within_section_raises(db, full_topology):
    """Одинаковый код яруса в одном пролёте — ошибка."""
    section = full_topology["section"]
    with pytest.raises(IntegrityError):
        Tier.objects.create(section=section, code="T1")


def test_cell_unique_code_within_tier_raises(db, full_topology):
    """Одинаковый код ячейки в одном ярусе — ошибка."""
    tier = full_topology["tier"]
    with pytest.raises(IntegrityError):
        Cell.objects.create(
            tier=tier,
            code="C1",
            full_address="Другой адрес",
        )


# ============================================================
# Cell — full_address и max_pallets
# ============================================================
def test_cell_full_address_unique_raises(db, full_topology):
    """Одинаковый full_address у двух ячеек — ошибка."""
    tier = full_topology["tier"]
    existing_address = full_topology["cell"].full_address
    with pytest.raises(IntegrityError):
        Cell.objects.create(
            tier=tier,
            code="C2",
            full_address=existing_address,
        )


def test_cell_default_max_pallets_is_three(db, full_topology):
    """По умолчанию max_pallets = 3."""
    cell = full_topology["cell"]
    assert cell.max_pallets == 3


# ============================================================
# Pallet — ограничения расположения
# ============================================================
def test_pallet_on_cell_with_position_is_valid(db, full_topology):
    """Поддон в ячейке с позицией — валидно."""
    cell = full_topology["cell"]
    pallet = Pallet.objects.create(
        pallet_code="P-001",
        cell=cell,
        position_in_cell=1,
    )
    assert pallet.pk is not None


def test_pallet_on_floor_is_valid(db, room):
    """Поддон на полу комнаты — валидно."""
    pallet = Pallet.objects.create(
        pallet_code="P-002",
        floor_room=room,
    )
    assert pallet.pk is not None


def test_pallet_on_cell_and_floor_raises(db, full_topology):
    """Поддон одновременно в ячейке и на полу — ошибка."""
    cell = full_topology["cell"]
    room = full_topology["room"]
    with pytest.raises(IntegrityError):
        Pallet.objects.create(
            pallet_code="P-003",
            cell=cell,
            position_in_cell=1,
            floor_room=room,
        )


def test_pallet_position_out_of_range_raises(db, full_topology):
    """Позиция поддона вне диапазона 1..3 — ошибка."""
    cell = full_topology["cell"]
    with pytest.raises(IntegrityError):
        Pallet.objects.create(
            pallet_code="P-004",
            cell=cell,
            position_in_cell=5,
        )


def test_pallet_without_location_is_valid(db):
    """Поддон без ячейки и без пола (в пути) — валидно."""
    pallet = Pallet.objects.create(pallet_code="P-005")
    assert pallet.pk is not None
    assert pallet.cell is None
    assert pallet.floor_room is None


# ============================================================
# Container — ограничения расположения
# ============================================================
def test_container_on_pallet_is_valid(db):
    """Тара на поддоне — валидно."""
    pallet = Pallet.objects.create(pallet_code="P-100")
    container = Container.objects.create(
        container_number="T-001",
        pallet=pallet,
    )
    assert container.pk is not None


def test_container_on_floor_is_valid(db, room):
    """Тара на полу — валидно."""
    container = Container.objects.create(
        container_number="T-002",
        floor_room=room,
    )
    assert container.pk is not None


def test_container_in_transit_is_valid(db):
    """Тара без места (в пути) — валидно."""
    container = Container.objects.create(container_number="T-003")
    assert container.pk is not None


def test_container_on_pallet_and_floor_raises(db, room):
    """Тара одновременно на поддоне и на полу — ошибка."""
    pallet = Pallet.objects.create(pallet_code="P-101")
    with pytest.raises(IntegrityError):
        Container.objects.create(
            container_number="T-004",
            pallet=pallet,
            floor_room=room,
        )


def test_container_number_unique_raises(db):
    """Одинаковый номер тары — ошибка."""
    Container.objects.create(container_number="T-005")
    with pytest.raises(IntegrityError):
        Container.objects.create(container_number="T-005")


# ============================================================
# Каскадное удаление
# ============================================================
def test_room_delete_cascades_to_racks(db, full_topology):
    """Удаление комнаты каскадно удаляет стеллажи."""
    room = full_topology["room"]
    room.pk  # фиксируем pk до удаления
    room.delete()
    assert Rack.objects.filter(room_id=full_topology["room"].pk).count() == 0