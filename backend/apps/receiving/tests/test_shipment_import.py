"""
Тесты сервиса `apply_shipment_import` (receiving-1b / 2e-2b).

Покрывают:
- создание Shipment (INBOUND, SENT) + Receipt (site=None);
- по 1 ReceiptItem и 1 Container на каждую тару;
- draft-поля Container;
- get_or_create ContainerType по имени;
- генерацию shipment_number и использование заданного;
- статусы ImportSession (APPLIED / PARSED / ERROR);
- `multi_date_match` → NEEDS_CONFIRMATION (единственный вопрос);
- `no_dates` / `target_date_not_matched` → TARGET_DATE_MISSING
  (информационные записи, не вопросы);
- ошибки: site не найден, research_type не найден.
"""

from datetime import date

import pytest

from apps.picking.models import Shipment
from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.receiving.parsers.types import (
    ParsedCell,
    ParsedRow,
    ParsedSheet,
    ParsedWorkbook,
)
from apps.receiving.services import apply_shipment_import
from apps.samples.catalogs import Laboratory, ResearchType, Site
from apps.storage.models import Container, ContainerType


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


TARGET = date(2026, 10, 14)


def _make_parsed(
    sheet_name: str = "Тестовый",
    rows: list | None = None,
) -> ParsedWorkbook:
    if rows is None:
        rows = [
            ParsedRow(
                work_order_number="Тест001",
                cells=[
                    ParsedCell(
                        research_type_code="ШЛ",
                        containers_count=3,
                        container_type_name="Ящики",
                        dates=[TARGET],
                    ),
                    ParsedCell(
                        research_type_code="ХА",
                        containers_count=2,
                        container_type_name="Ящики",
                        dates=[TARGET],
                    ),
                ],
            ),
        ]
    return ParsedWorkbook(sheets=[
        ParsedSheet(sheet_name=sheet_name, rows=rows),
    ])


# ============================================================
# Успешный сценарий
# ============================================================
def test_shipment_import_success(db, session, site, research_types):
    parsed = _make_parsed()
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )

    assert shipment is not None
    assert errors == []
    assert shipment.direction == Shipment.DIRECTION_INBOUND
    assert shipment.status == Shipment.STATUS_SENT
    assert shipment.shipment_date == TARGET
    assert shipment.site is None

    assert Receipt.objects.count() == 1
    receipt = Receipt.objects.first()
    assert receipt.shipment == shipment
    assert receipt.site is None
    assert receipt.expected_date == TARGET

    assert ReceiptItem.objects.count() == 5
    assert Container.objects.count() == 5

    assert ContainerType.objects.filter(name="Ящики").count() == 1


def test_shipment_import_container_draft_fields(
    db, session, site, research_types,
):
    parsed = _make_parsed()
    apply_shipment_import(parsed, session, target_date=TARGET)

    containers = Container.objects.all()
    assert all(c.status == Container.STATUS_IN_TRANSIT for c in containers)
    assert all(c.container_number is None for c in containers)

    c = containers.filter(draft_research_type__code="ШЛ").first()
    assert c.draft_site == site
    assert c.draft_work_order_coded == "Тест001"
    assert c.draft_work_order_incoming == ""


def test_shipment_import_receipt_item_links_container(
    db, session, site, research_types,
):
    parsed = _make_parsed()
    apply_shipment_import(parsed, session, target_date=TARGET)

    items = ReceiptItem.objects.all()
    assert items.count() == 5
    for item in items:
        assert item.container is not None
        assert item.expected_samples_count == 1


def test_shipment_import_import_session_status(
    db, session, site, research_types,
):
    parsed = _make_parsed()
    apply_shipment_import(parsed, session, target_date=TARGET)

    session.refresh_from_db()
    assert session.status == ImportSession.STATUS_APPLIED
    assert session.receipt is not None


