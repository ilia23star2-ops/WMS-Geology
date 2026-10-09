"""
Тесты моделей приложения receiving.

Покрывают:
- Receipt: уникальность номера, статусы, FK на Laboratory/Site/Shipment.
- ReceiptItem: FK на Receipt (CASCADE), FK на Container (SET_NULL),
  JSONB scanned_barcodes, статусы.
- ImportSession: FK на Receipt (SET_NULL), JSONB parse_errors, статусы.
"""

import pytest
from django.contrib.auth.models import User

from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.samples.catalogs import Laboratory, ResearchType, Site
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def user(db):
    return User.objects.create_user(username="receiver", password="x")


@pytest.fixture
def laboratory(db):
    return Laboratory.objects.create(code="ЛАБ-1", name="Лаборатория 1")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-001", container_type=container_type,
    )


@pytest.fixture
def work_order(db):
    return WorkOrder.objects.create(
        order_number="A-100", order_type=WorkOrder.TYPE_INCOMING,
    )


@pytest.fixture
def receipt(db, laboratory, site):
    return Receipt.objects.create(
        receipt_number="ПР-2026-001",
        laboratory=laboratory,
        site=site,
    )


# ============================================================
# Receipt
# ============================================================
def test_receipt_default_status_expected(db):
    r = Receipt.objects.create(receipt_number="ПР-001")
    assert r.status == "EXPECTED"
    assert r.get_status_display() == "Ожидается"


def test_receipt_number_unique(db):
    from django.db import IntegrityError
    Receipt.objects.create(receipt_number="ПР-002")
    with pytest.raises(IntegrityError):
        Receipt.objects.create(receipt_number="ПР-002")


def test_receipt_fk_nullable(db):
    """Все FK — nullable."""
    r = Receipt.objects.create(receipt_number="ПР-003")
    assert r.laboratory is None
    assert r.site is None
    assert r.shipment is None
    assert r.imported_by is None
    assert r.received_by is None


def test_receipt_laboratory_set_null(db, laboratory):
    r = Receipt.objects.create(
        receipt_number="ПР-004", laboratory=laboratory,
    )
    laboratory.delete()
    r.refresh_from_db()
    assert r.laboratory is None


def test_receipt_site_set_null(db, site):
    r = Receipt.objects.create(receipt_number="ПР-005", site=site)
    site.delete()
    r.refresh_from_db()
    assert r.site is None


def test_receipt_str(db, receipt):
    text = str(receipt)
    assert "ПР-2026-001" in text
    assert "Ожидается" in text


def test_receipt_ordering_desc_by_created(db):
    r1 = Receipt.objects.create(receipt_number="ПР-100")
    r2 = Receipt.objects.create(receipt_number="ПР-101")
    items = list(Receipt.objects.all())
    assert items[0] == r2
    assert items[1] == r1


# ============================================================
# ReceiptItem
# ============================================================
def test_receipt_item_default_status(db, receipt):
    item = ReceiptItem.objects.create(receipt=receipt)
    assert item.status == "EXPECTED"
    assert item.scanned_barcodes == []


def test_receipt_item_fk_optional(db, receipt):
    item = ReceiptItem.objects.create(receipt=receipt)
    assert item.container is None
    assert item.work_order is None
    assert item.research_type is None
    assert item.site is None


def test_receipt_item_receipt_cascade(db, receipt):
    ReceiptItem.objects.create(receipt=receipt)
    ReceiptItem.objects.create(receipt=receipt)
    pk = receipt.pk
    receipt.delete()
    assert ReceiptItem.objects.filter(receipt_id=pk).count() == 0


def test_receipt_item_container_set_null(db, receipt, container):
    item = ReceiptItem.objects.create(receipt=receipt, container=container)
    container.delete()
    item.refresh_from_db()
    assert item.container is None


def test_receipt_item_work_order_set_null(db, receipt, work_order):
    item = ReceiptItem.objects.create(receipt=receipt, work_order=work_order)
    work_order.delete()
    item.refresh_from_db()
    assert item.work_order is None


def test_receipt_item_research_type_set_null(db, receipt, research_type):
    item = ReceiptItem.objects.create(
        receipt=receipt, research_type=research_type,
    )
    research_type.delete()
    item.refresh_from_db()
    assert item.research_type is None


def test_receipt_item_scanned_barcodes_jsonb(db, receipt):
    item = ReceiptItem.objects.create(
        receipt=receipt,
        scanned_barcodes=["4600123456789", "4600123456790"],
    )
    item.refresh_from_db()
    assert item.scanned_barcodes == ["4600123456789", "4600123456790"]


def test_receipt_item_status_discrepancy(db, receipt):
    item = ReceiptItem.objects.create(
        receipt=receipt, status=ReceiptItem.STATUS_DISCREPANCY,
    )
    assert item.status == "DISCREPANCY"
    assert "Расхождение" in item.get_status_display()


def test_receipt_item_str(db, receipt):
    item = ReceiptItem.objects.create(
        receipt=receipt, expected_container_number="T-001",
    )
    text = str(item)
    assert "ПР-2026-001" in text
    assert "T-001" in text


# ============================================================
# ImportSession
# ============================================================
def test_import_session_default_status(db):
    """Default status — PARSING (пока идёт разбор)."""
    file_obj = "receipts/example.xlsx"
    s = ImportSession.objects.create(file=file_obj)
    assert s.status == "PARSING"
    assert s.parse_errors == []


def test_import_session_file_format_default(db):
    s = ImportSession.objects.create(file="receipts/example.xlsx")
    assert s.file_format == "XLSX"


def test_import_session_receipt_set_null(db, receipt):
    s = ImportSession.objects.create(
        file="receipts/example.xlsx", receipt=receipt,
    )
    receipt.delete()
    s.refresh_from_db()
    assert s.receipt is None


def test_import_session_parse_errors_jsonb(db):
    s = ImportSession.objects.create(
        file="receipts/example.xlsx",
        parse_errors=[
            {"row": 3, "error": "Номер тары не найден"},
            {"row": 7, "error": "Тип исследования не определён"},
        ],
    )
    s.refresh_from_db()
    assert len(s.parse_errors) == 2
    assert s.parse_errors[0]["row"] == 3


def test_import_session_str(db):
    s = ImportSession.objects.create(file="receipts/example.xlsx")
    text = str(s)
    assert "example.xlsx" in text
    assert "Парсинг" in text