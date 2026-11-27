"""Модели напольных зон (zones-backend-models)."""
import pytest
from django.db import IntegrityError

from apps.storage.models import (
    Container,
    ContainerType,
    FloorPlace,
    Room,
    Zone,
    ZoneRow,
)


@pytest.fixture
def room(db):
    return Room.objects.create(name="Z")


@pytest.fixture
def zone(room):
    return Zone.objects.create(room=room, code="Z1")


@pytest.fixture
def row(zone):
    return ZoneRow.objects.create(zone=zone, code="R1")


def test_zone_unique_room_code(room):
    Zone.objects.create(room=room, code="Z1")
    with pytest.raises(IntegrityError):
        Zone.objects.create(room=room, code="Z1")


def test_zone_qr_autogen(zone):
    assert zone.qr_code == f"WMSG:ZONE:{zone.id}"


def test_zonerow_qr_autogen_and_orientation(row):
    assert row.qr_code == f"WMSG:ROW:{row.id}"
    assert row.orientation == ZoneRow.ORIENTATION_HORIZONTAL


def test_floorplace_unique_row_code(row):
    FloorPlace.objects.create(row=row, code=1)
    with pytest.raises(IntegrityError):
        FloorPlace.objects.create(row=row, code=1)


def test_container_floor_fields(row):
    place = FloorPlace.objects.create(row=row, code=1)
    ctype = ContainerType.objects.create(name="T")
    c = Container.objects.create(
        container_type=ctype, floor_place=place, floor_level=2,
    )
    c.refresh_from_db()
    assert c.floor_place == place
    assert c.floor_level == 2