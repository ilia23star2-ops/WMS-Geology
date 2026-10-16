"""
Тесты эндпоинта `GET /receipts/{id}/act/` (пачка 3f-1).

Проверяется:
- отдача PDF для подтверждённой партии;
- 400 для прочих статусов;
- 404 для несуществующей партии;
- авторизация;
- заголовки Content-Type / Content-Disposition.

Тело `FileResponse` читается через `streaming_content` (это
генератор чанков; атрибута `.content` у `FileResponse` нет).
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.receiving.models import Receipt, ReceiptItem

User = get_user_model()


# ============================================================
# Вспомогательные
# ============================================================
def _read_body(resp) -> bytes:
    """Склеивает `streaming_content` в bytes (для `FileResponse`)."""
    chunks = []
    for chunk in resp.streaming_content:
        chunks.append(chunk if isinstance(chunk, bytes) else chunk.encode())
    return b"".join(chunks)


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def user(db):
    return User.objects.create_user(username="act-user", password="p")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def confirmed_receipt(db):
    return Receipt.objects.create(
        receipt_number="ПР-ACT-001",
        status=Receipt.STATUS_CONFIRMED,
    )


# ============================================================
# Успешный сценарий
# ============================================================
@pytest.mark.django_db
def test_act_returns_pdf_for_confirmed_receipt(api, confirmed_receipt):
    resp = api.get(f"/api/v1/receipts/{confirmed_receipt.pk}/act/")

    assert resp.status_code == 200
    assert resp["Content-Type"].startswith("application/pdf")
    body = _read_body(resp)
    assert body.startswith(b"%PDF")
    assert len(body) > 500


@pytest.mark.django_db
def test_act_content_disposition_inline_with_filename(
    api, confirmed_receipt,
):
    resp = api.get(f"/api/v1/receipts/{confirmed_receipt.pk}/act/")

    assert resp.status_code == 200
    cd = resp["Content-Disposition"]
    assert "inline" in cd
    assert "act_" in cd
    assert ".pdf" in cd


@pytest.mark.django_db
def test_act_with_missing_items_renders_ok(api, confirmed_receipt):
    ReceiptItem.objects.create(
        receipt=confirmed_receipt,
        status=ReceiptItem.STATUS_MISSING,
        expected_work_order_number="TST0001",
        expected_research_type_code="ШЛ",
        expected_site_code="TST",
        expected_samples_count=1,
    )
    ReceiptItem.objects.create(
        receipt=confirmed_receipt,
        status=ReceiptItem.STATUS_MATCHED,
        expected_work_order_number="TST0001",
        expected_research_type_code="ШЛ",
        expected_site_code="TST",
        expected_samples_count=1,
    )

    resp = api.get(f"/api/v1/receipts/{confirmed_receipt.pk}/act/")

    assert resp.status_code == 200
    assert _read_body(resp).startswith(b"%PDF")


@pytest.mark.django_db
def test_act_with_no_items_renders_ok(api, confirmed_receipt):
    resp = api.get(f"/api/v1/receipts/{confirmed_receipt.pk}/act/")

    assert resp.status_code == 200
    assert _read_body(resp).startswith(b"%PDF")


# ============================================================
# Ограничения по статусу
# ============================================================
@pytest.mark.parametrize(
    "status_value",
    [
        Receipt.STATUS_EXPECTED,
        Receipt.STATUS_IN_PROGRESS,
        Receipt.STATUS_CANCELLED,
    ],
)
@pytest.mark.django_db
def test_act_returns_400_for_non_confirmed(api, status_value):
    receipt = Receipt.objects.create(
        receipt_number=f"ПР-ACT-{status_value}",
        status=status_value,
    )

    resp = api.get(f"/api/v1/receipts/{receipt.pk}/act/")

    assert resp.status_code == 400
    body = resp.json()
    assert "error" in body
    assert "подтверждённой" in body["error"].lower()


# ============================================================
# Несуществующая партия
# ============================================================
@pytest.mark.django_db
def test_act_returns_404_for_unknown_receipt(api):
    resp = api.get("/api/v1/receipts/999999/act/")

    assert resp.status_code == 404


# ============================================================
# Авторизация
# ============================================================
@pytest.mark.django_db
def test_act_requires_auth(confirmed_receipt):
    client = APIClient()
    resp = client.get(f"/api/v1/receipts/{confirmed_receipt.pk}/act/")

    # DRF с `IsAuthenticated` — 401 или 403 в зависимости от настроек.
    assert resp.status_code in (401, 403)