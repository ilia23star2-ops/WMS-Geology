"""
Тесты API приложения samples (справочники + модели + фильтры).

Справочники:
- ResearchType, Site, Laboratory: CRUD, фильтр is_active.

Модели:
- Well, Sample, SampleWorkOrder: CRUD, фильтры, ключевой фильтр work_order.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.catalogs import Laboratory, ResearchType, Site
from apps.samples.models import Sample, SampleWorkOrder, Well
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="samples_api", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-001", container_type=container_type,
    )


@pytest.fixture
def well(db):
    return Well.objects.create(well_name="Скв-101")


@pytest.fixture
def incoming(db):
    return WorkOrder.objects.create(
        order_number="A-100", order_type=WorkOrder.TYPE_INCOMING,
    )


@pytest.fixture
def coded(db):
    return WorkOrder.objects.create(
        order_number="X-200", order_type=WorkOrder.TYPE_CODED,
    )


@pytest.fixture
def sample(db, container, well, coded):
    return Sample.objects.create(
        sample_number="12345",
        research_type="Шлифы",
        site="Участок-1",
        container=container,
        well=well,
        current_work_order=coded,
    )


# ============================================================
# Аутентификация
# ============================================================
def test_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/samples/")
    assert response.status_code in (401, 403)


# ============================================================
# ResearchType API
# ============================================================
def test_research_type_create(auth_client, db):
    response = auth_client.post(
        "/api/v1/research-types/",
        {"code": "ШЛ", "name": "Шлифы"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["code"] == "ШЛ"
    assert response.data["is_active"] is True


def test_research_type_list(auth_client, db):
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    ResearchType.objects.create(code="ХА", name="Хим", is_active=False)

    response = auth_client.get("/api/v1/research-types/")
    assert response.status_code == 200
    assert response.data["count"] == 2


def test_research_type_filter_is_active(auth_client, db):
    ResearchType.objects.create(code="ШЛ", name="Шлифы")
    ResearchType.objects.create(code="ХА", name="Хим", is_active=False)

    response = auth_client.get("/api/v1/research-types/?is_active=true")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_research_type_update(auth_client, db):
    rt = ResearchType.objects.create(code="ШЛ", name="Шлифы")
    response = auth_client.patch(
        f"/api/v1/research-types/{rt.pk}/",
        {"name": "Шлифы 2"},
        format="json",
    )
    assert response.status_code == 200
    rt.refresh_from_db()
    assert rt.name == "Шлифы 2"


def test_research_type_delete(auth_client, db):
    rt = ResearchType.objects.create(code="ШЛ", name="Шлифы")
    response = auth_client.delete(f"/api/v1/research-types/{rt.pk}/")
    assert response.status_code == 204


# ============================================================
# Site API
# ============================================================
def test_site_create_with_patterns(auth_client, db):
    response = auth_client.post(
        "/api/v1/sites/",
        {"code": "TST", "name": "Тестовый", "match_patterns": ["TST", "Тест"]},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["match_patterns"] == ["TST", "Тест"]


def test_site_filter_is_active(auth_client, db):
    Site.objects.create(code="TST", name="Тестовый")
    Site.objects.create(code="СЕВ", name="Северный", is_active=False)

    response = auth_client.get("/api/v1/sites/?is_active=true")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Laboratory API
# ============================================================
def test_laboratory_create_with_prefixes(auth_client, db):
    response = auth_client.post(
        "/api/v1/laboratories/",
        {
            "code": "ЛАБ-1",
            "name": "Лаборатория 1",
            "prefixes": ["TAA-A", "TAA-B"],
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["prefixes"] == ["TAA-A", "TAA-B"]


def test_laboratory_filter_is_active(auth_client, db):
    Laboratory.objects.create(code="ЛАБ-1", name="Лаб 1")
    Laboratory.objects.create(code="ЛАБ-2", name="Лаб 2", is_active=False)

    response = auth_client.get("/api/v1/laboratories/?is_active=true")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Sample API — CRUD
# ============================================================
def test_sample_create(auth_client, container):
    response = auth_client.post(
        "/api/v1/samples/",
        {
            "sample_number": "99999",
            "research_type": "Химия",
            "container": container.pk,
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["sample_number"] == "99999"


def test_sample_retrieve_with_nested(auth_client, sample):
    response = auth_client.get(f"/api/v1/samples/{sample.pk}/")
    assert response.status_code == 200
    assert response.data["container_number"] == "T-001"
    assert response.data["well_name"] == "Скв-101"
    assert response.data["current_work_order_number"] == "X-200"


def test_sample_update(auth_client, sample):
    response = auth_client.patch(
        f"/api/v1/samples/{sample.pk}/",
        {"research_type": "Изотопы"},
        format="json",
    )
    assert response.status_code == 200
    sample.refresh_from_db()
    assert sample.research_type == "Изотопы"


def test_sample_delete(auth_client, sample):
    response = auth_client.delete(f"/api/v1/samples/{sample.pk}/")
    assert response.status_code == 204


# ============================================================
# Sample API — фильтры
# ============================================================
def test_sample_filter_by_number(auth_client, sample, container):
    Sample.objects.create(
        sample_number="67890", research_type="Химия", container=container,
    )
    response = auth_client.get("/api/v1/samples/?sample_number=12345")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_research_type(auth_client, sample, container):
    Sample.objects.create(
        sample_number="67890", research_type="Химия", container=container,
    )
    response = auth_client.get("/api/v1/samples/?research_type=Шлифы")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_site(auth_client, sample, container):
    Sample.objects.create(
        sample_number="67890", research_type="Химия",
        site="Участок-2", container=container,
    )
    response = auth_client.get("/api/v1/samples/?site=Участок-1")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_well_id(auth_client, sample, well, container):
    other_well = Well.objects.create(well_name="Скв-202")
    Sample.objects.create(
        sample_number="67890", research_type="Химия",
        well=other_well, container=container,
    )
    response = auth_client.get(f"/api/v1/samples/?well_id={well.pk}")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_container_id(
    auth_client, sample, container, container_type,
):
    other_container = Container.objects.create(
        container_number="T-002", container_type=container_type,
    )
    Sample.objects.create(
        sample_number="67890", research_type="Химия", container=other_container,
    )
    response = auth_client.get(
        f"/api/v1/samples/?container_id={container.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Sample API — ключевой фильтр work_order
# ============================================================
def test_filter_work_order_by_incoming(auth_client, sample, incoming, coded):
    """Фильтр по входящему Н/З находит пробу через M:N."""
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming)
    SampleWorkOrder.objects.create(sample=sample, work_order=coded)

    response = auth_client.get("/api/v1/samples/?work_order=A-100")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_work_order_by_coded(auth_client, sample, incoming, coded):
    """Фильтр по зашифрованному даёт тот же набор."""
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming)
    SampleWorkOrder.objects.create(sample=sample, work_order=coded)

    response = auth_client.get("/api/v1/samples/?work_order=X-200")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_work_order_via_linked_only(
    auth_client, sample, incoming, coded,
):
    """Если проба связана только с одним Н/З пары — фильтр по другому
    всё равно её находит через linked_order."""
    incoming.linked_order = coded
    incoming.save()

    SampleWorkOrder.objects.create(sample=sample, work_order=coded)

    response = auth_client.get("/api/v1/samples/?work_order=A-100")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_work_order_nonexistent_returns_empty(auth_client, db):
    response = auth_client.get("/api/v1/samples/?work_order=ZZZ-999")
    assert response.status_code == 200
    assert response.data["count"] == 0


# ============================================================
# Sample API — скрытие утилизированных
# ============================================================
def test_disposed_hidden_by_default(auth_client, sample, container):
    Sample.objects.create(
        sample_number="DISPOSED", research_type="Химия",
        container=container, status=Sample.STATUS_DISPOSED,
    )
    response = auth_client.get("/api/v1/samples/")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_disposed_shown_with_param(auth_client, sample, container):
    Sample.objects.create(
        sample_number="DISPOSED", research_type="Химия",
        container=container, status=Sample.STATUS_DISPOSED,
    )
    response = auth_client.get("/api/v1/samples/?show_disposed=true")
    assert response.status_code == 200
    assert response.data["count"] == 2


# ============================================================
# Well API
# ============================================================
def test_well_list(auth_client, well):
    response = auth_client.get("/api/v1/wells/")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_well_create(auth_client, db):
    response = auth_client.post(
        "/api/v1/wells/",
        {"well_name": "Скв-999"},
        format="json",
    )
    assert response.status_code == 201


# ============================================================
# SampleWorkOrder API
# ============================================================
def test_sample_work_order_create(auth_client, sample, incoming):
    response = auth_client.post(
        "/api/v1/sample-work-orders/",
        {"sample": sample.pk, "work_order": incoming.pk},
        format="json",
    )
    assert response.status_code == 201


def test_sample_work_order_filter_by_sample(auth_client, sample, incoming):
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming)
    response = auth_client.get(
        f"/api/v1/sample-work-orders/?sample_id={sample.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1