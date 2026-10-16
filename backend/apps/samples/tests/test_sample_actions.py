"""
Тесты custom actions `SampleViewSet` (пачка 2f-2b).

Покрывают:
- `POST /samples/{id}/dispose/` — утилизация с аудитом;
- `POST /samples/{id}/restore/` — возврат из утилизации;
- `DELETE /samples/{id}/` — успешное удаление;
- `DELETE /samples/{id}/` — 409 при `ProtectedError`.
"""

from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.db.models.deletion import ProtectedError
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType

User = get_user_model()


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def user(db):
    return User.objects.create_user(username="sam-user", password="p")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-001", container_type=container_type,
    )


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлих")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


@pytest.fixture
def sample(db, container, research_type, site):
    return Sample.objects.create(
        sample_number="TST001",
        container=container,
        research_type=research_type,
        site=site,
    )


# ============================================================
# Dispose
# ============================================================
@pytest.mark.django_db
def test_dispose_sets_status_and_audit(api, sample, user):
    resp = api.post(
        f"/api/v1/samples/{sample.pk}/dispose/",
        {"disposal_reason": "Разбита"},
        format="json",
    )

    assert resp.status_code == 200
    sample.refresh_from_db()
    assert sample.status == Sample.STATUS_DISPOSED
    assert sample.disposed_at is not None
    assert sample.disposed_by == user
    assert sample.disposal_reason == "Разбита"


@pytest.mark.django_db
def test_dispose_already_disposed_returns_400(api, sample):
    sample.status = Sample.STATUS_DISPOSED
    sample.save(update_fields=["status"])

    resp = api.post(
        f"/api/v1/samples/{sample.pk}/dispose/", format="json",
    )

    assert resp.status_code == 400


@pytest.mark.django_db
def test_dispose_without_reason_is_ok(api, sample):
    resp = api.post(
        f"/api/v1/samples/{sample.pk}/dispose/", format="json",
    )

    assert resp.status_code == 200
    sample.refresh_from_db()
    assert sample.disposal_reason == ""
    assert sample.status == Sample.STATUS_DISPOSED


# ============================================================
# Restore
# ============================================================
@pytest.mark.django_db
def test_restore_from_disposed_returns_200(api, sample):
    sample.status = Sample.STATUS_DISPOSED
    sample.disposal_reason = "test"
    sample.save(update_fields=["status", "disposal_reason"])

    resp = api.post(
        f"/api/v1/samples/{sample.pk}/restore/", format="json",
    )

    assert resp.status_code == 200
    sample.refresh_from_db()
    assert sample.status == Sample.STATUS_IN_STORAGE
    assert sample.disposal_reason == ""
    assert sample.disposed_at is None


@pytest.mark.django_db
def test_restore_not_disposed_returns_400(api, sample):
    resp = api.post(
        f"/api/v1/samples/{sample.pk}/restore/", format="json",
    )

    assert resp.status_code == 400


# ============================================================
# Delete
# ============================================================
@pytest.mark.django_db
def test_delete_sample_returns_204(api, sample):
    resp = api.delete(f"/api/v1/samples/{sample.pk}/")

    assert resp.status_code == 204
    assert not Sample.objects.filter(pk=sample.pk).exists()


@pytest.mark.django_db
def test_delete_sample_protected_returns_409(api, sample):
    """
    Мокаем `perform_destroy` → `ProtectedError` (как в реальности
    при ссылках из `PickListItem` / `ShipmentItem`). Это
    единственный тест в файле, который не заводит реальные
    связанные объекты: точная форма `ShipmentItem` / `PickListItem`
    нам здесь не важна — важно поведение `destroy`.
    """
    with patch(
        "apps.samples.views.SampleViewSet.perform_destroy",
        side_effect=ProtectedError("test", []),
    ):
        resp = api.delete(f"/api/v1/samples/{sample.pk}/")

    assert resp.status_code == 409
    body = resp.json()
    assert "error" in body
    assert Sample.objects.filter(pk=sample.pk).exists()