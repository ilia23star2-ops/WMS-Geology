"""
Тесты завершения приёмки `Receipt` (`receipts/{id}/complete/`) — 3c.

Покрывают:
- успешное завершение, когда все `MATCHED` → `Shipment.RECEIVED`;
- завершение с `MISSING` → `Shipment.PARTIALLY_RECEIVED`;
- блокировку при неразобранных `NEEDS_CONFIRMATION`;
- блокировку при несверенных строках `EXPECTED`;
- блокировку при пустой партии;
- 400 при `CONFIRMED` / `CANCELLED`;
- заполнение `received_at` и `received_by`;
- у рейса без `Shipment` — статус рейса не меняется, но `Receipt` → `CONFIRMED`.
"""

from datetime import date

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.picking.models import Shipment
from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.samples.catalogs import ResearchType, Site
from apps.storage.models import ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="complete_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def site(db):
    return Site.objects.create(
        code="TST", name="Тестовый", match_patterns=["TST", "Тест"],
    )


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Ящики")


@pytest.fixture
def shipment(db):
    return Shipment.objects.create(
        shipment_number="Р-2026-TEST",
        direction=Shipment.DIRECTION_INBOUND,
        status=Shipment.STATUS_SENT,
    )


@pytest.fixture
def receipt(db, shipment):
    return Receipt.objects.create(
        receipt_number="ПР-COMPLETE",
        expected_date=date(2026, 10, 14),
        status=Receipt.STATUS_IN_PROGRESS,
        shipment=shipment,
    )


def _make_item(
    receipt,
    site,
    research_type,
    container_type,
    *,
    status: str = ReceiptItem.STATUS_MATCHED,
) -> ReceiptItem:
    return ReceiptItem.objects.create(
        receipt=receipt,
        container=None,
        container_type=container_type,
        expected_work_order_number="TST00472",
        expected_research_type_code=research_type.code,
        expected_site_code=site.code,
        expected_samples_count=1,
        site=site,
        research_type=research_type,
        status=status,
    )


# ============================================================
# Аутентификация / статусы
# ============================================================
@pytest.mark.django_db
def test_complete_requires_auth(db):
    client = APIClient()
    response = client.post(
        "/api/v1/receipts/1/complete/", {}, format="json",
    )
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_complete_confirmed_rejected(auth_client, receipt):
    receipt.status = Receipt.STATUS_CONFIRMED
    receipt.save(update_fields=["status"])
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 400
    assert "уже подтверждена" in str(response.data)


@pytest.mark.django_db
def test_complete_cancelled_rejected(auth_client, receipt):
    receipt.status = Receipt.STATUS_CANCELLED
    receipt.save(update_fields=["status"])
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 400
    assert "отменённую" in str(response.data)


# ============================================================
# Успех
# ============================================================
@pytest.mark.django_db
def test_complete_all_matched(
    auth_client, receipt, shipment,
    site, research_type, container_type,
):
    _make_item(receipt, site, research_type, container_type)
    _make_item(receipt, site, research_type, container_type)

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["status"] == Receipt.STATUS_CONFIRMED
    assert response.data["matched_count"] == 2
    assert response.data["missing_count"] == 0
    assert response.data["shipment_status"] == Shipment.STATUS_RECEIVED

    receipt.refresh_from_db()
    shipment.refresh_from_db()
    assert receipt.status == Receipt.STATUS_CONFIRMED
    assert receipt.received_at is not None
    assert receipt.received_by is not None
    assert shipment.status == Shipment.STATUS_RECEIVED
    assert shipment.received_at is not None


@pytest.mark.django_db
def test_complete_with_missing(
    auth_client, receipt, shipment,
    site, research_type, container_type,
):
    _make_item(receipt, site, research_type, container_type)
    _make_item(
        receipt, site, research_type, container_type,
        status=ReceiptItem.STATUS_MISSING,
    )

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 200
    assert response.data["matched_count"] == 1
    assert response.data["missing_count"] == 1
    assert response.data["shipment_status"] == Shipment.STATUS_PARTIALLY_RECEIVED

    shipment.refresh_from_db()
    assert shipment.status == Shipment.STATUS_PARTIALLY_RECEIVED


