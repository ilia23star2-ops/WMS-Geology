"""
Тесты фильтра `?updated_since=` для /storage/containers/ (c-6b).

Mobile (c-6c) делает инкрементальный Pull: отдаём только
записи с updated_at > указанного момента.
"""

from datetime import timedelta

import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="tester", password="x")
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка", size_class="M")


@pytest.mark.django_db
def test_updated_since_filters_old(auth_client, container_type):
    """updated_at старше cutoff — не попадает в ответ."""
    c_old = Container.objects.create(container_type=container_type)
    c_new = Container.objects.create(container_type=container_type)

    now = timezone.now()
    Container.objects.filter(pk=c_old.pk).update(
        updated_at=now - timedelta(hours=2),
    )
    Container.objects.filter(pk=c_new.pk).update(updated_at=now)

    cutoff = (now - timedelta(hours=1)).isoformat()
    resp = auth_client.get(
        "/api/v1/storage/containers/",
        {"updated_since": cutoff},
    )
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.data["results"]}
    assert ids == {c_new.pk}


@pytest.mark.django_db
def test_updated_since_absent_returns_all(auth_client, container_type):
    """Без параметра — полный Pull, все тары."""
    Container.objects.create(container_type=container_type)
    Container.objects.create(container_type=container_type)

    resp = auth_client.get("/api/v1/storage/containers/")
    assert resp.status_code == 200
    assert resp.data["count"] == 2


@pytest.mark.django_db
def test_updated_since_invalid_format_returns_400(
    auth_client, container_type,
):
    """Невалидный ISO → 400."""
    resp = auth_client.get(
        "/api/v1/storage/containers/",
        {"updated_since": "not-a-date"},
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_updated_since_naive_returns_400(auth_client, container_type):
    """Naive datetime без таймзоны → 400."""
    resp = auth_client.get(
        "/api/v1/storage/containers/",
        {"updated_since": "2026-10-29T12:00:00"},
    )
    assert resp.status_code == 400