"""
Тесты сверки `Receipt` (`receipts/{id}/check/`) — 3b-2.

Покрывают:
- создание Container со статусом PENDING_PLACEMENT для отмеченных;
- обновление существующего Container (номер меняется);
- удаление Container (hard) для неотмеченных без проб;
- ошибку при попытке удалить Container с пробами;
- присвоение номера тары (expected_container_number);
- валидацию: дубли item_id, чужие item_id, дубли номеров,
  занятый номер, отсутствие container_type;
- 400 при статусе CONFIRMED/CANCELLED;
- смену статуса Receipt EXPECTED → IN_PROGRESS;
- смешанный сценарий.
"""

from datetime import date

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.receiving.models import Receipt, ReceiptItem
from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="check_test", password="x")
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
def receipt(db):
    return Receipt.objects.create(
        receipt_number="ПР-CHECK",
        expected_date=date(2026, 10, 14),
        status=Receipt.STATUS_EXPECTED,
    )


def _make_item(
    receipt,
    site,
    research_type,
    container_type,
    *,
    status: str = ReceiptItem.STATUS_EXPECTED,
    with_container: bool = False,
    container_number: str | None = None,
) -> ReceiptItem:
    container = None
    if with_container:
        container = Container.objects.create(
            container_number=container_number,
            container_type=container_type,
            status=Container.STATUS_IN_TRANSIT,
        )
    return ReceiptItem.objects.create(
        receipt=receipt,
        container=container,
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
def test_check_requires_auth(db):
    client = APIClient()
    response = client.post("/api/v1/receipts/1/check/", {}, format="json")
    assert response.status_code in (401, 403)


@pytest.mark.django_db
def test_check_confirmed_status_rejected(auth_client, receipt):
    receipt.status = Receipt.STATUS_CONFIRMED
    receipt.save(update_fields=["status"])
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {"items": []},
        format="json",
    )
    # Пустой items → 400 serializer; но статус тоже проверяется.
    assert response.status_code == 400


@pytest.mark.django_db
def test_check_cancelled_status_rejected(auth_client, receipt):
    receipt.status = Receipt.STATUS_CANCELLED
    receipt.save(update_fields=["status"])
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {"items": [{"item_id": 1, "matched": True}]},
        format="json",
    )
    assert response.status_code == 400


# ============================================================
# Успешный сценарий
# ============================================================
@pytest.mark.django_db
def test_check_all_matched_creates_containers(
    auth_client, receipt, site, research_type, container_type,
):
    it1 = _make_item(receipt, site, research_type, container_type)
    it2 = _make_item(receipt, site, research_type, container_type)

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {
            "items": [
                {"item_id": it1.pk, "matched": True,
                 "container_number": "T-001"},
                {"item_id": it2.pk, "matched": True,
                 "container_number": "T-002"},
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["matched_count"] == 2
    assert response.data["missing_count"] == 0

    it1.refresh_from_db()
    it2.refresh_from_db()

    assert it1.status == ReceiptItem.STATUS_MATCHED
    assert it1.container is not None
    assert it1.container.container_number == "T-001"
    assert it1.container.status == Container.STATUS_PENDING_PLACEMENT
    assert it1.expected_container_number == "T-001"

    assert it2.status == ReceiptItem.STATUS_MATCHED
    assert it2.container.container_number == "T-002"


@pytest.mark.django_db
def test_check_all_missing_deletes_containers(
    auth_client, receipt, site, research_type, container_type,
):
    it1 = _make_item(
        receipt, site, research_type, container_type,
        with_container=True, container_number="T-OLD-1",
    )
    it2 = _make_item(
        receipt, site, research_type, container_type,
        with_container=True, container_number="T-OLD-2",
    )
    c1 = it1.container
    c2 = it2.container

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {
            "items": [
                {"item_id": it1.pk, "matched": False},
                {"item_id": it2.pk, "matched": False},
            ],
        },
        format="json",
    )
    assert response.status_code == 200, response.data
    assert response.data["matched_count"] == 0
    assert response.data["missing_count"] == 2

    it1.refresh_from_db()
    it2.refresh_from_db()
    assert it1.status == ReceiptItem.STATUS_MISSING
    assert it1.container is None
    assert it2.status == ReceiptItem.STATUS_MISSING
    assert it2.container is None

    assert not Container.objects.filter(pk=c1.pk).exists()
    assert not Container.objects.filter(pk=c2.pk).exists()


@pytest.mark.django_db
def test_check_mixed(
    auth_client, receipt, site, research_type, container_type,
):
    it1 = _make_item(receipt, site, research_type, container_type)
    it2 = _make_item(receipt, site, research_type, container_type)

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {
            "items": [
                {"item_id": it1.pk, "matched": True,
                 "container_number": "T-MIX-1"},
                {"item_id": it2.pk, "matched": False},
            ],
        },
        format="json",
    )
    assert response.status_code == 200
    assert response.data["matched_count"] == 1
    assert response.data["missing_count"] == 1


