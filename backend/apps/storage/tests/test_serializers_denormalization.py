"""
Тесты денормализации сериализаторов storage (c-6a).

Проверяют, что ContainerSerializer отдаёт имена вместо ID
(container_type_name, floor_room_name, cell_full_address),
чтобы Mobile не тянул справочники отдельным Pull-ом.
"""

import pytest

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
from apps.storage.serializers import ContainerSerializer


@pytest.fixture
def room(db):
    return Room.objects.create(name="Комната 1")


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка", size_class="M")


@pytest.fixture
def cell(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="A")
    return Cell.objects.create(
        tier=tier,
        code="1",
        full_address="Комната 1 / A / S1 / A / 1",
    )


@pytest.mark.django_db
def test_container_serializer_container_type_name(container_type):
    """Имя типа тары отдаётся как строка, не как ID."""
    c = Container.objects.create(container_type=container_type)
    data = ContainerSerializer(c).data
    assert data["container_type_name"] == "Коробка"


@pytest.mark.django_db
def test_container_serializer_floor_room_name(room, container_type):
    """Имя комнаты (пол) отдаётся строкой."""
    c = Container.objects.create(
        container_type=container_type, floor_room=room,
    )
    data = ContainerSerializer(c).data
    assert data["floor_room_name"] == "Комната 1"


@pytest.mark.django_db
def test_container_serializer_floor_room_name_null(container_type):
    """Если floor_room нет — null, не ошибка."""
    c = Container.objects.create(container_type=container_type)
    data = ContainerSerializer(c).data
    assert data["floor_room_name"] is None


@pytest.mark.django_db
def test_container_serializer_cell_full_address(cell, container_type):
    """Полный адрес ячейки через pallet.cell.full_address."""
    pallet = Pallet.objects.create(cell=cell)
    c = Container.objects.create(
        container_type=container_type, pallet=pallet,
    )
    data = ContainerSerializer(c).data
    assert data["cell_full_address"] == cell.full_address


@pytest.mark.django_db
def test_container_serializer_cell_full_address_null(container_type):
    """Если pallet нет — cell_full_address = null, не ошибка."""
    c = Container.objects.create(container_type=container_type)
    data = ContainerSerializer(c).data
    assert data["cell_full_address"] is None