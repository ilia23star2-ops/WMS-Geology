"""Тесты API приложения picking."""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.picking.models import PickList, PickListItem, Shipment, ShipmentItem
from apps.samples.catalogs import ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="picking_api", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-PICK-001", container_type=container_type,
    )


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def sample(db, container, research_type):
    return Sample.objects.create(
        sample_number="PICK-001", research_type=research_type, container=container,
    )


@pytest.fixture
def sample2(db, container, research_type):
    return Sample.objects.create(
        sample_number="PICK-002", research_type=research_type, container=container,
    )


@pytest.fixture
def pick_list(db):
    return PickList.objects.create(pick_list_number="В-2026-001")


# ============================================================
# Аутентификация
# ============================================================
def test_pick_lists_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/pick-lists/")
    assert response.status_code in (401, 403)


# ============================================================
# PickList — CRUD
# ============================================================
def test_pick_list_create_sets_created_by(auth_client, db):
    response = auth_client.post(
        "/api/v1/pick-lists/",
        {"pick_list_number": "В-001"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == "DRAFT"
    assert response.data["created_by"] is not None


def test_pick_list_retrieve(auth_client, pick_list):
    response = auth_client.get(f"/api/v1/pick-lists/{pick_list.pk}/")
    assert response.status_code == 200
    assert response.data["pick_list_number"] == "В-2026-001"


def test_pick_list_list_filter_by_status(auth_client, pick_list):
    PickList.objects.create(
        pick_list_number="В-002", status=PickList.STATUS_ACTIVE,
    )
    response = auth_client.get("/api/v1/pick-lists/?status=ACTIVE")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Custom action: activate
# ============================================================
def test_pick_list_activate_success(auth_client, pick_list):
    response = auth_client.post(
        f"/api/v1/pick-lists/{pick_list.pk}/activate/", format="json",
    )
    assert response.status_code == 200
    pick_list.refresh_from_db()
    assert pick_list.status == "ACTIVE"


def test_pick_list_activate_non_draft_raises(auth_client, pick_list):
    pick_list.status = PickList.STATUS_ACTIVE
    pick_list.save()
    response = auth_client.post(
        f"/api/v1/pick-lists/{pick_list.pk}/activate/", format="json",
    )
    assert response.status_code == 400


# ============================================================
# Custom action: complete
# ============================================================
def test_pick_list_complete_success(auth_client, pick_list):
    pick_list.status = PickList.STATUS_ACTIVE
    pick_list.save()
    response = auth_client.post(
        f"/api/v1/pick-lists/{pick_list.pk}/complete/", format="json",
    )
    assert response.status_code == 200
    pick_list.refresh_from_db()
    assert pick_list.status == "COMPLETED"
    assert pick_list.completed_at is not None


def test_pick_list_complete_non_active_raises(auth_client, pick_list):
    response = auth_client.post(
        f"/api/v1/pick-lists/{pick_list.pk}/complete/", format="json",
    )
    assert response.status_code == 400


# ============================================================
# PickListItem
# ============================================================
def test_pick_list_item_create(auth_client, pick_list, sample):
    response = auth_client.post(
        "/api/v1/pick-items/",
        {"pick_list": pick_list.pk, "sample": sample.pk},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == "PENDING"
    assert response.data["sample_number"] == "PICK-001"


def test_pick_list_item_filter_by_pick_list(
    auth_client, pick_list, sample, sample2,
):
    other_list = PickList.objects.create(pick_list_number="В-100")
    PickListItem.objects.create(pick_list=pick_list, sample=sample)
    PickListItem.objects.create(pick_list=other_list, sample=sample2)

    response = auth_client.get(
        f"/api/v1/pick-items/?pick_list_id={pick_list.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Custom action: pick
# ============================================================
def test_pick_item_pick_success(auth_client, pick_list, sample):
    item = PickListItem.objects.create(pick_list=pick_list, sample=sample)
    response = auth_client.post(
        f"/api/v1/pick-items/{item.pk}/pick/", format="json",
    )
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.status == "PICKED"
    assert item.picked_at is not None
    assert item.picked_by is not None


def test_pick_item_pick_non_pending_raises(auth_client, pick_list, sample):
    item = PickListItem.objects.create(
        pick_list=pick_list, sample=sample,
        status=PickListItem.STATUS_PICKED,
    )
    response = auth_client.post(
        f"/api/v1/pick-items/{item.pk}/pick/", format="json",
    )
    assert response.status_code == 400


# ============================================================
# Shipment
# ============================================================
def test_shipment_create_sets_sent_by(auth_client, db):
    response = auth_client.post(
        "/api/v1/shipments/",
        {"shipment_number": "ОТ-001", "destination": "Лаборатория А"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["sent_by"] is not None
    assert response.data["destination"] == "Лаборатория А"


# ============================================================
# Custom action: add-from-pick-list
# ============================================================
def test_add_from_pick_list_success(auth_client, pick_list, sample, sample2):
    PickListItem.objects.create(
        pick_list=pick_list, sample=sample,
        status=PickListItem.STATUS_PICKED,
    )
    PickListItem.objects.create(
        pick_list=pick_list, sample=sample2,
        status=PickListItem.STATUS_PICKED,
    )
    shipment = Shipment.objects.create(
        shipment_number="ОТ-100", destination="Лаборатория Б",
    )
    response = auth_client.post(
        f"/api/v1/shipments/{shipment.pk}/add-from-pick-list/",
        {"pick_list_id": pick_list.pk},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["added_count"] == 2
    assert shipment.items.count() == 2


def test_add_from_pick_list_no_picked_raises(auth_client, pick_list, sample):
    PickListItem.objects.create(pick_list=pick_list, sample=sample)  # PENDING
    shipment = Shipment.objects.create(
        shipment_number="ОТ-101", destination="LAB",
    )
    response = auth_client.post(
        f"/api/v1/shipments/{shipment.pk}/add-from-pick-list/",
        {"pick_list_id": pick_list.pk},
        format="json",
    )
    assert response.status_code == 400


def test_add_from_pick_list_missing_id_raises(auth_client, db):
    shipment = Shipment.objects.create(
        shipment_number="ОТ-102", destination="LAB",
    )
    response = auth_client.post(
        f"/api/v1/shipments/{shipment.pk}/add-from-pick-list/",
        {}, format="json",
    )
    assert response.status_code == 400


def test_add_from_pick_list_nonexistent_raises(auth_client, db):
    shipment = Shipment.objects.create(
        shipment_number="ОТ-103", destination="LAB",
    )
    response = auth_client.post(
        f"/api/v1/shipments/{shipment.pk}/add-from-pick-list/",
        {"pick_list_id": 99999}, format="json",
    )
    assert response.status_code == 404


# ============================================================
# ShipmentItem — фильтр
# ============================================================
def test_shipment_items_filter_by_shipment(auth_client, sample, sample2, db):
    sh1 = Shipment.objects.create(shipment_number="ОТ-200", destination="A")
    sh2 = Shipment.objects.create(shipment_number="ОТ-201", destination="B")
    ShipmentItem.objects.create(shipment=sh1, sample=sample)
    ShipmentItem.objects.create(shipment=sh2, sample=sample2)

    response = auth_client.get(
        f"/api/v1/shipment-items/?shipment_id={sh1.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1