"""
Тесты разбора конфликтов `Receipt` (`3b-1`).

Покрывают:
- `GET /receipts/{id}/conflicts/` — список неразобранных,
  с `suggested_count` (остаток по `MATCHED`-истории);
- `POST /receipts/{id}/resolve-conflicts/` — создание `ReceiptItem`
  без `Container`, пометка `resolved`;
- `suggested_count` при наличии `MATCHED` в другом `Receipt`
  за те же даты;
- edge cases: `containers_count = 0`, `> total`, дубли индексов,
  уже разобранный вопрос, не-вопрос по индексу, нет `ImportSession`,
  участок не найден, тип не найден;
- смена статуса `ImportSession` на `APPLIED` после всех разборов.
"""

from datetime import date

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.samples.catalogs import ResearchType, Site
from apps.storage.models import Container


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="conflict_test", password="x")
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
    return ResearchType.objects.create(code="АД", name="АД")


TARGET_ISO = "2026-10-14"
TARGET = date(2026, 10, 14)
DATES = ["2026-08-13", TARGET_ISO, "2026-05-25"]


def _question(
    *,
    work_order: str = "TST00472",
    research_type_code: str = "АД",
    containers_count: int = 3,
    sheet: str = "Тестовый",
    target_date: str = TARGET_ISO,
    reason: str = "multi_date_match",
) -> dict:
    return {
        "code": "NEEDS_CONFIRMATION",
        "title": "Требует уточнения",
        "reason": reason,
        "sheet": sheet,
        "work_order": work_order,
        "research_type": research_type_code,
        "container_type": "Ящики",
        "containers_count": containers_count,
        "raw_dates": list(DATES),
        "target_date": target_date,
        "message": "test question",
    }


def _make_receipt(
    *,
    questions: list[dict] | None = None,
    status: str = ImportSession.STATUS_PARSED,
) -> tuple[Receipt, ImportSession]:
    """Создаёт Receipt + ImportSession с указанными вопросами."""
    receipt = Receipt.objects.create(
        receipt_number="ПР-TEST",
        expected_date=TARGET,
        status=Receipt.STATUS_EXPECTED,
    )
    session = ImportSession.objects.create(
        file="imports/test.xlsx",
        status=status,
        receipt=receipt,
        parse_errors=questions if questions is not None else [_question()],
    )
    return receipt, session


# ============================================================
# GET conflicts
# ============================================================
@pytest.mark.django_db
def test_conflicts_requires_auth(db):
    client = APIClient()
    response = client.get("/api/v1/receipts/1/conflicts/")
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_conflicts_list_empty_when_no_session(auth_client, site):
    receipt = Receipt.objects.create(
        receipt_number="ПР-NOSESS", expected_date=TARGET,
    )
    response = auth_client.get(
        f"/api/v1/receipts/{receipt.pk}/conflicts/",
    )
    assert response.status_code == 200
    assert response.data["conflicts"] == []
    assert response.data["total_conflicts_count"] == 0


@pytest.mark.django_db
def test_conflicts_list_returns_unresolved(
    auth_client, site, research_type,
):
    receipt, _ = _make_receipt()
    response = auth_client.get(
        f"/api/v1/receipts/{receipt.pk}/conflicts/",
    )
    assert response.status_code == 200
    assert len(response.data["conflicts"]) == 1
    c = response.data["conflicts"][0]
    assert c["question_index"] == 0
    assert c["work_order"] == "TST00472"
    assert c["containers_count"] == 3
    # Не было MATCHED-истории → suggested = total.
    assert c["suggested_count"] == 3


@pytest.mark.django_db
def test_conflicts_excludes_resolved(auth_client, site):
    q = _question()
    q["resolved"] = True
    q["resolved_at"] = "2026-10-14T10:00:00"
    receipt, _ = _make_receipt(questions=[q])
    response = auth_client.get(
        f"/api/v1/receipts/{receipt.pk}/conflicts/",
    )
    assert response.status_code == 200
    assert response.data["conflicts"] == []
    assert response.data["total_conflicts_count"] == 1
    assert response.data["resolved_conflicts_count"] == 1


