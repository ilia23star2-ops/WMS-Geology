import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.samples.models import Sample, Well
from apps.samples.catalogs import Site, ResearchType
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder

User = get_user_model()

@pytest.mark.django_db
class TestSmartInputSuggestions:
    def setup_method(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testuser", password="testpass")
        self.client.force_authenticate(user=self.user)
        
        # Создаём данные
        self.site = Site.objects.create(code="TST", name="Тест")
        self.rt = ResearchType.objects.create(code="ШЛ", name="Шлифы")
        self.wo = WorkOrder.objects.create(order_number="TST0001", order_type="CODED")
        self.ct = ContainerType.objects.create(name="Коробка")
        self.container = Container.objects.create(container_type=self.ct, status="ACTIVE")
        self.well = Well.objects.create(well_name="124")
        
        Sample.objects.create(
            sample_number="TAA-A34076-001",
            site=self.site,
            research_type=self.rt,
            current_work_order=self.wo,
            well=self.well,
            container=self.container
        )
        Sample.objects.create(
            sample_number="TAA-A34076-002",
            site=self.site,
            research_type=self.rt,
            current_work_order=self.wo,
            well=self.well,
            container=self.container
        )

    def test_suggestions_empty(self):
        response = self.client.get("/api/v1/storage/suggestions/")
        assert response.status_code == 200
        data = response.json()
        assert len(data["samples"]) == 2
        assert data["work_orders"] == ["TST0001"]

    def test_suggestions_filtered_by_site(self):
        response = self.client.get(f"/api/v1/storage/suggestions/?site={self.site.id}")
        data = response.json()
        assert len(data["samples"]) == 2

    def test_suggestions_filtered_by_wo_and_rt(self):
        response = self.client.get(
            f"/api/v1/storage/suggestions/?site={self.site.id}&work_order=TST0001&research_type=ШЛ"
        )
        data = response.json()
        assert data["samples"] == ["TAA-A34076-001", "TAA-A34076-002"]