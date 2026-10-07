"""
Тесты API приложения samples.

Покрывают:
- CRUD для Sample, Well, SampleWorkOrder;
- фильтры (sample_number, research_type, site, status);
- **ключевой фильтр `?work_order=`** — с учётом linked_order
  (входящий и зашифрованный дают одинаковый набор);
- скрытие утилизированных по умолчанию;
- `?show_disposed=true` — показать утилизированные.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.models import Sample, SampleWorkOrder, Well
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="s_user", password="test")
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
def test_samples_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/samples/")
    assert response.status_code in (401, 403)


# ============================================================
# CRUD
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
    assert response.data["status"] == "IN_STORAGE"


def test_sample_retrieve_with_nested_fields(auth_client, sample):
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
# Простые фильтры
# ============================================================
def test_filter_by_sample_number(auth_client, sample, container):
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


def test_filter_by_container_id(auth_client, sample, container, container_type):
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
# КЛЮЧЕВОЙ фильтр: ?work_order= с учётом linked_order
# ============================================================
def test_filter_work_order_by_incoming_finds_sample(
    auth_client, sample, incoming, coded
):
    """Фильтр по входящему находит пробу, связанную через M:N."""
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming)
    SampleWorkOrder.objects.create(sample=sample, work_order=coded)

    response = auth_client.get("/api/v1/samples/?work_order=A-100")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["sample_number"] == "12345"


def test_filter_work_order_by_coded_finds_same_sample(
    auth_client, sample, incoming, coded
):
    """Фильтр по зашифрованному даёт тот же набор, что и по входящему."""
    SampleWorkOrder.objects.create(sample=sample, work_order=incoming)
    SampleWorkOrder.objects.create(sample=sample, work_order=coded)

    response = auth_client.get("/api/v1/samples/?work_order=X-200")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert response.data["results"][0]["sample_number"] == "12345"


def test_filter_work_order_via_linked_only(
    auth_client, sample, incoming, coded
):
    """
    Если проба связана только с одним из пары — фильтр по другому
    всё равно находит её через linked_order.
    """
    # Связываем входящий ↔ зашифрованный.
    incoming.linked_order = coded
    incoming.save()

    # Проба связана только с зашифрованным.
    SampleWorkOrder.objects.create(sample=sample, work_order=coded)

    # Фильтр по входящему всё равно её находит.
    response = auth_client.get("/api/v1/samples/?work_order=A-100")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_work_order_nonexistent_returns_empty(auth_client, db):
    response = auth_client.get("/api/v1/samples/?work_order=ZZZ-999")
    assert response.status_code == 200
    assert response.data["count"] == 0


# ============================================================
# Скрытие утилизированных
# ============================================================
def test_disposed_hidden_by_default(auth_client, sample, container):
    Sample.objects.create(
        sample_number="DISPOSED", research_type="Химия",
        container=container, status=Sample.STATUS_DISPOSED,
    )
    response = auth_client.get("/api/v1/samples/")
    assert response.status_code == 200
    assert response.data["count"] == 1  # только активная


def test_disposed_shown_with_param(auth_client, sample, container):
    Sample.objects.create(
        sample_number="DISPOSED", research_type="Химия",
        container=container, status=Sample.STATUS_DISPOSED,
    )
    response = auth_client.get("/api/v1/samples/?show_disposed=true")
    assert response.status_code == 200
    assert response.data["count"] == 2


# ============================================================
# Well
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
# SampleWorkOrder
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