@pytest.mark.django_db
def test_conflicts_suggested_count_with_history(
    auth_client, site, research_type,
):
    """В другом Receipt за те же даты есть 2 MATCHED → suggested = 1."""
    # Чужой Receipt (не текущий), дата входит в DATES.
    other_receipt = Receipt.objects.create(
        receipt_number="ПР-OTHER",
        expected_date=date(2026, 8, 13),
        status=Receipt.STATUS_CONFIRMED,
    )
    for _ in range(2):
        ReceiptItem.objects.create(
            receipt=other_receipt,
            expected_work_order_number="TST00472",
            expected_research_type_code="АД",
            expected_site_code="TST",
            site=site,
            research_type=research_type,
            expected_samples_count=1,
            status=ReceiptItem.STATUS_MATCHED,
        )

    receipt, _ = _make_receipt()
    response = auth_client.get(
        f"/api/v1/receipts/{receipt.pk}/conflicts/",
    )
    assert response.status_code == 200
    c = response.data["conflicts"][0]
    assert c["suggested_count"] == 1


# ============================================================
# POST resolve-conflicts
# ============================================================
@pytest.mark.django_db
def test_resolve_creates_items_without_container(
    auth_client, site, research_type,
):
    receipt, _ = _make_receipt()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 2},
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["created_items_count"] == 2
    assert response.data["resolved_conflicts_count"] == 1
    assert response.data["total_conflicts_count"] == 1

    items = ReceiptItem.objects.filter(receipt=receipt)
    assert items.count() == 2
    for it in items:
        assert it.container is None
        assert it.status == ReceiptItem.STATUS_EXPECTED
        assert it.expected_work_order_number == "TST00472"
        assert it.expected_research_type_code == "АД"
        assert it.expected_samples_count == 1
    assert Container.objects.count() == 0


@pytest.mark.django_db
def test_resolve_zero_creates_nothing(
    auth_client, site, research_type,
):
    receipt, _ = _make_receipt()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 0},
            ],
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["created_items_count"] == 0
    assert ReceiptItem.objects.count() == 0

    session = ImportSession.objects.get(receipt=receipt)
    assert session.parse_errors[0]["resolved"] is True


@pytest.mark.django_db
def test_resolve_over_total_rejected(
    auth_client, site, research_type,
):
    receipt, _ = _make_receipt()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 10},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "больше" in str(response.data).lower()
    assert ReceiptItem.objects.count() == 0


@pytest.mark.django_db
def test_resolve_bad_index(auth_client, site):
    receipt, _ = _make_receipt()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 99, "containers_count": 1},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "вне диапазона" in str(response.data)


@pytest.mark.django_db
def test_resolve_duplicate_index(auth_client, site):
    receipt, _ = _make_receipt()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 1},
                {"question_index": 0, "containers_count": 1},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "Дубликат" in str(response.data)


@pytest.mark.django_db
def test_resolve_already_resolved(auth_client, site):
    q = _question()
    q["resolved"] = True
    receipt, _ = _make_receipt(questions=[q])
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 1},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "уже разобран" in str(response.data)


@pytest.mark.django_db
def test_resolve_sets_session_applied(auth_client, site, research_type):
    receipt, _ = _make_receipt()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 2},
            ],
        },
        format="json",
    )
    assert response.status_code == 200

    session = ImportSession.objects.get(receipt=receipt)
    assert session.status == ImportSession.STATUS_APPLIED


@pytest.mark.django_db
def test_resolve_site_not_found(auth_client, research_type):
    q = _question(sheet="НЕИЗВЕСТНЫЙ")
    receipt, _ = _make_receipt(questions=[q])
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 1},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "Участок не найден" in str(response.data)


@pytest.mark.django_db
def test_resolve_no_session(auth_client):
    receipt = Receipt.objects.create(
        receipt_number="ПР-X", expected_date=TARGET,
    )
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 1},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "сессии импорта" in str(response.data)



@pytest.mark.django_db
def test_resolve_sets_container_type_on_items(
    auth_client, site, research_type,
):
    """ReceiptItem из конфликта получает container_type (3b-1-2a)."""
    receipt, _ = _make_receipt()
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/resolve-conflicts/",
        {
            "conflicts": [
                {"question_index": 0, "containers_count": 2},
            ],
        },
        format="json",
    )
    assert response.status_code == 200

    items = ReceiptItem.objects.filter(receipt=receipt)
    assert items.count() == 2
    for it in items:
        assert it.container_type is not None
        assert it.container_type.name == "Ящики"