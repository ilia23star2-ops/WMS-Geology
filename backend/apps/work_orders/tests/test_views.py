"""
Тесты API приложения work_orders.

Покрывают:
- CRUD;
- фильтры (order_number, order_type, status, site_id, site_code);
- custom action link.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.samples.catalogs import Site
from apps.work_orders.models import WorkOrder


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="wo_user", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


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
def site(db):
    return Site.objects.create(code="TST", name="Тестовый")


# ============================================================
# Аутентификация
# ============================================================
def test_work_orders_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/work-orders/")
    assert response.status_code in (401, 403)


# ============================================================
# CRUD
# ============================================================
def test_work_order_create(auth_client, db):
    response = auth_client.post(
        "/api/v1/work-orders/",
        {"order_number": "A-001", "order_type": "INCOMING"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["order_number"] == "A-001"
    assert response.data["status"] == "ACTIVE"


def test_work_order_list(auth_client, incoming, coded):
    response = auth_client.get("/api/v1/work-orders/")
    assert response.status_code == 200
    assert response.data["count"] == 2


def test_work_order_retrieve(auth_client, incoming):
    response = auth_client.get(f"/api/v1/work-orders/{incoming.pk}/")
    assert response.status_code == 200
    assert response.data["order_number"] == "A-100"


def test_work_order_update(auth_client, incoming):
    response = auth_client.patch(
        f"/api/v1/work-orders/{incoming.pk}/",
        {"status": "COMPLETED"}, format="json",
    )
    assert response.status_code == 200
    incoming.refresh_from_db()
    assert incoming.status == "COMPLETED"


def test_work_order_delete(auth_client, incoming):
    response = auth_client.delete(f"/api/v1/work-orders/{incoming.pk}/")
    assert response.status_code == 204
    assert not WorkOrder.objects.filter(pk=incoming.pk).exists()


# ============================================================
# Фильтры
# ============================================================
def test_filter_by_order_number(auth_client, incoming, coded):
    response = auth_client.get("/api/v1/work-orders/?order_number=A-100")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_order_type(auth_client, incoming, coded):
    response = auth_client.get("/api/v1/work-orders/?order_type=CODED")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_status(auth_client, incoming, coded):
    incoming.status = "COMPLETED"
    incoming.save()
    response = auth_client.get("/api/v1/work-orders/?status=COMPLETED")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Фильтры по site
# ============================================================
def test_filter_by_site_id(auth_client, incoming, coded, site):
    incoming.site = site
    incoming.save()
    response = auth_client.get(f"/api/v1/work-orders/?site_id={site.pk}")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_filter_by_site_code(auth_client, incoming, coded, site):
    incoming.site = site
    incoming.save()
    response = auth_client.get("/api/v1/work-orders/?site_code=TST")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_site_name_in_serializer(auth_client, incoming, site):
    incoming.site = site
    incoming.save()
    response = auth_client.get(f"/api/v1/work-orders/{incoming.pk}/")
    assert response.status_code == 200
    assert response.data["site_name"] == "Тестовый"


# ============================================================
# Custom action: link
# ============================================================
def test_link_success(auth_client, incoming, coded):
    response = auth_client.post(
        f"/api/v1/work-orders/{incoming.pk}/link/",
        {"linked_order_id": coded.pk}, format="json",
    )
    assert response.status_code == 200
    incoming.refresh_from_db()
    assert incoming.linked_order_id == coded.pk


def test_link_self_raises(auth_client, incoming):
    response = auth_client.post(
        f"/api/v1/work-orders/{incoming.pk}/link/",
        {"linked_order_id": incoming.pk}, format="json",
    )
    assert response.status_code == 400


def test_link_same_type_raises(auth_client, incoming):
    other_incoming = WorkOrder.objects.create(
        order_number="A-200", order_type=WorkOrder.TYPE_INCOMING,
    )
    response = auth_client.post(
        f"/api/v1/work-orders/{incoming.pk}/link/",
        {"linked_order_id": other_incoming.pk}, format="json",
    )
    assert response.status_code == 400


def test_link_nonexistent_raises(auth_client, incoming):
    response = auth_client.post(
        f"/api/v1/work-orders/{incoming.pk}/link/",
        {"linked_order_id": 99999}, format="json",
    )
    assert response.status_code == 400


def test_link_missing_body_raises(auth_client, incoming):
    response = auth_client.post(
        f"/api/v1/work-orders/{incoming.pk}/link/", {}, format="json",
    )
    assert response.status_code == 400


# ============================================================
# Валидация сериализатора
# ============================================================
def test_serializer_self_link_raises(auth_client, incoming):
    response = auth_client.patch(
        f"/api/v1/work-orders/{incoming.pk}/",
        {"linked_order": incoming.pk}, format="json",
    )
    assert response.status_code == 400
    assert "linked_order" in response.data


def test_serializer_same_type_raises(auth_client, incoming):
    other = WorkOrder.objects.create(
        order_number="A-300", order_type=WorkOrder.TYPE_INCOMING,
    )
    response = auth_client.patch(
        f"/api/v1/work-orders/{incoming.pk}/",
        {"linked_order": other.pk}, format="json",
    )
    assert response.status_code == 400
    assert "linked_order" in response.data