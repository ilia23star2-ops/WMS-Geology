"""
Тесты моделей приложения picking.
"""

import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError
from django.db.models import ProtectedError

from apps.picking.models import PickList, PickListItem, Shipment, ShipmentItem
from apps.samples.catalogs import Laboratory, ResearchType, Site
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


@pytest.fixture
def laboratory(db):
    return Laboratory.objects.create(code="ЛАБ-1", name="Лаборатория 1")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


# ============================================================
# PickList
# ============================================================
def test_pick_list_default_status_draft(db):
    pl = PickList.objects.create(pick_list_number="В-001")
    assert pl.status == "DRAFT"


def test_pick_list_number_unique(db):
    PickList.objects.create(pick_list_number="В-002")
    with pytest.raises(IntegrityError):
        PickList.objects.create(pick_list_number="В-002")


def test_pick_list_ordering_desc_by_created(db):
    pl1 = PickList.objects.create(pick_list_number="В-003")
    pl2 = PickList.objects.create(pick_list_number="В-004")
    items = list(PickList.objects.all())
    assert items[0] == pl2
    assert items[1] == pl1


def test_pick_list_str(pick_list):
    text = str(pick_list)
    assert "В-2026-001" in text
    assert "Черновик" in text


# ============================================================
# PickListItem
# ============================================================
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
    assert item.picked_by == user


def test_pick_list_item_sample_protected(db, pick_list, sample):
    PickListItem.objects.create(pick_list=pick_list, sample=sample)
    with pytest.raises(ProtectedError):
        sample.delete()


def test_pick_list_delete_cascades_to_items(db, pick_list, sample):
    PickListItem.objects.create(pick_list=pick_list, sample=sample)
    pk = pick_list.pk
    pick_list.delete()
    assert PickListItem.objects.filter(pick_list_id=pk).count() == 0


# ============================================================
# Shipment — базовое
# ============================================================
def test_shipment_create_minimal(db, user):
    s = Shipment.objects.create(
        shipment_number="ОТ-001", sent_by=user,
    )
    assert s.pk is not None
    assert s.sent_by == user
    assert s.direction == "OUTBOUND"
    assert s.status == "SENT"


def test_shipment_number_unique(db):
    Shipment.objects.create(shipment_number="ОТ-002", destination="Лаборатория")
    with pytest.raises(IntegrityError):
        Shipment.objects.create(shipment_number="ОТ-002", destination="Другая")


def test_shipment_str(db):
    s = Shipment.objects.create(
        shipment_number="ОТ-003", destination="Лаборатория Б",
    )
    text = str(s)
    assert "ОТ-003" in text
    assert "Отправлен" in text


# ============================================================
# Shipment — direction, status
# ============================================================
def test_shipment_direction_default_outbound(db):
    s = Shipment.objects.create(shipment_number="ОТ-010")
    assert s.direction == "OUTBOUND"


def test_shipment_direction_inbound(db):
    s = Shipment.objects.create(
        shipment_number="Р-010", direction=Shipment.DIRECTION_INBOUND,
    )
    assert s.direction == "INBOUND"
    assert "Входящая" in s.get_direction_display()


def test_shipment_status_draft(db):
    s = Shipment.objects.create(
        shipment_number="ОТ-011", status=Shipment.STATUS_DRAFT,
    )
    assert s.status == "DRAFT"
    assert "Черновик" in s.get_status_display()


def test_shipment_status_assembled(db):
    s = Shipment.objects.create(
        shipment_number="ОТ-012", status=Shipment.STATUS_ASSEMBLED,
    )
    assert s.status == "ASSEMBLED"
    assert "Собран" in s.get_status_display()


def test_shipment_status_partially_received(db):
    s = Shipment.objects.create(
        shipment_number="ОТ-013",
        status=Shipment.STATUS_PARTIALLY_RECEIVED,
    )
    assert s.status == "PARTIALLY_RECEIVED"
    assert "с расхождениями" in s.get_status_display()


