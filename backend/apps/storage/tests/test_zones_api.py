"""API напольных зон (zones-backend-api)."""
import pytest
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APIClient

from apps.storage.models import (
    Container,
    ContainerType,
    FloorPlace,
    Room,
    Zone,
    ZoneRow,
)


@pytest.fixture
def api(db):
    user = get_user_model().objects.create_user(
        username="z", password="z", is_staff=True,
    )
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def zone(db):
    room = Room.objects.create(name="Z")
    return Zone.objects.create(room=room, code="Z1")


@pytest.fixture
def row(zone):
    return ZoneRow.objects.create(zone=zone, code="R1")


@pytest.fixture
def place(row):
    return FloorPlace.objects.create(row=row, code=1)


def _items(data):
    return data if isinstance(data, list) else data.get("results", [])


def test_zones_list(api, zone):
    resp = api.get(reverse("zone-list"))
    assert resp.status_code == 200
    assert "Z1" in [i["code"] for i in _items(resp.json())]


def test_zone_rows_list(api, row):
    resp = api.get(reverse("zone-row-list"))
    assert resp.status_code == 200
    assert "horizontal" in [i["orientation"] for i in _items(resp.json())]


def test_zone_scheme_count(api, place):
    ctype = ContainerType.objects.create(name="T")
    Container.objects.create(
        container_type=ctype, floor_place=place, floor_level=1,
    )
    resp = api.get(reverse("zone-scheme", args=[place.row.zone.id]))
    assert resp.status_code == 200
    assert resp.json()["rows"][0]["places"][0]["count"] == 1


def test_zone_scheme_levels(api, place):
    ctype = ContainerType.objects.create(name="T")
    Container.objects.create(
        container_type=ctype, floor_place=place, floor_level=2,
    )
    resp = api.get(reverse("zone-scheme", args=[place.row.zone.id]))
    assert resp.json()["rows"][0]["places"][0]["levels"][0]["level"] == 2


