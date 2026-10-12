"""
Тесты новых фильтров и `current_location` в SampleSerializer.

Покрывают:
- `?q=` — частичный поиск по номеру пробы;
- `?no_work_order=true` — пробы без Н/З;
- `current_location` — три случая (ячейка / пол / нет места).
"""

import pytest
from rest_framework.test import APIClient
from django.contrib.auth.models import User

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample
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


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="samples_search", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def room(db):
    return Room.objects.create(name="Комната 1")


@pytest.fixture
def cell_with_pallet(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="A", level_number=1)
    cell = Cell.objects.create(
        tier=tier, code="1", full_address="Комната 1 / A / S1 / A / 1",
    )
    pallet = Pallet.objects.create(cell=cell)
    return cell, pallet


@pytest.fixture
def container_in_cell(db, container_type, cell_with_pallet):
    _, pallet = cell_with_pallet
    return Container.objects.create(
        container_number="T-CELL",
        container_type=container_type,
        pallet=pallet,
    )


@pytest.fixture
def container_on_floor(db, container_type, room):
    return Container.objects.create(
        container_number="T-FLOOR",
        container_type=container_type,
        floor_room=room,
    )


@pytest.fixture
def container_no_location(db, container_type):
    return Container.objects.create(
        container_number="T-NOLOC",
        container_type=container_type,
    )


# ============================================================
# ?q= — частичный поиск
# ============================================================
@pytest.mark.django_db
def test_q_partial_match(auth_client, container_in_cell, research_type):
    Sample.objects.create(
        sample_number="TAA-A34076001-001",
        research_type=research_type,
        container=container_in_cell,
    )
    Sample.objects.create(
        sample_number="TAA-A34076001-002",
        research_type=research_type,
        container=container_in_cell,
    )
    Sample.objects.create(
        sample_number="OTHER-001",
        research_type=research_type,
        container=container_in_cell,
    )
    response = auth_client.get("/api/v1/samples/?q=34076001")
    assert response.status_code == 200
    assert response.data["count"] == 2


@pytest.mark.django_db
def test_q_no_match(auth_client, container_in_cell, research_type):
    Sample.objects.create(
        sample_number="TAA-A34076001-001",
        research_type=research_type,
        container=container_in_cell,
    )
    response = auth_client.get("/api/v1/samples/?q=ZZZ")
    assert response.status_code == 200
    assert response.data["count"] == 0


@pytest.mark.django_db
def test_sample_number_icontains_compat(auth_client, container_in_cell, research_type):
    """Старый ?sample_number= тоже должен работать как icontains."""
    Sample.objects.create(
        sample_number="TAA-A34076001-001",
        research_type=research_type,
        container=container_in_cell,
    )
    response = auth_client.get("/api/v1/samples/?sample_number=34076001")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# ?no_work_order=true
# ============================================================
@pytest.mark.django_db
def test_no_work_order_filter(auth_client, container_in_cell, research_type):
    Sample.objects.create(
        sample_number="A-1",
        research_type=research_type,
        container=container_in_cell,
    )
    Sample.objects.create(
        sample_number="A-2",
        research_type=research_type,
        container=container_in_cell,
        # current_work_order не задан
    )
    response = auth_client.get("/api/v1/samples/?no_work_order=true")
    assert response.status_code == 200
    assert response.data["count"] == 2


# ============================================================
# current_location
# ============================================================
@pytest.mark.django_db
def test_current_location_cell(
    auth_client, container_in_cell, research_type,
):
    s = Sample.objects.create(
        sample_number="A-1",
        research_type=research_type,
        container=container_in_cell,
    )
    response = auth_client.get(f"/api/v1/samples/{s.pk}/")
    assert response.status_code == 200
    assert response.data["current_location"] == "Комната 1 / A / S1 / A / 1"


@pytest.mark.django_db
def test_current_location_floor_room(
    auth_client, container_on_floor, research_type,
):
    s = Sample.objects.create(
        sample_number="A-2",
        research_type=research_type,
        container=container_on_floor,
    )
    response = auth_client.get(f"/api/v1/samples/{s.pk}/")
    assert response.status_code == 200
    assert response.data["current_location"] == "На полу: Комната 1"


@pytest.mark.django_db
def test_current_location_no_location(
    auth_client, container_no_location, research_type,
):
    s = Sample.objects.create(
        sample_number="A-3",
        research_type=research_type,
        container=container_no_location,
    )
    response = auth_client.get(f"/api/v1/samples/{s.pk}/")
    assert response.status_code == 200
    assert response.data["current_location"] == "Место не указано"