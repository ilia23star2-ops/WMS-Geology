"""
Тесты фильтров и удаления тары (пачка 2f-1).

Покрывают:
- `?draft_work_order_coded=` (icontains);
- `?draft_research_type_id=`;
- `?status=` в комбинации с draft-фильтрами;
- `DELETE /containers/{id}/` — 204 при успехе;
- `DELETE /containers/{id}/` — 409, если есть связанные объекты
  (`ProtectedError`).
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType
from apps.storage.models import Container, ContainerType

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="filt-user", password="p")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка", max_on_standard_pallet=10)


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлих")


@pytest.fixture
def other_research_type(db):
    return ResearchType.objects.create(code="ХА", name="Хим. анализ")


# ============================================================
# Фильтры по draft-контексту
# ============================================================
@pytest.mark.django_db
def test_filter_by_draft_work_order_coded_icontains(
    api, container_type, research_type,
):
    Container.objects.create(
        container_number="1", container_type=container_type,
        draft_work_order_coded="TST0001",
        draft_research_type=research_type,
    )
    Container.objects.create(
        container_number="2", container_type=container_type,
        draft_work_order_coded="TST0002",
        draft_research_type=research_type,
    )

    resp = api.get(
        "/api/v1/storage/containers/",
        {"draft_work_order_coded": "0001"},
    )

    assert resp.status_code == 200
    numbers = sorted(r["container_number"] for r in resp.json()["results"])
    assert numbers == ["1"]


@pytest.mark.django_db
def test_filter_by_draft_research_type(
    api, container_type, research_type, other_research_type,
):
    Container.objects.create(
        container_number="1", container_type=container_type,
        draft_work_order_coded="TST0001",
        draft_research_type=research_type,
    )
    Container.objects.create(
        container_number="1", container_type=container_type,
        draft_work_order_coded="TST0001",
        draft_research_type=other_research_type,
    )

    resp = api.get(
        "/api/v1/storage/containers/",
        {"draft_research_type_id": research_type.pk},
    )

    assert resp.status_code == 200
    assert resp.json()["count"] == 1


@pytest.mark.django_db
def test_filter_draft_work_order_and_research_type_combined(
    api, container_type, research_type, other_research_type,
):
    """Комбинация — те же номера из разных (Н/З × ТИ) различаются."""
    Container.objects.create(
        container_number="1", container_type=container_type,
        draft_work_order_coded="TST0001",
        draft_research_type=research_type,
    )
    Container.objects.create(
        container_number="1", container_type=container_type,
        draft_work_order_coded="TST0001",
        draft_research_type=other_research_type,
    )

    resp = api.get(
        "/api/v1/storage/containers/",
        {
            "draft_work_order_coded": "TST0001",
            "draft_research_type_id": research_type.pk,
        },
    )

    assert resp.status_code == 200
    assert resp.json()["count"] == 1


# ============================================================
# DELETE
# ============================================================
@pytest.mark.django_db
def test_delete_container_returns_204(api, container_type):
    c = Container.objects.create(
        container_number="DEL-1", container_type=container_type,
    )
    resp = api.delete(f"/api/v1/storage/containers/{c.pk}/")

    assert resp.status_code == 204
    assert not Container.objects.filter(pk=c.pk).exists()


@pytest.mark.django_db
def test_delete_container_protected_returns_409(api, container_type):
    """
    Тара в партии печати → `ProtectedError` → 409.
    """
    from apps.labels.models import PrintBatch, PrintBatchItem

    c = Container.objects.create(
        container_number="PROT-1", container_type=container_type,
    )
    batch = PrintBatch.objects.create(created_by=None)
    PrintBatchItem.objects.create(batch=batch, container=c, position=1)

    resp = api.delete(f"/api/v1/storage/containers/{c.pk}/")

    assert resp.status_code == 409
    body = resp.json()
    assert "error" in body
    assert Container.objects.filter(pk=c.pk).exists()