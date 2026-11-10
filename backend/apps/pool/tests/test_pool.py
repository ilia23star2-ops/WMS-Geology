import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from apps.pool.models import Pool, PoolItem
from apps.storage.models import Container, ContainerType
from apps.samples.models import Sample, ResearchType

User = get_user_model()


@pytest.fixture
def user(db):
    return User.objects.create_user(username="testpooluser", password="123")


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container(db):
    ctype = ContainerType.objects.create(name="Box")
    return Container.objects.create(container_type=ctype, status=Container.STATUS_ACTIVE)


@pytest.fixture
def sample(db):
    rt = ResearchType.objects.create(code="TST", name="Test")
    ctype = ContainerType.objects.create(name="Box2")
    c = Container.objects.create(container_type=ctype, status=Container.STATUS_ACTIVE)
    return Sample.objects.create(sample_number="S1", research_type=rt, container=c)


@pytest.mark.django_db
class TestPoolAPI:
    def test_pool_add_container(self, api_client, container):
        """Добавление тары в пул."""
        url = reverse("pool-add-items")
        response = api_client.post(url, {"container_ids": [container.id]}, format="json")
        assert response.status_code == 200
        assert response.data["added"] == 1
        assert PoolItem.objects.filter(container=container).exists()

    def test_pool_add_sample(self, api_client, sample):
        """Добавление пробы в пул."""
        url = reverse("pool-add-items")
        response = api_client.post(url, {"sample_ids": [sample.id]}, format="json")
        assert response.status_code == 200
        assert response.data["added"] == 1
        assert PoolItem.objects.filter(sample=sample).exists()

    def test_pool_clear(self, api_client, user, container):
        """Очистка пула."""
        pool, _ = Pool.objects.get_or_create(user=user)
        PoolItem.objects.create(pool=pool, container=container)

        url = reverse("pool-clear")
        response = api_client.post(url)
        assert response.status_code == 200
        assert PoolItem.objects.filter(pool=pool).count() == 0