def test_shipment_status_returned(db):
    s = Shipment.objects.create(
        shipment_number="ОТ-014", status=Shipment.STATUS_RETURNED,
    )
    assert s.status == "RETURNED"
    assert "Возвращён" in s.get_status_display()


def test_shipment_status_lost(db):
    s = Shipment.objects.create(
        shipment_number="ОТ-015", status=Shipment.STATUS_LOST,
    )
    assert s.status == "LOST"
    assert "Утерян" in s.get_status_display()


# ============================================================
# Shipment — лаборатория и участок
# ============================================================
def test_shipment_laboratory_link(db, laboratory):
    s = Shipment.objects.create(
        shipment_number="ОТ-020", laboratory=laboratory,
    )
    assert s.laboratory == laboratory
    assert s.laboratory.name == "Лаборатория 1"


def test_shipment_laboratory_delete_sets_null(db, laboratory):
    s = Shipment.objects.create(
        shipment_number="ОТ-021", laboratory=laboratory,
    )
    laboratory.delete()
    s.refresh_from_db()
    assert s.laboratory is None


def test_shipment_site_link(db, site):
    s = Shipment.objects.create(shipment_number="ОТ-022", site=site)
    assert s.site == site


def test_shipment_site_delete_sets_null(db, site):
    s = Shipment.objects.create(shipment_number="ОТ-023", site=site)
    site.delete()
    s.refresh_from_db()
    assert s.site is None


# ============================================================
# Shipment — поля рейса
# ============================================================
def test_shipment_driver_vehicle(db):
    from datetime import date
    s = Shipment.objects.create(
        shipment_number="ОТ-030",
        driver_name="Иванов И.И.",
        vehicle_number="А123БВ 77",
        shipment_date=date(2026, 10, 9),
    )
    assert s.driver_name == "Иванов И.И."
    assert s.vehicle_number == "А123БВ 77"
    assert s.shipment_date.year == 2026


def test_shipment_cancel_reason_default_empty(db):
    s = Shipment.objects.create(shipment_number="ОТ-031")
    assert s.cancel_reason == ""
    assert s.cancelled_at is None
    assert s.cancelled_by is None


# ============================================================
# ShipmentItem
# ============================================================
def test_shipment_item_create(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-040")
    item = ShipmentItem.objects.create(shipment=sh, sample=sample)
    assert item.pk is not None


def test_shipment_item_unique_pair(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-041")
    ShipmentItem.objects.create(shipment=sh, sample=sample)
    with pytest.raises(IntegrityError):
        ShipmentItem.objects.create(shipment=sh, sample=sample)


def test_shipment_item_with_pick_list_item(db, pick_list, sample):
    pli = PickListItem.objects.create(pick_list=pick_list, sample=sample)
    sh = Shipment.objects.create(shipment_number="ОТ-042")
    item = ShipmentItem.objects.create(
        shipment=sh, sample=sample, pick_list_item=pli,
    )
    assert item.pick_list_item == pli


def test_shipment_item_pick_list_item_delete_sets_null(db, pick_list, sample):
    pli = PickListItem.objects.create(pick_list=pick_list, sample=sample)
    sh = Shipment.objects.create(shipment_number="ОТ-043")
    item = ShipmentItem.objects.create(
        shipment=sh, sample=sample, pick_list_item=pli,
    )
    pli.delete()
    item.refresh_from_db()
    assert item.pick_list_item is None


def test_shipment_item_sample_protected(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-044")
    ShipmentItem.objects.create(shipment=sh, sample=sample)
    with pytest.raises(ProtectedError):
        sample.delete()


def test_shipment_delete_cascades_to_items(db, sample):
    sh = Shipment.objects.create(shipment_number="ОТ-045")
    ShipmentItem.objects.create(shipment=sh, sample=sample)
    pk = sh.pk
    sh.delete()
    assert ShipmentItem.objects.filter(shipment_id=pk).count() == 0