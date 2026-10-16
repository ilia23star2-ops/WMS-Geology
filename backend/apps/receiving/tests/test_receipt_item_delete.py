"""
Тесты каскадного удаления ReceiptItem (пачка 2f-5a-1).

Покрывают:
- удаление строки без тары;
- удаление строки с пустой тарой (тара тоже уходит);
- удаление строки с тарой, в которой есть пробы (пробы уходят);
- 409, если проба защищена (`ProtectedError` в моке);
- 404 на несуществующую строку.
"""

import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError
from unittest.mock import patch
from rest_framework.test import APIClient

from apps.receiving.models import Receipt, ReceiptItem
from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType

User = get_user_model()


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def user(db):
    return User.objects.create_user(username="del-user", password="p")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def receipt(db):
    return Receipt.objects.create(
        receipt_number="ПР-DEL-001",
        status=Receipt.STATUS_IN_PROGRESS,
    )


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлих")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


# ============================================================
# Удаление
# ============================================================
@pytest.mark.django_db
def test_delete_item_without_container(api, receipt):
    item = ReceiptItem.objects.create(
        receipt=receipt,
        status=ReceiptItem.STATUS_EXPECTED,
        expected_samples_count=1,
    )

    resp = api.delete(f"/api/v1/receipt-items/{item.pk}/")

    assert resp.status_code == 204
    assert not ReceiptItem.objects.filter(pk=item.pk).exists()


@pytest.mark.django_db
def test_delete_item_with_empty_container(
    api, receipt, container_type,
):
    container = Container.objects.create(
        container_number="DEL-1", container_type=container_type,
    )
    item = ReceiptItem.objects.create(
        receipt=receipt,
        container=container,
        status=ReceiptItem.STATUS_MATCHED,
    )

    resp = api.delete(f"/api/v1/receipt-items/{item.pk}/")

    assert resp.status_code == 204
    assert not ReceiptItem.objects.filter(pk=item.pk).exists()
    assert not Container.objects.filter(pk=container.pk).exists()


@pytest.mark.django_db
def test_delete_item_with_container_and_samples(
    api, receipt, container_type, research_type, site,
):
    """Удаляется тара вместе со своими пробами."""
    container = Container.objects.create(
        container_number="DEL-2", container_type=container_type,
    )
    Sample.objects.create(
        sample_number="S-1",
        container=container,
        research_type=research_type,
        site=site,
    )
    Sample.objects.create(
        sample_number="S-2",
        container=container,
        research_type=research_type,
        site=site,
    )
    item = ReceiptItem.objects.create(
        receipt=receipt,
        container=container,
        status=ReceiptItem.STATUS_MATCHED,
    )

    resp = api.delete(f"/api/v1/receipt-items/{item.pk}/")

    assert resp.status_code == 204
    assert not ReceiptItem.objects.filter(pk=item.pk).exists()
    assert not Container.objects.filter(pk=container.pk).exists()
    assert Sample.objects.filter(container=container).count() == 0


@pytest.mark.django_db
def test_delete_item_returns_404_for_unknown(api):
    resp = api.delete("/api/v1/receipt-items/999999/")
    assert resp.status_code == 404


@pytest.mark.django_db
def test_delete_item_returns_409_if_sample_protected(
    api, receipt, container_type, research_type, site,
):
    """
    Мокаем `Sample.delete()` → `ProtectedError`. Проверяем, что
    строка и тара не удалились.
    """
    container = Container.objects.create(
        container_number="DEL-3", container_type=container_type,
    )
    Sample.objects.create(
        sample_number="S-3",
        container=container,
        research_type=research_type,
        site=site,
    )
    item = ReceiptItem.objects.create(
        receipt=receipt,
        container=container,
        status=ReceiptItem.STATUS_MATCHED,
    )

    with patch.object(
        Sample,
        "delete",
        side_effect=ProtectedError("test", []),
    ):
        resp = api.delete(f"/api/v1/receipt-items/{item.pk}/")

    assert resp.status_code == 409
    assert "error" in resp.json()
    assert ReceiptItem.objects.filter(pk=item.pk).exists()
    assert Container.objects.filter(pk=container.pk).exists()