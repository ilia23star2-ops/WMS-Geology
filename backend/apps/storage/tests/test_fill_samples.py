"""
Тесты action `POST /api/v1/storage/containers/{id}/fill-samples/`.

Покрывают:
- успешное заполнение тары пробами (шифрованные + нешифрованные);
- автосоздание WorkOrder (CODED и INCOMING);
- связь linked_order в обе стороны;
- Well создаётся для нешифрованных, переиспользуется;
- синхронизацию статуса проб со статусом тары;
- правило «одна тара = один тип исследования»;
- ошибки: несуществующий research_type / site,
  sequence_from > sequence_to, тара не найдена.
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
    user = User.objects.create_user(username="fill_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-FILL-001",
        container_type=container_type,
        status=Container.STATUS_PENDING_PLACEMENT,
    )


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def research_type_ha(db):
    return ResearchType.objects.create(code="ХА", name="Хим. анализ")


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


def _payload(research_type, site, **overrides):
    base = {
        "work_order_coded": "TST0001",
        "work_order_incoming": "02-Тест001",
        "research_type_id": research_type.pk,
        "site_id": site.pk,
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
    }
    base.update(overrides)
    return base


def _url(container):
    return f"/api/v1/storage/containers/{container.pk}/fill-samples/"


# ============================================================
# Успешный сценарий
# ============================================================
@pytest.mark.django_db
def test_fill_samples_success(auth_client, container, research_type, site):
    response = auth_client.post(
        _url(container),
        _payload(research_type, site),
        format="json",
    )
    assert response.status_code == 201
    assert response.data["total_samples"] == 5
    assert response.data["container_id"] == container.pk

    assert Sample.objects.count() == 5
    assert container.samples.count() == 5

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
def test_fill_samples_work_orders_linked(
    auth_client, container, research_type, site,
):
    auth_client.post(
        _url(container),
        _payload(research_type, site),
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
def test_fill_samples_without_incoming(
    auth_client, container, research_type, site,
):
    payload = _payload(research_type, site)
    payload["work_order_incoming"] = ""
    response = auth_client.post(_url(container), payload, format="json")
    assert response.status_code == 201
    assert not WorkOrder.objects.filter(
        order_type=WorkOrder.TYPE_INCOMING,
    ).exists()


# ============================================================
# Well
# ============================================================
@pytest.mark.django_db
def test_fill_samples_reuses_well(
    auth_client, container, research_type, site,
):
    Well.objects.create(well_name="124")
    response = auth_client.post(
        _url(container),
        _payload(research_type, site),
        format="json",
    )
    assert response.status_code == 201
    assert Well.objects.filter(well_name="124").count() == 1


# ============================================================
# Статус проб — синхронизация со статусом тары
# ============================================================
@pytest.mark.django_db
def test_fill_samples_pending_placement_container(
    auth_client, container, research_type, site,
):
    """Тара PENDING_PLACEMENT → пробы PENDING_PLACEMENT."""
    assert container.status == Container.STATUS_PENDING_PLACEMENT
    auth_client.post(
        _url(container), _payload(research_type, site), format="json",
    )
    assert Sample.objects.filter(
        status=Sample.STATUS_PENDING_PLACEMENT,
    ).count() == 5


@pytest.mark.django_db
def test_fill_samples_active_container(
    auth_client, container, research_type, site,
):
    """Тара ACTIVE → пробы IN_STORAGE."""
    container.status = Container.STATUS_ACTIVE
    container.save(update_fields=["status"])
    auth_client.post(
        _url(container), _payload(research_type, site), format="json",
    )
    assert Sample.objects.filter(
        status=Sample.STATUS_IN_STORAGE,
    ).count() == 5


# ============================================================
# Ошибки
# ============================================================
@pytest.mark.django_db
def test_fill_samples_bad_research_type(
    auth_client, container, research_type, site,
):
    payload = _payload(research_type, site)
    payload["research_type_id"] = 99999
    response = auth_client.post(_url(container), payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_fill_samples_bad_site(
    auth_client, container, research_type, site,
):
    payload = _payload(research_type, site)
    payload["site_id"] = 99999
    response = auth_client.post(_url(container), payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_fill_samples_bad_sequence_range(
    auth_client, container, research_type, site,
):
    payload = _payload(research_type, site)
    payload["sample_groups"][0]["sequence_from"] = 10
    payload["sample_groups"][0]["sequence_to"] = 1
    response = auth_client.post(_url(container), payload, format="json")
    assert response.status_code == 400


@pytest.mark.django_db
def test_fill_samples_container_not_found(auth_client, research_type, site):
    response = auth_client.post(
        "/api/v1/storage/containers/99999/fill-samples/",
        _payload(research_type, site),
        format="json",
    )
    assert response.status_code == 404


# ============================================================
# Одна тара = один тип исследования
# ============================================================
@pytest.mark.django_db
def test_fill_samples_same_research_type_allowed(
    auth_client, container, research_type, site,
):
    """Повторное заполнение тем же ТИ — разрешено."""
    auth_client.post(
        _url(container), _payload(research_type, site), format="json",
    )
    second = _payload(research_type, site)
    second["sample_groups"] = [
        {
            "prefix": "NEW",
            "middle": "999",
            "sequence_from": 1,
            "sequence_to": 2,
            "well_name": None,
        },
    ]
    response = auth_client.post(_url(container), second, format="json")
    assert response.status_code == 201
    assert container.samples.count() == 7


@pytest.mark.django_db
def test_fill_samples_different_research_type_blocked(
    auth_client, container, research_type, research_type_ha, site,
):
    """Другой ТИ — 400."""
    auth_client.post(
        _url(container), _payload(research_type, site), format="json",
    )
    second = _payload(research_type_ha, site)
    second["sample_groups"] = [
        {
            "prefix": "HA",
            "middle": "1",
            "sequence_from": 1,
            "sequence_to": 1,
            "well_name": None,
        },
    ]
    response = auth_client.post(_url(container), second, format="json")
    assert response.status_code == 400