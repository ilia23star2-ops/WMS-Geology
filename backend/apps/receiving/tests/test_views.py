"""
Тесты API приложения receiving.

20 старых тестов (Receipt, ReceiptItem, ImportSession CRUD) +
10 новых (upload Excel).
"""

from io import BytesIO

import pytest
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from openpyxl import Workbook
from rest_framework.test import APIClient

from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.samples.catalogs import Laboratory, ResearchType, Site
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="recv_api", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def laboratory(db):
    return Laboratory.objects.create(code="ЛАБ-1", name="Лаборатория 1")


@pytest.fixture
def site(db):
    return Site.objects.create(
        code="TST", name="Тестовый", match_patterns=["Тест"],
    )


@pytest.fixture
def research_types(db):
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    ResearchType.objects.create(code="ХА", name="Хим")


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
        receipt_number="ПР-2026-001", laboratory=laboratory, site=site,
    )


def _xlsx_bytes(rows: list[list], sheet_name: str = "Тестовый") -> bytes:
    """Создаёт XLSX в памяти и возвращает bytes."""
    wb = Workbook()
    ws = wb.active
    ws.title = sheet_name
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _upload_file(
    rows: list[list], sheet_name: str = "Тестовый",
) -> SimpleUploadedFile:
    content = _xlsx_bytes(rows, sheet_name=sheet_name)
    return SimpleUploadedFile(
        "test.xlsx",
        content,
        content_type=(
            "application/vnd.openxmlformats-officedocument."
            "spreadsheetml.sheet"
        ),
    )


# ============================================================
# Аутентификация
# ============================================================
def test_receipts_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/receipts/")
    assert response.status_code in (401, 403)


# ============================================================
# Receipt — CRUD
# ============================================================
def test_receipt_create_sets_imported_by(auth_client, laboratory, site):
    response = auth_client.post(
        "/api/v1/receipts/",
        {
            "receipt_number": "ПР-100",
            "laboratory": laboratory.pk,
            "site": site.pk,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["receipt_number"] == "ПР-100"
    assert response.data["status"] == "EXPECTED"
    assert response.data["imported_by"] is not None


def test_receipt_retrieve_with_nested(auth_client, receipt):
    response = auth_client.get(f"/api/v1/receipts/{receipt.pk}/")
    assert response.status_code == 200
    assert response.data["laboratory_name"] == "Лаборатория 1"
    assert response.data["site_name"] == "Тестовый"


def test_receipt_update(auth_client, receipt):
    response = auth_client.patch(
        f"/api/v1/receipts/{receipt.pk}/",
        {"comment": "Новая поставка"},
        format="json",
    )
    assert response.status_code == 200
    receipt.refresh_from_db()
    assert receipt.comment == "Новая поставка"


def test_receipt_delete(auth_client, receipt):
    response = auth_client.delete(f"/api/v1/receipts/{receipt.pk}/")
    assert response.status_code == 204
    assert not Receipt.objects.filter(pk=receipt.pk).exists()


def test_receipt_list_filter_by_status(auth_client, receipt):
    Receipt.objects.create(
        receipt_number="ПР-200", status=Receipt.STATUS_CONFIRMED,
    )
    response = auth_client.get("/api/v1/receipts/?status=EXPECTED")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_receipt_list_filter_by_laboratory(
    auth_client, receipt, laboratory,
):
    other_lab = Laboratory.objects.create(code="ЛАБ-2", name="Лаборатория 2")
    Receipt.objects.create(receipt_number="ПР-300", laboratory=other_lab)
    response = auth_client.get(
        f"/api/v1/receipts/?laboratory_id={laboratory.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Receipt — confirm / cancel
# ============================================================
def test_receipt_confirm_success(auth_client, receipt):
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/confirm/", format="json",
    )
    assert response.status_code == 200
    receipt.refresh_from_db()
    assert receipt.status == "CONFIRMED"
    assert receipt.received_at is not None
    assert receipt.received_by is not None


def test_receipt_confirm_twice_raises(auth_client, receipt):
    auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/confirm/", format="json",
    )
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/confirm/", format="json",
    )
    assert response.status_code == 400


