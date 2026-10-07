"""
Тесты моделей приложения storage (v2).

Покрывают:
- уникальность кодов внутри родителей;
- ярусы A–D через choices;
- QR на секции и ячейке;
- Pallet: OneToOne с Cell, XOR cell/floor, "в пути" (все NULL);
- ContainerType: уникальность имени, max_on_standard_pallet;
- Container: container_type обязателен, XOR pallet/floor, position_on_pallet.
"""

import pytest
from django.db import IntegrityError
from django.db.models import ProtectedError

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
def full_topology(db, room):
    """Комната → стеллаж → секция → ярус A → ячейка 1."""
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="A", level_number=1)
    cell = Cell.objects.create(
        tier=tier,
        code="1",
        full_address="Комната 1 / A / S1 / A / 1",
    )
    return {"room": room, "rack": rack, "section": section, "tier": tier, "cell": cell}


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(
        name="Коробка малая",
        size_class="S",
        max_on_standard_pallet=10,
    )


# ============================================================
# Room, Rack, Section
# ============================================================
def test_room_str(db):
    r = Room.objects.create(name="Склад А")
    assert str(r) == "Склад А"


def test_rack_unique_code_in_room(db, room):
    Rack.objects.create(room=room, code="A")
    with pytest.raises(IntegrityError):
        Rack.objects.create(room=room, code="A")


def test_section_qr_code_unique(db, room):
    rack = Rack.objects.create(room=room, code="A")
    Section.objects.create(rack=rack, code="S1", qr_code="WMSG:SECTION:1")
    with pytest.raises(IntegrityError):
        Section.objects.create(rack=rack, code="S2", qr_code="WMSG:SECTION:1")


def test_section_qr_code_null_allowed(db, room):
    rack = Rack.objects.create(room=room, code="A")
    s1 = Section.objects.create(rack=rack, code="S1")
    s2 = Section.objects.create(rack=rack, code="S2")
    assert s1.qr_code is None
    assert s2.qr_code is None


# ============================================================
# Tier — коды A-D
# ============================================================
def test_tier_codes_a_d(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    for code, level in [("A", 1), ("B", 2), ("C", 3), ("D", 4)]:
        Tier.objects.create(section=section, code=code, level_number=level)
    assert Tier.objects.filter(section=section).count() == 4


def test_tier_unique_code_within_section(db, full_topology):
    section = full_topology["section"]
    with pytest.raises(IntegrityError):
        Tier.objects.create(section=section, code="A", level_number=1)


# ============================================================
# Cell
# ============================================================
def test_cell_unique_code_within_tier(db, full_topology):
    tier = full_topology["tier"]
    with pytest.raises(IntegrityError):
        Cell.objects.create(
            tier=tier,
            code="1",
            full_address="Другой адрес",
        )


def test_cell_full_address_unique(db, full_topology):
    tier = full_topology["tier"]
    addr = full_topology["cell"].full_address
    with pytest.raises(IntegrityError):
        Cell.objects.create(tier=tier, code="2", full_address=addr)


def test_cell_default_type_standard(db, full_topology):
    cell = full_topology["cell"]
    assert cell.cell_type == "STANDARD"


def test_cell_qr_code_unique(db, full_topology):
    """
    Две ячейки на разных ярусах с одинаковым QR — ошибка.

    Фикстура уже создала ячейку с code="1" на ярусе A.
    Используем code="2" и code="3", чтобы не конфликтовать
    с ней по (tier, code).
    """
    tier_a = full_topology["tier"]
    section = full_topology["section"]
    tier_b = Tier.objects.create(section=section, code="B", level_number=2)

    Cell.objects.create(
        tier=tier_a,
        code="2",
        full_address="Адрес A",
        qr_code="WMSG:CELL:1",
    )
    with pytest.raises(IntegrityError):
        Cell.objects.create(
            tier=tier_b,
            code="3",
            full_address="Адрес B",
            qr_code="WMSG:CELL:1",
        )


# ============================================================
# ContainerType
# ============================================================
def test_container_type_unique_name(db):
    ContainerType.objects.create(name="Ящик")
    with pytest.raises(IntegrityError):
        ContainerType.objects.create(name="Ящик")


def test_container_type_default_max(db):
    ct = ContainerType.objects.create(name="Коробка")
    assert ct.max_on_standard_pallet == 10
    assert ct.is_core is False


# ============================================================
# Pallet — OneToOne с Cell, XOR cell/floor
# ============================================================
def test_pallet_in_cell_valid(db, full_topology):
    cell = full_topology["cell"]
    p = Pallet.objects.create(cell=cell)
    assert p.pk is not None


def test_pallet_one_to_one_cell_raises(db, full_topology):
    """В одной ячейке — только 1 поддон (OneToOne)."""
    cell = full_topology["cell"]
    Pallet.objects.create(cell=cell)
    with pytest.raises(IntegrityError):
        Pallet.objects.create(cell=cell)


def test_pallet_on_floor_valid(db, room):
    p = Pallet.objects.create(floor_room=room)
    assert p.pk is not None


def test_pallet_on_cell_and_floor_raises(db, full_topology):
    cell = full_topology["cell"]
    room = full_topology["room"]
    with pytest.raises(IntegrityError):
        Pallet.objects.create(cell=cell, floor_room=room)


def test_pallet_in_transit_valid(db):
    """Поддон без ячейки и без пола — «в пути»."""
    p = Pallet.objects.create()
    assert p.pk is not None
    assert p.cell is None
    assert p.floor_room is None


def test_pallet_default_type_standard(db):
    p = Pallet.objects.create()
    assert p.pallet_type == "STANDARD"


def test_pallet_capacity_override_jsonb(db):
    p = Pallet.objects.create(capacity_override={"1": 15, "2": 6})
    p.refresh_from_db()
    assert p.capacity_override["1"] == 15
    assert p.capacity_override["2"] == 6


# ============================================================
# Container — type обязателен, XOR pallet/floor
# ============================================================
def test_container_on_pallet_valid(db, container_type):
    p = Pallet.objects.create()
    c = Container.objects.create(
        container_number="T-001",
        container_type=container_type,
        pallet=p,
    )
    assert c.pk is not None


def test_container_on_floor_valid(db, room, container_type):
    c = Container.objects.create(
        container_number="T-002",
        container_type=container_type,
        floor_room=room,
    )
    assert c.pk is not None


def test_container_in_transit_valid(db, container_type):
    c = Container.objects.create(
        container_number="T-003",
        container_type=container_type,
    )
    assert c.pk is not None


def test_container_on_pallet_and_floor_raises(db, room, container_type):
    p = Pallet.objects.create()
    with pytest.raises(IntegrityError):
        Container.objects.create(
            container_number="T-004",
            container_type=container_type,
            pallet=p,
            floor_room=room,
        )


def test_container_number_unique(db, container_type):
    Container.objects.create(
        container_number="T-005", container_type=container_type,
    )
    with pytest.raises(IntegrityError):
        Container.objects.create(
            container_number="T-005", container_type=container_type,
        )


def test_container_type_protected_from_delete(db, container_type):
    """Удаление ContainerType с контейнерами — запрещено (PROTECT)."""
    Container.objects.create(
        container_number="T-006", container_type=container_type,
    )
    with pytest.raises(ProtectedError):
        container_type.delete()


def test_container_position_on_pallet_null_by_default(db, container_type):
    c = Container.objects.create(
        container_number="T-007", container_type=container_type,
    )
    assert c.position_on_pallet is None