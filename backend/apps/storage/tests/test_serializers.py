"""
Тесты сериализаторов приложения storage.

Покрывают:
- сериализацию/десериализацию каждой модели;
- валидацию XOR (pallet/floor_room, cell/floor_room);
- read-only поля (created_at);
- валидацию уникальности (container_number, qr_code);
- JSONB (capacity_override).
"""

import pytest
from rest_framework.exceptions import ValidationError

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
from apps.storage.serializers import (
    CellSerializer,
    ContainerSerializer,
    ContainerTypeSerializer,
    PalletSerializer,
    RackSerializer,
    RoomSerializer,
    SectionSerializer,
    TierSerializer,
)


# ============================================================
# Фикстуры
# ============================================================
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
    return ContainerType.objects.create(
        name="Коробка малая", max_on_standard_pallet=10,
    )


# ============================================================
# Room, Rack, Section, Tier
# ============================================================
def test_room_serialize(db, room):
    data = RoomSerializer(room).data
    assert data["name"] == "Комната 1"
    assert "id" in data


def test_room_deserialize_creates(db):
    ser = RoomSerializer(data={"name": "Новая комната", "description": ""})
    assert ser.is_valid()
    obj = ser.save()
    assert obj.pk is not None


def test_rack_serialize_with_room(db, rack):
    data = RackSerializer(rack).data
    assert data["code"] == "A"
    assert data["room"] == rack.room_id


def test_section_qr_null_allowed(db, rack):
    ser = SectionSerializer(data={"rack": rack.pk, "code": "S2"})
    assert ser.is_valid()
    obj = ser.save()
    assert obj.qr_code is None


def test_tier_codes_serialize(db, tier):
    data = TierSerializer(tier).data
    assert data["code"] == "A"
    assert data["level_number"] == 1


# ============================================================
# Cell
# ============================================================
def test_cell_serialize_full_address(db, cell):
    data = CellSerializer(cell).data
    assert data["full_address"] == "Комната 1 / A / S1 / A / 1"
    assert data["cell_type"] == "STANDARD"


def test_cell_qr_unique_validation(db, tier, cell):
    """QR ячейки уже занят — валидация сериализатора ловит."""
    ser = CellSerializer(
        data={
            "tier": tier.pk,
            "code": "2",
            "full_address": "Другой",
            "qr_code": "WMSG:CELL:1",
        }
    )
    # Первую ячейку сохраним с QR, потом попробуем создать вторую с тем же.
    cell.qr_code = "WMSG:CELL:1"
    cell.save()
    assert not ser.is_valid()
    assert "qr_code" in ser.errors


# ============================================================
# Pallet
# ============================================================
def test_pallet_serialize(db, cell):
    p = Pallet.objects.create(cell=cell)
    data = PalletSerializer(p).data
    assert data["cell"] == cell.pk
    assert data["status"] == "ACTIVE"
    assert data["pallet_type"] == "STANDARD"


def test_pallet_capacity_override_jsonb(db):
    p = Pallet.objects.create(capacity_override={"1": 15})
    data = PalletSerializer(p).data
    assert data["capacity_override"]["1"] == 15


def test_pallet_validate_xor_cell_floor(db, cell, room):
    """Нельзя одновременно cell и floor_room."""
    ser = PalletSerializer(data={"cell": cell.pk, "floor_room": room.pk})
    assert not ser.is_valid()
    assert "non_field_errors" in ser.errors


def test_pallet_validate_only_cell_ok(db, cell):
    ser = PalletSerializer(data={"cell": cell.pk})
    assert ser.is_valid()


def test_pallet_validate_only_floor_ok(db, room):
    ser = PalletSerializer(data={"floor_room": room.pk})
    assert ser.is_valid()


def test_pallet_validate_none_ok(db):
    """Оба NULL — «в пути» — допустимо."""
    ser = PalletSerializer(data={})
    assert ser.is_valid()


# ============================================================
# ContainerType
# ============================================================
def test_container_type_serialize(db, container_type):
    data = ContainerTypeSerializer(container_type).data
    assert data["name"] == "Коробка малая"
    assert data["max_on_standard_pallet"] == 10
    assert data["is_core"] is False


# ============================================================
# Container
# ============================================================
def test_container_serialize_with_type(db, container_type):
    c = Container.objects.create(
        container_number="T-001", container_type=container_type,
    )
    data = ContainerSerializer(c).data
    assert data["container_number"] == "T-001"
    assert data["container_type"] == container_type.pk


def test_container_validate_xor_pallet_floor(db, room, container_type):
    """Нельзя одновременно pallet и floor_room."""
    p = Pallet.objects.create()
    ser = ContainerSerializer(
        data={
            "container_number": "T-100",
            "container_type": container_type.pk,
            "pallet": p.pk,
            "floor_room": room.pk,
        }
    )
    assert not ser.is_valid()
    assert "non_field_errors" in ser.errors


def test_container_position_on_pallet_optional(db, container_type):
    c = Container.objects.create(
        container_number="T-200", container_type=container_type,
        position_on_pallet=2,
    )
    data = ContainerSerializer(c).data
    assert data["position_on_pallet"] == 2


def test_container_number_unique_validation(db, container_type):
    Container.objects.create(
        container_number="T-300", container_type=container_type,
    )
    ser = ContainerSerializer(
        data={"container_number": "T-300", "container_type": container_type.pk}
    )
    assert not ser.is_valid()
    assert "container_number" in ser.errors


def test_container_created_at_readonly(db, container_type):
    """created_at — read-only, игнорируется на входе."""
    ser = ContainerSerializer(
        data={
            "container_number": "T-400",
            "container_type": container_type.pk,
            "created_at": "2020-01-01T00:00:00Z",
        }
    )
    assert ser.is_valid()
    obj = ser.save()
    assert obj.created_at.year == 2026  # текущий год, не 2020