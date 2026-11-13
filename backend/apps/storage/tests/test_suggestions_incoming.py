"""Тесты /storage/suggestions/ — incoming work orders.

c-3.x-migration-5d-fix.
"""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.work_orders.models import WorkOrder


@pytest.fixture
def user(db):
    User = get_user_model()
    return User.objects.create_user(username="sugg_test", password="p")


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_suggestions_returns_work_orders_incoming(api_client):
    WorkOrder.objects.create(
        order_number="02-Тест001", order_type="INCOMING",
    )
    WorkOrder.objects.create(
        order_number="TST0001", order_type="CODED",
    )

    resp = api_client.get("/api/v1/storage/suggestions/")

    assert resp.status_code == 200
    body = resp.json()
    assert "work_orders_incoming" in body
    assert "02-Тест001" in body["work_orders_incoming"]
    assert "TST0001" not in body["work_orders_incoming"]


@pytest.mark.django_db
def test_suggestions_returns_empty_incoming(api_client):
    resp = api_client.get("/api/v1/storage/suggestions/")
    assert resp.status_code == 200
    assert resp.json()["work_orders_incoming"] == []