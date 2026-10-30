"""
Тесты фильтра `?updated_since=` для /samples/ (c-6b).
"""

from datetime import timedelta

import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="tester", password="x")
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def container(db):
    ct = ContainerType.objects.create(name="Коробка", size_class="M")
    return Container.objects.create(container_type=ct)


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.mark.django_db
def test_updated_since_filters_old(auth_client, container, research_type):
    """updated_at старше cutoff — не попадает в ответ."""
    s_old = Sample.objects.create(
        sample_number="S-OLD",
        research_type=research_type,
        container=container,
    )
    s_new = Sample.objects.create(
        sample_number="S-NEW",
        research_type=research_type,
        container=container,
    )

    now = timezone.now()
    Sample.objects.filter(pk=s_old.pk).update(
        updated_at=now - timedelta(hours=2),
    )
    Sample.objects.filter(pk=s_new.pk).update(updated_at=now)

    cutoff = (now - timedelta(hours=1)).isoformat()
    resp = auth_client.get("/api/v1/samples/", {"updated_since": cutoff})
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.data["results"]}
    assert ids == {s_new.pk}


@pytest.mark.django_db
def test_updated_since_invalid_format_returns_400(auth_client):
    """Невалидный ISO → 400."""
    resp = auth_client.get(
        "/api/v1/samples/", {"updated_since": "not-a-date"},
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_updated_since_absent_returns_all(
    auth_client, container, research_type,
):
    """Без параметра — полный Pull."""
    Sample.objects.create(
        sample_number="S-1",
        research_type=research_type,
        container=container,
    )
    Sample.objects.create(
        sample_number="S-2",
        research_type=research_type,
        container=container,
    )
    resp = auth_client.get("/api/v1/samples/")
    assert resp.status_code == 200
    assert resp.data["count"] == 2