def test_shipment_import_generates_number(db, session, site, research_types):
    parsed = _make_parsed()
    shipment, _ = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )
    assert shipment.shipment_number.startswith("Р-2026-")


def test_shipment_import_uses_given_number(
    db, session, site, research_types,
):
    parsed = _make_parsed()
    shipment, _ = apply_shipment_import(
        parsed, session,
        target_date=TARGET,
        shipment_number="Р-2026-TEST",
    )
    assert shipment.shipment_number == "Р-2026-TEST"


# ============================================================
# Мультилистовой файл
# ============================================================
def test_shipment_import_multiple_sheets(db, session, research_types):
    Site.objects.create(code="TST", name="Тестовый")
    Site.objects.create(code="СЕВ", name="Северный")

    parsed = ParsedWorkbook(sheets=[
        ParsedSheet(
            sheet_name="Тестовый",
            rows=[
                ParsedRow(
                    work_order_number="T-1",
                    cells=[ParsedCell(
                        research_type_code="ШЛ",
                        containers_count=1,
                        container_type_name="Ящики",
                        dates=[TARGET],
                    )],
                ),
            ],
        ),
        ParsedSheet(
            sheet_name="Северный",
            rows=[
                ParsedRow(
                    work_order_number="S-1",
                    cells=[ParsedCell(
                        research_type_code="ШЛ",
                        containers_count=2,
                        container_type_name="Ящики",
                        dates=[TARGET],
                    )],
                ),
            ],
        ),
    ])

    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )

    assert shipment is not None
    assert errors == []
    assert Receipt.objects.count() == 1
    assert Container.objects.count() == 3
    sites = set(ReceiptItem.objects.values_list("site__code", flat=True))
    assert sites == {"TST", "СЕВ"}


# ============================================================
# get_or_create ContainerType
# ============================================================
def test_shipment_import_reuses_existing_container_type(
    db, session, site, research_types,
):
    ContainerType.objects.create(name="Ящики")
    parsed = _make_parsed()
    apply_shipment_import(parsed, session, target_date=TARGET)
    assert ContainerType.objects.filter(name="Ящики").count() == 1


def test_shipment_import_creates_new_container_type(
    db, session, site, research_types,
):
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="Тест001",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=1,
                container_type_name="Биг-бэг",
                dates=[TARGET],
            )],
        ),
    ])
    apply_shipment_import(parsed, session, target_date=TARGET)
    assert ContainerType.objects.filter(name="Биг-бэг").exists()


# ============================================================
# multi_date_match → NEEDS_CONFIRMATION
# ============================================================
def test_shipment_import_multi_date_match_question(
    db, session, site, research_types,
):
    """Несколько дат, target входит → вопрос + ячейка обработана."""
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="TST00472",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=3,
                container_type_name="Ящики",
                dates=[date(2026, 8, 13), TARGET, date(2026, 5, 25)],
            )],
        ),
    ])
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )

    assert shipment is not None
    assert Container.objects.count() == 3

    questions = [
        e for e in errors if e.get("code") == "NEEDS_CONFIRMATION"
    ]
    assert len(questions) == 1
    assert questions[0]["reason"] == "multi_date_match"
    assert questions[0]["work_order"] == "TST00472"


def test_shipment_import_questions_set_session_status_parsed(
    db, session, site, research_types,
):
    """С вопросами — PARSED, не APPLIED."""
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="TST00001",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=1,
                container_type_name="Ящики",
                dates=[date(2026, 8, 13), TARGET],
            )],
        ),
    ])
    apply_shipment_import(parsed, session, target_date=TARGET)
    session.refresh_from_db()
    assert session.status == ImportSession.STATUS_PARSED