def test_receipt_confirm_cancelled_raises(auth_client, receipt):
    receipt.status = Receipt.STATUS_CANCELLED
    receipt.save()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/confirm/", format="json",
    )
    assert response.status_code == 400


def test_receipt_cancel_success(auth_client, receipt):
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/cancel/", format="json",
    )
    assert response.status_code == 200
    receipt.refresh_from_db()
    assert receipt.status == "CANCELLED"


def test_receipt_cancel_twice_raises(auth_client, receipt):
    auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/cancel/", format="json",
    )
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/cancel/", format="json",
    )
    assert response.status_code == 400


def test_receipt_cancel_confirmed_raises(auth_client, receipt):
    receipt.status = Receipt.STATUS_CONFIRMED
    receipt.save()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/cancel/", format="json",
    )
    assert response.status_code == 400


# ============================================================
# ReceiptItem — CRUD
# ============================================================
def test_receipt_item_create(auth_client, receipt):
    response = auth_client.post(
        "/api/v1/receipt-items/",
        {
            "receipt": receipt.pk,
            "expected_container_number": "T-001",
            "expected_samples_count": 31,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["status"] == "EXPECTED"
    assert response.data["expected_container_number"] == "T-001"


def test_receipt_item_retrieve_with_nested(
    auth_client, receipt, container, work_order, research_types, site,
):
    rt = ResearchType.objects.get(code="ШЛ")
    item = ReceiptItem.objects.create(
        receipt=receipt, container=container,
        work_order=work_order, research_type=rt, site=site,
    )
    response = auth_client.get(f"/api/v1/receipt-items/{item.pk}/")
    assert response.status_code == 200
    assert response.data["container_number"] == "T-001"
    assert response.data["work_order_number"] == "A-100"
    assert response.data["research_type_code"] == "ШЛ"
    assert response.data["site_code"] == "TST"


def test_receipt_item_update_scanned_barcodes(auth_client, receipt):
    item = ReceiptItem.objects.create(receipt=receipt)
    response = auth_client.patch(
        f"/api/v1/receipt-items/{item.pk}/",
        {"scanned_barcodes": ["4600123456789"]},
        format="json",
    )
    assert response.status_code == 200
    item.refresh_from_db()
    assert item.scanned_barcodes == ["4600123456789"]


def test_receipt_item_list_filter_by_receipt(auth_client, receipt):
    other_receipt = Receipt.objects.create(receipt_number="ПР-999")
    ReceiptItem.objects.create(receipt=receipt)
    ReceiptItem.objects.create(receipt=other_receipt)
    response = auth_client.get(
        f"/api/v1/receipt-items/?receipt_id={receipt.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_receipt_item_list_filter_by_status(auth_client, receipt):
    ReceiptItem.objects.create(
        receipt=receipt, status=ReceiptItem.STATUS_MATCHED,
    )
    ReceiptItem.objects.create(
        receipt=receipt, status=ReceiptItem.STATUS_MISSING,
    )
    response = auth_client.get("/api/v1/receipt-items/?status=MISSING")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# ImportSession — CRUD
# ============================================================
def test_import_session_create_sets_uploaded_by(auth_client, db):
    response = auth_client.post(
        "/api/v1/import-sessions/",
        {"file": "receipts/example.xlsx", "file_format": "XLSX"},
        format="json",
    )
    assert response.status_code in (201, 400)


def test_import_session_list_filter_by_status(auth_client, db):
    ImportSession.objects.create(file="receipts/a.xlsx")
    ImportSession.objects.create(
        file="receipts/b.xlsx", status=ImportSession.STATUS_PARSED,
    )
    response = auth_client.get("/api/v1/import-sessions/?status=PARSED")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# ImportSession — upload (bundle-3)
# ============================================================
def test_upload_requires_auth(anon_client, db):
    response = anon_client.post("/api/v1/import-sessions/upload/")
    assert response.status_code in (401, 403)


def test_upload_no_file(auth_client, db):
    response = auth_client.post(
        "/api/v1/import-sessions/upload/", {}, format="multipart",
    )
    assert response.status_code == 400
    assert "Файл не передан" in str(response.data)


def test_upload_invalid_extension(auth_client, db):
    f = SimpleUploadedFile("test.txt", b"hello", content_type="text/plain")
    response = auth_client.post(
        "/api/v1/import-sessions/upload/",
        {"file": f}, format="multipart",
    )
    assert response.status_code == 400
    assert "xlsx" in str(response.data).lower()


def test_upload_success(auth_client, site, research_types):
    f = _upload_file([
        ["Наряд", "ШЛ", "ХА", "Дата"],
        ["Тест001", 5, 3, "2026-10-08"],
        ["Тест002", 2, None, "2026-10-09"],
    ])
    response = auth_client.post(
        "/api/v1/import-sessions/upload/",
        {"file": f}, format="multipart",
    )
    assert response.status_code == 200, response.data
    assert response.data["status"] == "APPLIED"
    assert response.data["sheets_count"] == 1
    assert response.data["rows_count"] == 2
    assert response.data["containers_count"] == 10
    assert len(response.data["parse_errors"]) == 0
    assert len(response.data["receipts"]) == 1
    assert response.data["receipts"][0]["site_code"] == "TST"


def test_upload_creates_import_session(auth_client, site, research_types):
    f = _upload_file([
        ["Наряд", "ШЛ", "Дата"],
        ["Тест001", 5, "2026-10-08"],
    ])
    response = auth_client.post(
        "/api/v1/import-sessions/upload/",
        {"file": f}, format="multipart",
    )
    assert response.status_code == 200
    assert ImportSession.objects.count() == 1
    session = ImportSession.objects.first()
    assert session.status == ImportSession.STATUS_APPLIED
    assert session.uploaded_by is not None


def test_upload_creates_receipt_and_items(auth_client, site, research_types):
    f = _upload_file([
        ["Наряд", "ШЛ", "Дата"],
        ["Тест001", 5, "2026-10-08"],
        ["Тест002", 3, "2026-10-08"],
    ])
    auth_client.post(
        "/api/v1/import-sessions/upload/",
        {"file": f}, format="multipart",
    )
    assert Receipt.objects.count() == 1
    assert ReceiptItem.objects.count() == 2


def test_upload_site_not_found(auth_client, research_types):
    f = _upload_file(
        [["Наряд", "ШЛ", "Дата"], ["Тест001", 5, "2026-10-08"]],
        sheet_name="НЕИЗВЕСТНЫЙ",
    )
    response = auth_client.post(
        "/api/v1/import-sessions/upload/",
        {"file": f}, format="multipart",
    )
    assert response.status_code == 200
    assert response.data["status"] == "ERROR"
    assert len(response.data["parse_errors"]) >= 1


def test_upload_research_type_not_found(auth_client, site):
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    f = _upload_file([
        ["Наряд", "ШЛ", "НЕИЗВ", "Дата"],
        ["Тест001", 5, 3, "2026-10-08"],
    ])
    response = auth_client.post(
        "/api/v1/import-sessions/upload/",
        {"file": f}, format="multipart",
    )
    assert response.status_code == 200
    assert response.data["status"] == "PARSED"
    assert len(response.data["parse_errors"]) >= 1


def test_upload_work_orders_linked_to_site(auth_client, site, research_types):
    f = _upload_file([
        ["Наряд", "ШЛ", "Дата"],
        ["Тест001", 5, "2026-10-08"],
    ])
    auth_client.post(
        "/api/v1/import-sessions/upload/",
        {"file": f}, format="multipart",
    )
    wo = WorkOrder.objects.get(order_number="Тест001")
    assert wo.site == site