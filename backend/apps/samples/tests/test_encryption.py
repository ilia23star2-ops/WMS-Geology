import pytest
from django.urls import reverse
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType
from apps.users.models import Role, UserProfile


@pytest.fixture
def api_client(db):
    """Аутентифицированный клиент с ролью worker."""
    from django.contrib.auth import get_user_model
    User = get_user_model()
    
    role, _ = Role.objects.get_or_create(name="worker")
    user = User.objects.create_user(username="testworker", password="123")
    
    profile, _ = UserProfile.objects.get_or_create(
        user=user, defaults={"role": role}
    )
    if not profile.role:
        profile.role = role
        profile.save()
    
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def sample(db):
    rt = ResearchType.objects.create(code="TST", name="Test")
    ctype = ContainerType.objects.create(name="Box")
    container = Container.objects.create(
        container_type=ctype, status=Container.STATUS_ACTIVE
    )
    return Sample.objects.create(
        sample_number="TST-001",
        research_type=rt,
        container=container,
        status=Sample.STATUS_IN_STORAGE,
    )


@pytest.mark.django_db
class TestSampleEncryptionField:
    """Тесты поля is_encrypted (1.118-a)."""

    def test_default_is_encrypted_false(self, sample):
        """По умолчанию флаг False."""
        assert sample.is_encrypted is False

    def test_serializer_includes_is_encrypted(self, sample, api_client):
        """Сериализатор отдаёт поле is_encrypted."""
        url = reverse("sample-detail", args=[sample.id])
        response = api_client.get(url)
        assert response.status_code == 200
        assert "is_encrypted" in response.data
        assert response.data["is_encrypted"] is False

    def test_filter_by_is_encrypted(self, sample, api_client):
        """Фильтр ?is_encrypted=true/false работает."""
        url = reverse("sample-list")
        
        # Должен найтись (False)
        response = api_client.get(url, {"is_encrypted": "false"})
        assert response.status_code == 200
        assert len(response.data["results"]) == 1
        
        # Не должен найтись (True)
        response = api_client.get(url, {"is_encrypted": "true"})
        assert response.status_code == 200
        assert len(response.data["results"]) == 0