# ============================================================
# no_dates / target_date_not_matched → TARGET_DATE_MISSING
# ============================================================
def test_shipment_import_no_dates_is_not_a_question(
    db, session, site, research_types,
):
    """
    Ячейка без дат → TARGET_DATE_MISSING (не вопрос), рейс ERROR,
    если больше нечего создавать.
    """
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="TST00001",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=2,
                container_type_name="Ящики",
                dates=[],
            )],
        ),
    ])
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )

    assert shipment is None
    assert Shipment.objects.count() == 0

    session.refresh_from_db()
    assert session.status == ImportSession.STATUS_ERROR

    assert not any(
        e.get("code") == "NEEDS_CONFIRMATION" for e in errors
    )
    missing = [
        e for e in errors if e.get("code") == "TARGET_DATE_MISSING"
    ]
    assert len(missing) == 1
    assert missing[0]["reason"] == "no_dates"
    assert missing[0]["message"] == "На выбранную дату информации нет."


def test_shipment_import_target_date_not_matched_is_not_a_question(
    db, session, site, research_types,
):
    """
    Даты есть, target не входит → TARGET_DATE_MISSING (не вопрос).
    """
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="TST00999",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=5,
                container_type_name="Ящики",
                dates=[date(2026, 1, 1)],
            )],
        ),
    ])
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )
    assert shipment is None

    assert not any(
        e.get("code") == "NEEDS_CONFIRMATION" for e in errors
    )
    missing = [
        e for e in errors if e.get("code") == "TARGET_DATE_MISSING"
    ]
    assert len(missing) == 1
    assert missing[0]["reason"] == "target_date_not_matched"


def test_shipment_import_mixed_creates_shipment_with_missing_reports(
    db, session, site, research_types,
):
    """
    Есть валидные ячейки + TARGET_DATE_MISSING → рейс создан,
    TARGET_DATE_MISSING в parse_errors, статус APPLIED
    (missing не блокирует).
    """
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="TST00001",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=2,
                container_type_name="Ящики",
                dates=[TARGET],
            )],
        ),
        ParsedRow(
            work_order_number="TST00999",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=5,
                container_type_name="Ящики",
                dates=[date(2026, 1, 1)],
            )],
        ),
    ])
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )

    assert shipment is not None
    assert Container.objects.count() == 2

    session.refresh_from_db()
    assert session.status == ImportSession.STATUS_APPLIED

    missing = [
        e for e in errors if e.get("code") == "TARGET_DATE_MISSING"
    ]
    assert len(missing) == 1


# ============================================================
# Ошибки
# ============================================================
def test_shipment_import_site_not_found(
    db, session, research_types,
):
    parsed = _make_parsed(sheet_name="НЕИЗВЕСТНЫЙ")
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )
    assert shipment is None
    assert Container.objects.count() == 0
    assert Shipment.objects.count() == 0
    assert Receipt.objects.count() == 0

    session.refresh_from_db()
    assert session.status == ImportSession.STATUS_ERROR


def test_shipment_import_research_type_not_found(
    db, session, site, research_types,
):
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="Тест001",
            cells=[ParsedCell(
                research_type_code="НЕТ_ТИПА",
                containers_count=5,
                container_type_name="Ящики",
                dates=[TARGET],
            )],
        ),
    ])
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )
    assert shipment is None
    assert any(
        "Тип исследования не найден" in str(e.get("error", ""))
        for e in errors
    )


def test_shipment_import_no_rows_for_target_date(
    db, session, site, research_types,
):
    """
    Единственная ячейка с датой вне target_date → TARGET_DATE_MISSING,
    рейс не создаётся.
    """
    parsed = _make_parsed(rows=[
        ParsedRow(
            work_order_number="Тест001",
            cells=[ParsedCell(
                research_type_code="ШЛ",
                containers_count=3,
                container_type_name="Ящики",
                dates=[date(2026, 1, 1)],
            )],
        ),
    ])
    shipment, errors = apply_shipment_import(
        parsed, session, target_date=TARGET,
    )
    assert shipment is None
    assert Shipment.objects.count() == 0
    assert Container.objects.count() == 0

    session.refresh_from_db()
    assert session.status == ImportSession.STATUS_ERROR