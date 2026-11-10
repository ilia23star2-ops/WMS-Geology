import pytest
from django.urls import reverse
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample, SampleWorkOrder
from apps.storage.models import Container, ContainerType
from apps.users.models import Role, UserProfile
from apps.work_orders.models import WorkOrder

User = get_user_model()


@pytest.fixture
def api_client_manager(db):
    """Аутентифицированный клиент с ролью manager (для encrypt)."""
    role, _ = Role.objects.get_or_create(name="manager")
    user = User.objects.create_user(username="testmanager", password="123")
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": role})
    if not profile.role:
        profile.role = role
        profile.save()
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def api_client_worker(db):
    """Аутентифицированный клиент с ролью worker (должен получить 403)."""
    role, _ = Role.objects.get_or_create(name="worker")
    user = User.objects.create_user(username="testworker", password="123")
    profile, _ = UserProfile.objects.get_or_create(user=user, defaults={"role": role})
    if not profile.role:
        profile.role = role
        profile.save()
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def sample(db):
    rt = ResearchType.objects.create(code="TST", name="Test")
    site = Site.objects.create(code="S1", name="Site 1")
    old_wo = WorkOrder.objects.create(order_number="OLD-01", order_type=WorkOrder.ORDER_TYPE_CODED)
    
    ctype = ContainerType.objects.create(name="Box")
    container = Container.objects.create(container_type=ctype, status=Container.STATUS_ACTIVE)
    
    s = Sample.objects.create(
        sample_number="TST-001",
        research_type=rt,
        container=container,
        current_work_order=old_wo,
        site=site,
        status=Sample.STATUS_IN_STORAGE,
    )
    SampleWorkOrder.objects.create(sample=s, work_order=old_wo)
    return s


@pytest.mark.django_db
class TestSampleEncryptionField:
    """Тесты поля is_encrypted (1.118-a)."""
    # ... (тесты 1.118-a оставляем как есть) ...
    def test_default_is_encrypted_false(self, sample):
        assert sample.is_encrypted is False

    def test_serializer_includes_is_encrypted(self, sample, api_client_worker):
        url = reverse("sample-detail", args=[sample.id])
        response = api_client_worker.get(url)
        assert response.status_code == 200
        assert "is_encrypted" in response.data

    def test_filter_by_is_encrypted(self, sample, api_client_worker):
        url = reverse("sample-list")
        response = api_client_worker.get(url, {"is_encrypted": "false"})
        assert response.status_code == 200
        assert len(response.data["results"]) == 1


@pytest.mark.django_db
class TestEncryptAction:
    """Тесты action encrypt (1.118-b)."""

    def test_encrypt_success(self, sample, api_client_manager):
        url = reverse("sample-encrypt", args=[sample.id])
        payload = {
            "new_sample_number": "NEW-999",
            "new_work_order_coded": "NEW-WO-01",
        }
        response = api_client_manager.post(url, payload, format="json")
        assert response.status_code == 200
        
        sample.refresh_from_db()
        assert sample.is_encrypted is True
        assert sample.sample_number == "NEW-999"
        assert sample.current_work_order.order_number == "NEW-WO-01"
        
        # legacy_data
        assert sample.legacy_data["sample_number"] == "TST-001"
        assert sample.legacy_data["work_order_number"] == "OLD-01"
        
        # M:N связь
        assert SampleWorkOrder.objects.filter(sample=sample, work_order=sample.current_work_order).exists()
        assert SampleWorkOrder.objects.filter(sample=sample, work_order__order_number="OLD-01").exists()

    def test_encrypt_twice_fails(self, sample, api_client_manager):
        sample.is_encrypted = True
        sample.save()
        url = reverse("sample-encrypt", args=[sample.id])
        response = api_client_manager.post(url, {"new_sample_number": "X", "new_work_order_coded": "Y"})
        assert response.status_code == 400
        assert "уже зашифрована" in response.data["error"]

    def test_encrypt_forbidden_for_worker(self, sample, api_client_worker):
        url = reverse("sample-encrypt", args=[sample.id])
        response = api_client_worker.post(url, {"new_sample_number": "X", "new_work_order_coded": "Y"})
        assert response.status_code == 403