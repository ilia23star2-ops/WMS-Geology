"""
Тесты action `POST /api/v1/storage/containers/bulk-create/`.

Покрывают:
- успешное создание тары с пробами (шифрованные + нешифрованные);
- автосоздание WorkOrder (CODED и INCOMING);
- связь linked_order в обе стороны;
- Well создаётся для нешифрованных;
- ошибки: существующая тара, несуществующий research_type / site;
- валидацию sequence_from > sequence_to.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample, Well
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="bulk_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


def _payload(container_type, research_type, site, **overrides):
    base = {
        "work_order_coded": "TST0001",
        "work_order_incoming": "02-Тест001",
        "research_type_id": research_type.pk,
        "site_id": site.pk,
        "containers": [
            {
                "container_number": "T-BULK-001",
                "container_type_id": container_type.pk,
                "sample_groups": [
                    {
                        "prefix": "TAA-A",
                        "middle": "34076",
                        "sequence_from": 1,
                        "sequence_to": 3,
                        "well_name": None,
                    },
                    {
                        "prefix": "TST",
                        "middle": "124",
                        "sequence_from": 1,
                        "sequence_to": 2,
                        "well_name": "124",
                    },
                ],
            },
        ],
    }
    base.update(overrides)
    return base


# ============================================================
# Успешный сценарий
# ============================================================
@pytest.mark.django_db
def test_bulk_create_success(
    auth_client, container_type, research_type, site,
):
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        _payload(container_type, research_type, site),
        format="json",
    )
    assert response.status_code == 201
    assert response.data["total_containers"] == 1
    assert response.data["total_samples"] == 5

    assert Container.objects.count() == 1
    assert Sample.objects.count() == 5

    # Шифрованные — без Well.
    s_coded = Sample.objects.get(sample_number="TAA-A34076001")
    assert s_coded.well is None

    # Нешифрованные — с Well «124».
    s_plain = Sample.objects.get(sample_number="TST124001")
    assert s_plain.well is not None
    assert s_plain.well.well_name == "124"


# ============================================================
# WorkOrder CODED и INCOMING + linked
# ============================================================
@pytest.mark.django_db
def test_bulk_create_work_orders_linked(
    auth_client, container_type, research_type, site,
):
    auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        _payload(container_type, research_type, site),
        format="json",
    )

    coded = WorkOrder.objects.get(
        order_number="TST0001", order_type=WorkOrder.TYPE_CODED,
    )
    incoming = WorkOrder.objects.get(
        order_number="02-Тест001", order_type=WorkOrder.TYPE_INCOMING,
    )
    assert coded.linked_order_id == incoming.pk
    assert incoming.linked_order_id == coded.pk


@pytest.mark.django_db
def test_bulk_create_without_incoming(
    auth_client, container_type, research_type, site,
):
    payload = _payload(container_type, research_type, site)
    payload["work_order_incoming"] = ""
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 201
    assert not WorkOrder.objects.filter(
        order_type=WorkOrder.TYPE_INCOMING,
    ).exists()


# ============================================================
# Well создаётся один раз
# ============================================================
@pytest.mark.django_db
def test_bulk_create_reuses_well(
    auth_client, container_type, research_type, site,
):
    Well.objects.create(well_name="124")

    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        _payload(container_type, research_type, site),
        format="json",
    )
    assert response.status_code == 201
    assert Well.objects.filter(well_name="124").count() == 1


# ============================================================
# Ошибки
# ============================================================
@pytest.mark.django_db
def test_bulk_create_existing_container(
    auth_client, container_type, research_type, site,
):
    Container.objects.create(
        container_number="T-BULK-001", container_type=container_type,
    )
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        _payload(container_type, research_type, site),
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_bulk_create_bad_research_type(
    auth_client, container_type, site,
):
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        {
            "work_order_coded": "TST0001",
            "research_type_id": 99999,
            "site_id": site.pk,
            "containers": [
                {
                    "container_number": "T-BULK-X",
                    "container_type_id": container_type.pk,
                    "sample_groups": [
                        {
                            "prefix": "X",
                            "middle": "1",
                            "sequence_from": 1,
                            "sequence_to": 1,
                        },
                    ],
                },
            ],
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_bulk_create_bad_site(
    auth_client, container_type, research_type,
):
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        {
            "work_order_coded": "TST0001",
            "research_type_id": research_type.pk,
            "site_id": 99999,
            "containers": [
                {
                    "container_number": "T-BULK-Y",
                    "container_type_id": container_type.pk,
                    "sample_groups": [
                        {
                            "prefix": "X",
                            "middle": "1",
                            "sequence_from": 1,
                            "sequence_to": 1,
                        },
                    ],
                },
            ],
        },
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_bulk_create_bad_sequence_range(
    auth_client, container_type, research_type, site,
):
    payload = _payload(container_type, research_type, site)
    payload["containers"][0]["sample_groups"][0]["sequence_from"] = 10
    payload["containers"][0]["sample_groups"][0]["sequence_to"] = 1
    response = auth_client.post(
        "/api/v1/storage/containers/bulk-create/",
        payload,
        format="json",
    )
    assert response.status_code == 400