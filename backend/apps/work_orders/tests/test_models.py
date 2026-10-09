"""
Тесты модели WorkOrder.

Покрывают:
- уникальность пары (order_number, order_type);
- self-reference linked_order_id;
- FK site (nullable, SET_NULL);
- каскады и __str__.
"""

import pytest
from django.db import IntegrityError

from apps.samples.catalogs import Site
from apps.work_orders.models import WorkOrder


@pytest.fixture
def incoming(db):
    return WorkOrder.objects.create(
        order_number="A-123", order_type=WorkOrder.TYPE_INCOMING,
    )


@pytest.fixture
def coded(db):
    return WorkOrder.objects.create(
        order_number="X-456", order_type=WorkOrder.TYPE_CODED,
    )


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


# ============================================================
# Создание
# ============================================================
def test_work_order_create_incoming(db):
    wo = WorkOrder.objects.create(
        order_number="A-001", order_type=WorkOrder.TYPE_INCOMING,
    )
    assert wo.pk is not None
    assert wo.order_type == "INCOMING"
    assert wo.status == "ACTIVE"


def test_work_order_create_coded(db):
    wo = WorkOrder.objects.create(
        order_number="X-001", order_type=WorkOrder.TYPE_CODED,
    )
    assert wo.order_type == "CODED"


# ============================================================
# Уникальность
# ============================================================
def test_work_order_unique_number_and_type_raises(db, incoming):
    with pytest.raises(IntegrityError):
        WorkOrder.objects.create(
            order_number="A-123", order_type=WorkOrder.TYPE_INCOMING,
        )


def test_same_number_different_types_allowed(db, incoming):
    other = WorkOrder.objects.create(
        order_number="A-123", order_type=WorkOrder.TYPE_CODED,
    )
    assert other.pk is not None
    assert WorkOrder.objects.filter(order_number="A-123").count() == 2


# ============================================================
# Self-reference
# ============================================================
def test_work_order_linked_created(db, incoming, coded):
    incoming.linked_order = coded
    incoming.save()
    incoming.refresh_from_db()
    assert incoming.linked_order_id == coded.pk


def test_work_order_not_linked_to_self_raises(db, incoming):
    incoming.linked_order = incoming
    with pytest.raises(IntegrityError):
        incoming.save()


def test_work_order_linked_null_allowed(db):
    wo = WorkOrder.objects.create(
        order_number="A-999", order_type=WorkOrder.TYPE_INCOMING,
    )
    assert wo.linked_order is None


def test_work_order_linked_from_reverse_relation(db, incoming, coded):
    incoming.linked_order = coded
    incoming.save()
    assert incoming in list(coded.linked_from.all())


def test_work_order_delete_linked_sets_null(db, incoming, coded):
    incoming.linked_order = coded
    incoming.save()
    coded.delete()
    incoming.refresh_from_db()
    assert incoming.linked_order is None


# ============================================================
# Site (FK, nullable)
# ============================================================
def test_work_order_site_null_by_default(db, incoming):
    """По умолчанию site=None."""
    assert incoming.site is None


def test_work_order_site_link(db, incoming, site):
    """WorkOrder можно привязать к участку."""
    incoming.site = site
    incoming.save()
    incoming.refresh_from_db()
    assert incoming.site == site


def test_work_order_site_reverse_relation(db, incoming, site):
    """Обратная связь: site.work_orders."""
    incoming.site = site
    incoming.save()
    assert incoming in list(site.work_orders.all())


def test_work_order_site_delete_sets_null(db, incoming, site):
    """Удаление участка обнуляет FK (SET_NULL)."""
    incoming.site = site
    incoming.save()
    site.delete()
    incoming.refresh_from_db()
    assert incoming.site is None


# ============================================================
# __str__, ordering
# ============================================================
def test_work_order_str_contains_number_and_type(db, incoming):
    text = str(incoming)
    assert "A-123" in text
    assert "Входящий" in text


def test_work_order_str_coded(db, coded):
    text = str(coded)
    assert "X-456" in text
    assert "Зашифрованный" in text


def test_work_order_ordering_desc_by_created(db):
    wo1 = WorkOrder.objects.create(
        order_number="A-100", order_type=WorkOrder.TYPE_INCOMING,
    )
    wo2 = WorkOrder.objects.create(
        order_number="A-101", order_type=WorkOrder.TYPE_INCOMING,
    )
    orders = list(WorkOrder.objects.all())
    assert orders[0] == wo2
    assert orders[1] == wo1