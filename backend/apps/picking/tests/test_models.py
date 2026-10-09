"""Тесты моделей приложения picking."""

import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db.models import ProtectedError

from apps.picking.models import PickList, PickListItem, Shipment, ShipmentItem
from apps.samples.catalogs import ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


@pytest.fixture
def user(db):
    return User.objects.create_user(username="picker", password="x")


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
        sample_number="PK-001", research_type=research_type, container=container,
    )


@pytest.fixture
def sample2(db, container, research_type):
    return Sample.objects.create(
        sample_number="PK-002", research_type=research_type, container=container,
    )


@pytest.fixture
def pick_list(db, user):
    return PickList.objects.create(
        pick_list_number="В-2026-001", created_by=user,
    )


def test_pick_list_default_status_draft(db):
    pl = PickList.objects.create(pick_list_number="В-001")
    assert pl.status == "DRAFT"


def test_pick_list_number_unique(db):
    PickList.objects.create(pick_list_number="В-002")
    with pytest.raises(IntegrityError):
        PickList.objects.create(pick_list_number="В-002")


def test_pick_list_str(pick_list):
    text = str(pick_list)
    assert "В-2026-001" in text


def test_pick_list_item_create(db, pick_list, sample):
    item = PickListItem.objects.create(pick_list=pick_list, sample=sample)
    assert item.pk is not None
    assert item.status == "PENDING"


def test_pick_list_item_unique_pair(db, pick_list, sample):
    PickListItem.objects.create(pick_list=pick_list, sample=sample)
    with pytest.raises(IntegrityError):
        PickListItem.objects.create(pick_list=pick_list, sample=sample)


def test_pick_list_item_picked(db, pick_list, sample, user):
    item = PickListItem.objects.create(pick_list=pick_list, sample=sample)
    item.status = PickListItem.STATUS_PICKED
    item.picked_by = user
    item.save()
    item.refresh_from_db()
    assert item.status == "PICKED"


def test_pick_list_item_sample_protected(db, pick_list, sample):
    PickListItem.objects.create(pick_list=pick_list, sample=sample)
    with pytest.raises(ProtectedError):
        sample.delete()


def test_pick_list_delete_cascades_to_items(db, pick_list, sample):
    PickListItem.objects.create(pick_list=pick_list, sample=sample)
    pk = pick_list.pk
    pick_list.delete()
    assert PickListItem.objects.filter(pick_list_id=pk).count() == 0


def test_shipment_create(db, user):
    s = Shipment.objects.create(
        shipment_number="ОТ-001", destination="Лаборатория А", sent_by=user,
    )
    assert s.pk is not None


def test_shipment_number_unique(db):
    Shipment.objects.create(shipment_number="ОТ-002", destination="Лаборатория")
    with pytest.raises(IntegrityError):
        Shipment.objects.create(shipment_number="ОТ-002", destination="Другая")


def test_shipment_item_create(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-004", destination="LAB")
    item = ShipmentItem.objects.create(shipment=sh, sample=sample)
    assert item.pk is not None


def test_shipment_item_unique_pair(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-005", destination="LAB")
    ShipmentItem.objects.create(shipment=sh, sample=sample)
    with pytest.raises(IntegrityError):
        ShipmentItem.objects.create(shipment=sh, sample=sample)


def test_shipment_item_with_pick_list_item(db, pick_list, sample):
    pli = PickListItem.objects.create(pick_list=pick_list, sample=sample)
    sh = Shipment.objects.create(shipment_number="ОТ-006", destination="LAB")
    item = ShipmentItem.objects.create(
        shipment=sh, sample=sample, pick_list_item=pli,
    )
    assert item.pick_list_item == pli


def test_shipment_item_pick_list_item_delete_sets_null(db, pick_list, sample):
    pli = PickListItem.objects.create(pick_list=pick_list, sample=sample)
    sh = Shipment.objects.create(shipment_number="ОТ-007", destination="LAB")
    item = ShipmentItem.objects.create(
        shipment=sh, sample=sample, pick_list_item=pli,
    )
    pli.delete()
    item.refresh_from_db()
    assert item.pick_list_item is None


def test_shipment_item_sample_protected(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-008", destination="LAB")
    ShipmentItem.objects.create(shipment=sh, sample=sample)
    with pytest.raises(ProtectedError):
        sample.delete()


def test_shipment_delete_cascades_to_items(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-009", destination="LAB")
    ShipmentItem.objects.create(shipment=sh, sample=sample)
    pk = sh.pk
    sh.delete()
    assert ShipmentItem.objects.filter(shipment_id=pk).count() == 0