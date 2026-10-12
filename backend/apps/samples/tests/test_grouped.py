"""
Тесты action `GET /api/v1/samples/grouped/`.

Покрывают:
- пустой результат;
- одна группа;
- несколько групп;
- сортировку (алфавит, без Н/З в конце);
- пагинацию по 20 групп;
- структуру ответа (containers, samples).
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="grouped_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-001",
        container_type=container_type,
    )


@pytest.fixture
def rt_shl(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def rt_ha(db):
    return ResearchType.objects.create(code="ХА", name="Хим. анализ")


@pytest.fixture
def wo_alpha(db):
    return WorkOrder.objects.create(
        order_number="A-100", order_type=WorkOrder.TYPE_INCOMING,
    )


@pytest.fixture
def wo_beta(db):
    return WorkOrder.objects.create(
        order_number="B-200", order_type=WorkOrder.TYPE_INCOMING,
    )


def _make_sample(container, rt, wo, number):
    return Sample.objects.create(
        sample_number=number,
        research_type=rt,
        container=container,
        current_work_order=wo,
    )


# ============================================================
# Пустой результат
# ============================================================
@pytest.mark.django_db
def test_grouped_empty(auth_client):
    response = auth_client.get("/api/v1/samples/grouped/")
    assert response.status_code == 200
    assert response.data["count"] == 0
    assert response.data["results"] == []
    assert response.data["page_size"] == 20
    assert response.data["next"] is None
    assert response.data["previous"] is None


# ============================================================
# Одна группа
# ============================================================
@pytest.mark.django_db
def test_grouped_one_group(auth_client, container, rt_shl, wo_alpha):
    _make_sample(container, rt_shl, wo_alpha, "S-001")
    _make_sample(container, rt_shl, wo_alpha, "S-002")

    response = auth_client.get("/api/v1/samples/grouped/")
    assert response.status_code == 200
    assert response.data["count"] == 1
    assert len(response.data["results"]) == 1

    group = response.data["results"][0]
    assert group["work_order"]["number"] == "A-100"
    assert group["research_type"]["code"] == "ШЛ"
    assert group["total_samples"] == 2
    assert len(group["containers"]) == 1
    assert group["containers"][0]["container"]["number"] == "T-001"
    assert len(group["containers"][0]["samples"]) == 2


# ============================================================
# Несколько групп + сортировка по алфавиту
# ============================================================
@pytest.mark.django_db
def test_grouped_sorted_by_wo_number(
    auth_client, container, rt_shl, wo_alpha, wo_beta,
):
    _make_sample(container, rt_shl, wo_beta, "S-B")
    _make_sample(container, rt_shl, wo_alpha, "S-A")

    response = auth_client.get("/api/v1/samples/grouped/")
    assert response.status_code == 200
    assert response.data["count"] == 2

    numbers = [g["work_order"]["number"] for g in response.data["results"]]
    assert numbers == ["A-100", "B-200"]


# ============================================================
# Сортировка внутри одного Н/З — по коду типа
# ============================================================
@pytest.mark.django_db
def test_grouped_sorted_by_rt_code(
    auth_client, container, rt_shl, rt_ha, wo_alpha,
):
    _make_sample(container, rt_shl, wo_alpha, "S-SHL")
    _make_sample(container, rt_ha, wo_alpha, "S-HA")

    response = auth_client.get("/api/v1/samples/grouped/")
    codes = [g["research_type"]["code"] for g in response.data["results"]]
    assert codes == ["ХА", "ШЛ"]  # Х < Ш в Unicode


# ============================================================
# Без Н/З — в конце
# ============================================================
@pytest.mark.django_db
def test_grouped_no_wo_at_end(
    auth_client, container, rt_shl, wo_alpha,
):
    _make_sample(container, rt_shl, None, "S-NO-WO")
    _make_sample(container, rt_shl, wo_alpha, "S-WITH-WO")

    response = auth_client.get("/api/v1/samples/grouped/")
    results = response.data["results"]
    assert len(results) == 2
    # Первая — с Н/З, вторая — без.
    assert results[0]["work_order"] is not None
    assert results[0]["work_order"]["number"] == "A-100"
    assert results[1]["work_order"] is None


# ============================================================
# Пагинация
# ============================================================
@pytest.mark.django_db
def test_grouped_pagination(
    auth_client, container, rt_shl,
):
    # 25 разных Н/З → 25 групп.
    for i in range(25):
        wo = WorkOrder.objects.create(
            order_number=f"WO-{i:03d}",
            order_type=WorkOrder.TYPE_INCOMING,
        )
        _make_sample(container, rt_shl, wo, f"S-{i:03d}")

    response = auth_client.get("/api/v1/samples/grouped/")
    assert response.status_code == 200
    assert response.data["count"] == 25
    assert len(response.data["results"]) == 20
    assert response.data["next"] is not None
    assert response.data["previous"] is None

    # Вторая страница.
    response2 = auth_client.get("/api/v1/samples/grouped/?page=2")
    assert response2.status_code == 200
    assert len(response2.data["results"]) == 5
    assert response2.data["next"] is None
    assert response2.data["previous"] is not None


# ============================================================
# Фильтры работают
# ============================================================
@pytest.mark.django_db
def test_grouped_with_q_filter(
    auth_client, container, rt_shl, wo_alpha,
):
    _make_sample(container, rt_shl, wo_alpha, "TAA-34076001-001")
    _make_sample(container, rt_shl, wo_alpha, "OTHER-001")

    response = auth_client.get("/api/v1/samples/grouped/?q=34076001")
    assert response.status_code == 200
    assert response.data["count"] == 1
    group = response.data["results"][0]
    assert group["total_samples"] == 1


# ============================================================
# Локация в группе
# ============================================================
@pytest.mark.django_db
def test_grouped_container_has_location(
    auth_client, container, rt_shl, wo_alpha,
):
    _make_sample(container, rt_shl, wo_alpha, "S-001")

    response = auth_client.get("/api/v1/samples/grouped/")
    group = response.data["results"][0]
    container_data = group["containers"][0]
    assert container_data["location"] == "Место не указано"