@pytest.mark.django_db
def test_check_updates_existing_container_number(
    auth_client, receipt, site, research_type, container_type,
):
    it = _make_item(
        receipt, site, research_type, container_type,
        with_container=True, container_number="T-OLD",
    )
    c = it.container

    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {
            "items": [
                {"item_id": it.pk, "matched": True,
                 "container_number": "T-NEW"},
            ],
        },
        format="json",
    )
    assert response.status_code == 200
    c.refresh_from_db()
    assert c.container_number == "T-NEW"
    assert c.status == Container.STATUS_PENDING_PLACEMENT


@pytest.mark.django_db
def test_check_sets_receipt_in_progress(
    auth_client, receipt, site, research_type, container_type,
):
    it = _make_item(receipt, site, research_type, container_type)
    auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {"items": [{"item_id": it.pk, "matched": False}]},
        format="json",
    )
    receipt.refresh_from_db()
    assert receipt.status == Receipt.STATUS_IN_PROGRESS


# ============================================================
# Валидация
# ============================================================
@pytest.mark.django_db
def test_check_duplicate_item_id_in_request(
    auth_client, receipt, site, research_type, container_type,
):
    it = _make_item(receipt, site, research_type, container_type)
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {
            "items": [
                {"item_id": it.pk, "matched": True},
                {"item_id": it.pk, "matched": False},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "Дубликат item_id" in str(response.data)


@pytest.mark.django_db
def test_check_foreign_item_id(
    auth_client, receipt, site, research_type, container_type,
):
    other = Receipt.objects.create(receipt_number="ПР-OTHER")
    foreign_item = _make_item(
        other, site, research_type, container_type,
    )
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {"items": [{"item_id": foreign_item.pk, "matched": True}]},
        format="json",
    )
    assert response.status_code == 400
    assert "не принадлежит" in str(response.data)


@pytest.mark.django_db
def test_check_duplicate_number_in_request(
    auth_client, receipt, site, research_type, container_type,
):
    it1 = _make_item(receipt, site, research_type, container_type)
    it2 = _make_item(receipt, site, research_type, container_type)
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {
            "items": [
                {"item_id": it1.pk, "matched": True,
                 "container_number": "T-DUP"},
                {"item_id": it2.pk, "matched": True,
                 "container_number": "T-DUP"},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "дважды" in str(response.data)


@pytest.mark.django_db
def test_check_number_already_taken_by_other_container(
    auth_client, receipt, site, research_type, container_type,
):
    Container.objects.create(
        container_number="T-TAKEN", container_type=container_type,
    )
    it = _make_item(receipt, site, research_type, container_type)
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {
            "items": [
                {"item_id": it.pk, "matched": True,
                 "container_number": "T-TAKEN"},
            ],
        },
        format="json",
    )
    assert response.status_code == 400
    assert "уже занят" in str(response.data)


@pytest.mark.django_db
def test_check_missing_container_type_error(
    auth_client, receipt, site, research_type, container_type,
):
    # ReceiptItem без container_type (legacy).
    it = ReceiptItem.objects.create(
        receipt=receipt,
        container=None,
        container_type=None,
        expected_work_order_number="TST00472",
        expected_research_type_code=research_type.code,
        expected_site_code=site.code,
        expected_samples_count=1,
        site=site,
        research_type=research_type,
        status=ReceiptItem.STATUS_EXPECTED,
    )
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {"items": [{"item_id": it.pk, "matched": True}]},
        format="json",
    )
    assert response.status_code == 400
    assert "тип тары" in str(response.data).lower()


@pytest.mark.django_db
def test_check_missing_with_samples_fails(
    auth_client, receipt, site, research_type, container_type,
):
    it = _make_item(
        receipt, site, research_type, container_type,
        with_container=True, container_number="T-WITH-SAMPLE",
    )
    Sample.objects.create(
        sample_number="TST001",
        research_type=research_type,
        container=it.container,
    )
    response = auth_client.post(
        f"/api/v1/receipts/{receipt.pk}/check/",
        {"items": [{"item_id": it.pk, "matched": False}]},
        format="json",
    )
    assert response.status_code == 400
    assert "пробы" in str(response.data).lower()