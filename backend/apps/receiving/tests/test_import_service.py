"""
Тесты сервиса импорта.
"""

import pytest

from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.receiving.parsers.types import (
    ParsedCell,
    ParsedRow,
    ParsedSheet,
    ParsedWorkbook,
)
from apps.receiving.services import apply_import, build_receipt_from_parsed
from apps.samples.catalogs import Laboratory, ResearchType, Site


@pytest.fixture
def session(db):
    return ImportSession.objects.create(file="imports/test.xlsx")


@pytest.fixture
def site(db):
    return Site.objects.create(
        code="TST",
        name="Тестовый",
        match_patterns=["TST", "Тест"],
    )


@pytest.fixture
def research_types(db):
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    ResearchType.objects.create(code="ХА", name="Хим")
    return ResearchType.objects.all()


@pytest.fixture
def laboratory(db):
    return Laboratory.objects.create(code="ЛАБ-1", name="Лаборатория 1")


def _make_parsed(sheet_name: str = "Тестовый") -> ParsedWorkbook:
    return ParsedWorkbook(sheets=[
        ParsedSheet(
            sheet_name=sheet_name,
            rows=[
                ParsedRow(
                    work_order_number="Тест001",
                    cells=[
                        ParsedCell(research_type_code="ШЛ", containers_count=5),
                        ParsedCell(research_type_code="ХА", containers_count=3),
                    ],
                ),
                ParsedRow(
                    work_order_number="Тест002",
                    cells=[
                        ParsedCell(research_type_code="ШЛ", containers_count=2),
                    ],
                ),
            ],
        ),
    ])


def test_build_receipt_success(db, session, site, research_types):
    parsed = _make_parsed()
    receipts, errors = build_receipt_from_parsed(parsed, session)
    assert len(receipts) == 1
    assert errors == []
    receipt = receipts[0]
    assert receipt.site == site
    assert receipt.status == Receipt.STATUS_EXPECTED
    assert receipt.items.count() == 3


def test_build_receipt_with_laboratory(
    db, session, site, research_types, laboratory,
):
    parsed = _make_parsed()
    receipts, _ = build_receipt_from_parsed(parsed, session, laboratory)
    assert receipts[0].laboratory == laboratory


def test_build_receipt_site_not_found(db, session, research_types):
    """Участок не найден — ошибка, Receipt не создаётся."""
    parsed = _make_parsed(sheet_name="НЕИЗВЕСТНЫЙ")
    receipts, errors = build_receipt_from_parsed(parsed, session)
    assert receipts == []
    assert len(errors) == 1
    assert "Участок не найден" in errors[0]["error"]


def test_build_receipt_research_type_not_found(db, session, site):
    """Тип не найден — ошибка, остальные строки обрабатываются."""
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    parsed = _make_parsed()
    receipts, errors = build_receipt_from_parsed(parsed, session)
    assert len(receipts) == 1
    assert len(errors) == 1
    assert "ХА" in errors[0]["error"]
    # Должны создаться только строки с ШЛ
    assert receipts[0].items.count() == 2


def test_build_receipt_creates_work_orders(db, session, site, research_types):
    from apps.work_orders.models import WorkOrder
    parsed = _make_parsed()
    build_receipt_from_parsed(parsed, session)
    assert WorkOrder.objects.filter(order_number="Тест001").exists()
    assert WorkOrder.objects.filter(order_number="Тест002").exists()


def test_build_receipt_links_work_order_to_site(
    db, session, site, research_types,
):
    parsed = _make_parsed()
    build_receipt_from_parsed(parsed, session)
    from apps.work_orders.models import WorkOrder
    wo = WorkOrder.objects.get(order_number="Тест001")
    assert wo.site == site


def test_build_receipt_item_fields(db, session, site, research_types):
    parsed = _make_parsed()
    receipts, _ = build_receipt_from_parsed(parsed, session)
    items = receipts[0].items.all()
    item_shl = items.filter(research_type__code="ШЛ").first()
    assert item_shl.expected_samples_count == 5
    assert item_shl.expected_work_order_number == "Тест001"
    assert item_shl.expected_research_type_code == "ШЛ"
    assert item_shl.expected_site_code == "TST"
    assert item_shl.work_order.order_number == "Тест001"
    assert item_shl.site == site
    assert item_shl.status == ReceiptItem.STATUS_EXPECTED


def test_apply_import_success(db, session, site, research_types):
    parsed = _make_parsed()
    receipts, errors = apply_import(parsed, session)
    session.refresh_from_db()
    assert errors == []
    assert session.status == ImportSession.STATUS_APPLIED
    assert session.receipt == receipts[0]


def test_apply_import_with_errors(db, session, site):
    """Ошибки → status=PARSED (не APPLIED)."""
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    parsed = _make_parsed()
    receipts, errors = apply_import(parsed, session)
    session.refresh_from_db()
    assert len(errors) == 1
    assert session.status == ImportSession.STATUS_PARSED
    assert session.receipt == receipts[0]


def test_apply_import_no_sheets(db, session):
    """Пустой workbook — status=ERROR."""
    parsed = ParsedWorkbook()
    receipts, errors = apply_import(parsed, session)
    session.refresh_from_db()
    assert receipts == []
    assert session.status == ImportSession.STATUS_ERROR


def test_apply_import_site_not_found(db, session, research_types):
    """Участок не найден → status=ERROR."""
    parsed = _make_parsed(sheet_name="НЕИЗВЕСТНЫЙ")
    receipts, errors = apply_import(parsed, session)
    session.refresh_from_db()
    assert receipts == []
    assert session.status == ImportSession.STATUS_ERROR


def test_apply_import_idempotent_work_orders(db, session, site, research_types):
    """Повторный импорт не создаёт дубликаты Н/З."""
    from apps.work_orders.models import WorkOrder
    parsed = _make_parsed()
    apply_import(parsed, session)
    count_after_first = WorkOrder.objects.count()

    session2 = ImportSession.objects.create(file="imports/test2.xlsx")
    apply_import(parsed, session2)
    assert WorkOrder.objects.count() == count_after_first