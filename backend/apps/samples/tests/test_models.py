"""
Тесты моделей приложения samples.

Покрывают доменные правила:
- sample_number НЕ уникален (разные типы → разные строки);
- проба обязательно привязана к таре;
- M:N связь проба ↔ Н/З через SampleWorkOrder;
- уникальность пары (sample, work_order);
- каскадное удаление SampleWorkOrder;
- legacy_data (JSONB) сохраняется и читается.
"""

import pytest
from django.db import IntegrityError
from django.db.models import ProtectedError

from apps.samples.models import Sample, SampleWorkOrder, Well
from apps.storage.models import Cell, Container, Pallet, Rack, Room, Section, Tier
from apps.work_orders.models import WorkOrder


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def container(db):
    """Тара для проб."""
    return Container.objects.create(container_number="T-001")


@pytest.fixture
def well(db):
    """Скважина."""
    return Well.objects.create(
        well_name="Скв-101",
        field_name="Месторождение А",
        cluster="Куст-1",
    )


@pytest.fixture
def incoming_wo(db):
    """Входящий Н/З."""
    return WorkOrder.objects.create(
        order_number="A-100",
        order_type=WorkOrder.TYPE_INCOMING,
    )


@pytest.fixture
def coded_wo(db):
    """Зашифрованный Н/З."""
    return WorkOrder.objects.create(
        order_number="X-200",
        order_type=WorkOrder.TYPE_CODED,
    )


# ============================================================
# Well
# ============================================================
def test_well_create_returns_str_name(db):
    """Well создаётся, __str__ возвращает имя."""
    well = Well.objects.create(well_name="Скв-001")
    assert str(well) == "Скв-001"


def test_well_ordering_by_name(db):
    """Скважины сортируются по well_name."""
    Well.objects.create(well_name="Скв-200")
    Well.objects.create(well_name="Скв-100")
    names = list(Well.objects.values_list("well_name", flat=True))
    assert names == ["Скв-100", "Скв-200"]


# ============================================================
# Sample — базовое создание
# ============================================================
def test_sample_create_minimal(db, container):
    """Проба создаётся с минимумом полей."""
    sample = Sample.objects.create(
        sample_number="12345",
        research_type="Шлифы",
        container=container,
    )
    assert sample.pk is not None
    assert sample.status == "IN_STORAGE"


def test_sample_number_not_unique(db, container):
    """Одинаковый sample_number с разным research_type — допустимо."""
    Sample.objects.create(
        sample_number="12345",
        research_type="Шлифы",
        container=container,
    )
    Sample.objects.create(
        sample_number="12345",
        research_type="Химия",
        container=container,
    )
    assert Sample.objects.filter(sample_number="12345").count() == 2


def test_sample_container_required(db):
    """Проба без тары — ошибка."""
    with pytest.raises(IntegrityError):
        Sample.objects.create(
            sample_number="00001",
            research_type="Шлифы",
        )


def test_sample_qr_code_unique_raises(db, container):
    """Два одинаковых QR-кода — ошибка."""
    Sample.objects.create(
        sample_number="11111",
        research_type="Шлифы",
        container=container,
        qr_code="WMSG:SAMPLE:1",
    )
    with pytest.raises(IntegrityError):
        Sample.objects.create(
            sample_number="11112",
            research_type="Химия",
            container=container,
            qr_code="WMSG:SAMPLE:1",
        )


def test_sample_legacy_data_jsonb(db, container):
    """legacy_data сохраняет и возвращает JSON."""
    sample = Sample.objects.create(
        sample_number="22222",
        research_type="Изотопы",
        container=container,
        legacy_data={
            "old_label": "LAB-A-777",
            "lab": "Лаборатория А",
            "received_at": "2025-01-15",
        },
    )
    sample.refresh_from_db()
    assert sample.legacy_data["old_label"] == "LAB-A-777"
    assert sample.legacy_data["lab"] == "Лаборатория А"


def test_sample_container_protect_on_delete(db, container):
    """Удаление тары с пробами запрещено (PROTECT)."""
    Sample.objects.create(
        sample_number="33333",
        research_type="Шлифы",
        container=container,
    )
    with pytest.raises(ProtectedError):
        container.delete()


# ============================================================
# SampleWorkOrder — M:N
# ============================================================
def test_sample_work_order_create(db, container, incoming_wo):
    """Связь проба ↔ Н/З создаётся."""
    sample = Sample.objects.create(
        sample_number="44001",
        research_type="Шлифы",
        container=container,
    )
    link = SampleWorkOrder.objects.create(
        sample=sample,
        work_order=incoming_wo,
    )
    assert link.pk is not None


def test_sample_work_order_unique_raises(db, container, incoming_wo):
    """Повторная связь той же пары — ошибка."""
    sample = Sample.objects.create(
        sample_number="44002",
        research_type="Шлифы",
        container=container,
    )
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming_wo)
    with pytest.raises(IntegrityError):
        SampleWorkOrder.objects.create(sample=sample, work_order=incoming_wo)


def test_sample_linked_to_two_work_orders(
    db, container, incoming_wo, coded_wo
):
    """Проба может быть связана и с входящим, и с зашифрованным Н/З."""
    sample = Sample.objects.create(
        sample_number="44003",
        research_type="Шлифы",
        container=container,
    )
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming_wo)
    SampleWorkOrder.objects.create(sample=sample, work_order=coded_wo)
    assert sample.work_order_links.count() == 2


def test_filter_by_incoming_finds_coded_sample(
    db, container, incoming_wo, coded_wo
):
    """Фильтр по входящему Н/З находит пробу, чей текущий Н/З — кодированный."""
    sample = Sample.objects.create(
        sample_number="44004",
        research_type="Шлифы",
        container=container,
        current_work_order=coded_wo,
    )
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming_wo)
    SampleWorkOrder.objects.create(sample=sample, work_order=coded_wo)

    found = Sample.objects.filter(
        work_order_links__work_order__order_number="A-100"
    )
    assert sample in found


def test_sample_delete_cascades_to_links(db, container, incoming_wo):
    """Удаление пробы каскадно удаляет связи с Н/З."""
    sample = Sample.objects.create(
        sample_number="44005",
        research_type="Шлифы",
        container=container,
    )
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming_wo)
    sample_pk = sample.pk
    sample.delete()
    assert SampleWorkOrder.objects.filter(sample_id=sample_pk).count() == 0


def test_work_order_delete_cascades_to_links(db, container, incoming_wo):
    """Удаление Н/З каскадно удаляет связи с пробами."""
    sample = Sample.objects.create(
        sample_number="44006",
        research_type="Шлифы",
        container=container,
    )
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming_wo)
    incoming_wo.delete()
    assert SampleWorkOrder.objects.filter(sample=sample).count() == 0
    # Проба остаётся в БД
    assert Sample.objects.filter(pk=sample.pk).exists()


# ============================================================
# __str__
# ============================================================
def test_sample_str_contains_number_and_type(db, container):
    """__str__ содержит номер и тип исследования."""
    sample = Sample.objects.create(
        sample_number="55001",
        research_type="Химия",
        container=container,
    )
    text = str(sample)
    assert "55001" in text
    assert "Химия" in text