@pytest.mark.django_db
def test_complete_receipt_without_shipment(
    auth_client, site, research_type, container_type,
):
    receipt = Receipt.objects.create(
        receipt_number="ПР-NO-SHIPMENT",
        expected_date=date(2026, 10, 14),
        status=Receipt.STATUS_IN_PROGRESS,
    )
    _make_item(receipt, site, research_type, container_type)

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 200
    assert response.data["shipment_id"] is None
    assert response.data["shipment_status"] is None
    receipt.refresh_from_db()
    assert receipt.status == Receipt.STATUS_CONFIRMED


# ============================================================
# Блокировки
# ============================================================
@pytest.mark.django_db
def test_complete_blocked_by_expected_items(
    auth_client, receipt, site, research_type, container_type,
):
    _make_item(receipt, site, research_type, container_type)
    _make_item(
        receipt, site, research_type, container_type,
        status=ReceiptItem.STATUS_EXPECTED,
    )

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 400
    assert "несверенных" in str(response.data)

    receipt.refresh_from_db()
    assert receipt.status == Receipt.STATUS_IN_PROGRESS


@pytest.mark.django_db
def test_complete_blocked_by_unresolved_conflicts(
    auth_client, receipt, site, research_type, container_type,
):
    """Если в сессии есть неразобранный NEEDS_CONFIRMATION — блок."""
    _make_item(receipt, site, research_type, container_type)

    ImportSession.objects.create(
        file="imports/test.xlsx",
        status=ImportSession.STATUS_PARSED,
        receipt=receipt,
        parse_errors=[
            {
                "code": "NEEDS_CONFIRMATION",
                "title": "Требует уточнения",
                "reason": "multi_date_match",
                "sheet": "Тестовый",
                "work_order": "TST00472",
                "research_type": "АД",
                "container_type": "Ящики",
                "containers_count": 3,
                "raw_dates": ["2026-08-13", "2026-10-14"],
                "target_date": "2026-10-14",
                "message": "test",
            },
        ],
    )

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 400
    assert "конфликт" in str(response.data).lower()


@pytest.mark.django_db
def test_complete_blocked_by_empty_receipt(auth_client, receipt):
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 400
    assert "ни одной строки" in str(response.data)


@pytest.mark.django_db
def test_complete_succeeds_when_all_questions_resolved(
    auth_client, receipt, shipment,
    site, research_type, container_type,
):
    """Разобранные конфликты не мешают завершению."""
    _make_item(receipt, site, research_type, container_type)

    ImportSession.objects.create(
        file="imports/test.xlsx",
        status=ImportSession.STATUS_APPLIED,
        receipt=receipt,
        parse_errors=[
            {
                "code": "NEEDS_CONFIRMATION",
                "title": "Требует уточнения",
                "reason": "multi_date_match",
                "sheet": "Тестовый",
                "work_order": "TST00472",
                "research_type": "АД",
                "container_type": "Ящики",
                "containers_count": 3,
                "raw_dates": ["2026-08-13", "2026-10-14"],
                "target_date": "2026-10-14",
                "message": "test",
                "resolved": True,
                "resolved_at": "2026-10-14T10:00:00",
                "resolved_count": 2,
            },
        ],
    )

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["status"] == Receipt.STATUS_CONFIRMED


@pytest.mark.django_db
def test_complete_counts_correctly(
    auth_client, receipt, shipment,
    site, research_type, container_type,
):
    """Сводка: 3 matched, 2 missing → PARTIALLY_RECEIVED."""
    for _ in range(3):
        _make_item(receipt, site, research_type, container_type)
    for _ in range(2):
        _make_item(
            receipt, site, research_type, container_type,
            status=ReceiptItem.STATUS_MISSING,
        )

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 200
    assert response.data["total_items_count"] == 5
    assert response.data["matched_count"] == 3
    assert response.data["missing_count"] == 2
    assert response.data["other_count"] == 0
    assert response.data["shipment_status"] == Shipment.STATUS_PARTIALLY_RECEIVED


@pytest.mark.django_db
def test_complete_blocked_by_expected_after_check(
    auth_client, receipt, site, research_type, container_type,
):
    """После частичной сверки: 1 matched, 1 expected → блок."""
    _make_item(receipt, site, research_type, container_type)
    _make_item(
        receipt, site, research_type, container_type,
        status=ReceiptItem.STATUS_EXPECTED,
    )

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/complete/", {}, format="json",
    )
    assert response.status_code == 400
    assert "1" in str(response.data)