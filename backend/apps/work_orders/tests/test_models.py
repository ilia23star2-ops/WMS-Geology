"""
Тесты модели WorkOrder.

Покрывают доменные правила:
- уникальность пары (order_number, order_type);
- одинаковый номер с разными типами — допустим;
- self-reference linked_order_id;
- запрет self-link (Н/З не может ссылаться на себя);
- каскад: при удалении парного Н/З linked_order_id становится NULL;
- __str__ содержит номер и тип.
"""

import pytest
from django.db import IntegrityError

from apps.work_orders.models import WorkOrder


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def incoming(db):
    """Входящий Н/З."""
    return WorkOrder.objects.create(
        order_number="A-123",
        order_type=WorkOrder.TYPE_INCOMING,
    )


@pytest.fixture
def coded(db):
    """Зашифрованный Н/З."""
    return WorkOrder.objects.create(
        order_number="X-456",
        order_type=WorkOrder.TYPE_CODED,
    )


# ============================================================
# Создание
# ============================================================
def test_work_order_create_incoming(db):
    """Входящий Н/З создаётся."""
    wo = WorkOrder.objects.create(
        order_number="A-001",
        order_type=WorkOrder.TYPE_INCOMING,
    )
    assert wo.pk is not None
    assert wo.order_type == "INCOMING"
    assert wo.status == "ACTIVE"


def test_work_order_create_coded(db):
    """Зашифрованный Н/З создаётся."""
    wo = WorkOrder.objects.create(
        order_number="X-001",
        order_type=WorkOrder.TYPE_CODED,
    )
    assert wo.order_type == "CODED"


# ============================================================
# Уникальность (order_number, order_type)
# ============================================================
def test_work_order_unique_number_and_type_raises(db, incoming):
    """Два Н/З с одинаковым номером и типом — ошибка."""
    with pytest.raises(IntegrityError):
        WorkOrder.objects.create(
            order_number="A-123",
            order_type=WorkOrder.TYPE_INCOMING,
        )


def test_same_number_different_types_allowed(db, incoming):
    """Одинаковый номер, но разные типы — допустимо."""
    other = WorkOrder.objects.create(
        order_number="A-123",
        order_type=WorkOrder.TYPE_CODED,
    )
    assert other.pk is not None
    assert WorkOrder.objects.filter(order_number="A-123").count() == 2


# ============================================================
# Self-reference
# ============================================================
def test_work_order_linked_created(db, incoming, coded):
    """Связь INCOMING ↔ CODED через linked_order_id."""
    incoming.linked_order = coded
    incoming.save()
    incoming.refresh_from_db()
    assert incoming.linked_order_id == coded.pk


def test_work_order_not_linked_to_self_raises(db, incoming):
    """Н/З не может ссылаться на себя."""
    incoming.linked_order = incoming
    with pytest.raises(IntegrityError):
        incoming.save()


def test_work_order_linked_null_allowed(db):
    """linked_order = NULL допустим (парный ещё не создан)."""
    wo = WorkOrder.objects.create(
        order_number="A-999",
        order_type=WorkOrder.TYPE_INCOMING,
    )
    assert wo.linked_order is None


def test_work_order_linked_from_reverse_relation(db, incoming, coded):
    """Обратная связь через linked_from работает."""
    incoming.linked_order = coded
    incoming.save()
    assert incoming in list(coded.linked_from.all())


def test_work_order_delete_linked_sets_null(db, incoming, coded):
    """Удаление парного Н/З обнуляет linked_order_id."""
    incoming.linked_order = coded
    incoming.save()
    coded.delete()
    incoming.refresh_from_db()
    assert incoming.linked_order is None


# ============================================================
# __str__
# ============================================================
def test_work_order_str_contains_number_and_type(db, incoming):
    """__str__ содержит номер и человекочитаемый тип."""
    text = str(incoming)
    assert "A-123" in text
    assert "Входящий" in text


def test_work_order_str_coded(db, coded):
    """__str__ для зашифрованного содержит 'Зашифрованный'."""
    text = str(coded)
    assert "X-456" in text
    assert "Зашифрованный" in text


# ============================================================
# Сортировка
# ============================================================
def test_work_order_ordering_desc_by_created(db):
    """Свежие Н/З — первыми."""
    wo1 = WorkOrder.objects.create(
        order_number="A-100",
        order_type=WorkOrder.TYPE_INCOMING,
    )
    wo2 = WorkOrder.objects.create(
        order_number="A-101",
        order_type=WorkOrder.TYPE_INCOMING,
    )
    orders = list(WorkOrder.objects.all())
    assert orders[0] == wo2
    assert orders[1] == wo1