"""Тесты портала лабораторий (c-2.x-lab-portal-1)."""

import pytest
from django.contrib.auth import get_user_model
from django.utils import timezone
from rest_framework.test import APIClient

from apps.picking.models import Shipment, ShipmentContainerItem
from apps.samples.catalogs import Laboratory, ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType
from apps.users.models import Role, UserProfile

User = get_user_model()


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def lab_a(db):
    return Laboratory.objects.create(code="Л-А", name="Лаб А")


@pytest.fixture
def lab_b(db):
    return Laboratory.objects.create(code="Л-Б", name="Лаб Б")


@pytest.fixture
def admin_user(db):
    u = User.objects.create_user(username="admin", password="p")
    role, _ = Role.objects.get_or_create(name="admin")
    UserProfile.objects.create(user=u, role=role)
    return u


@pytest.fixture
def lab_user_a(db, lab_a):
    u = User.objects.create_user(username="lab_a", password="p")
    role, _ = Role.objects.get_or_create(name="lab_worker")
    UserProfile.objects.create(user=u, role=role, laboratory=lab_a)
    return u


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.fixture
def lab_client_a(lab_user_a):
    c = APIClient()
    c.force_authenticate(user=lab_user_a)
    return c


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Ящик", size_class="M")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_type=container_type,
        container_number="T-001",
        status=Container.STATUS_ACTIVE,
    )


@pytest.fixture
def shipment_with_container(db, lab_a, container):
    """OUTBOUND-рейс с тарой (для current_holder ISSUED/IN_TRANSIT)."""
    sh = Shipment.objects.create(
        shipment_number="ОТ-100",
        direction=Shipment.DIRECTION_OUTBOUND,
        laboratory=lab_a,
        status=Shipment.STATUS_SENT,
        sent_at=timezone.now(),
    )
    ShipmentContainerItem.objects.create(shipment=sh, container=container)
    return sh


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def sample(db, container, research_type):
    return Sample.objects.create(
        sample_number="TST-001",
        research_type=research_type,
        container=container,
    )


# ============================================================
# mark-received (POST)
# ============================================================
@pytest.mark.django_db
class TestMarkReceived:
    def test_admin_can_mark_any(self, admin_client, lab_a):
        sh = Shipment.objects.create(
            shipment_number="ОТ-1",
            direction="OUTBOUND",
            laboratory=lab_a,
            status=Shipment.STATUS_SENT,
        )
        r = admin_client.post(f"/api/v1/shipments/{sh.id}/mark-received/")
        assert r.status_code == 200
        sh.refresh_from_db()
        assert sh.status == Shipment.STATUS_RECEIVED
        assert sh.received_at is not None

    def test_lab_worker_can_mark_own(self, lab_client_a, lab_a):
        sh = Shipment.objects.create(
            shipment_number="ОТ-2",
            direction="OUTBOUND",
            laboratory=lab_a,
            status=Shipment.STATUS_SENT,
        )
        r = lab_client_a.post(f"/api/v1/shipments/{sh.id}/mark-received/")
        assert r.status_code == 200
        sh.refresh_from_db()
        assert sh.status == Shipment.STATUS_RECEIVED

    def test_lab_worker_cannot_mark_other(self, lab_client_a, lab_b):
        sh = Shipment.objects.create(
            shipment_number="ОТ-3",
            direction="OUTBOUND",
            laboratory=lab_b,
            status=Shipment.STATUS_SENT,
        )
        r = lab_client_a.post(f"/api/v1/shipments/{sh.id}/mark-received/")
        assert r.status_code == 403

    def test_cannot_mark_already_received(self, admin_client, lab_a):
        sh = Shipment.objects.create(
            shipment_number="ОТ-4",
            direction="OUTBOUND",
            laboratory=lab_a,
            status=Shipment.STATUS_RECEIVED,
        )
        r = admin_client.post(f"/api/v1/shipments/{sh.id}/mark-received/")
        assert r.status_code == 400


# ============================================================
# can_mark_received (поле сериализатора)
# ============================================================
@pytest.mark.django_db
class TestCanMarkReceived:
    def test_admin_sees_true(self, admin_client, lab_a):
        sh = Shipment.objects.create(
            shipment_number="ОТ-5",
            direction="OUTBOUND",
            laboratory=lab_a,
            status=Shipment.STATUS_SENT,
        )
        r = admin_client.get(f"/api/v1/shipments/{sh.id}/")
        assert r.status_code == 200
        assert r.json()["can_mark_received"] is True

    def test_lab_worker_own_sees_true(self, lab_client_a, lab_a):
        sh = Shipment.objects.create(
            shipment_number="ОТ-6",
            direction="OUTBOUND",
            laboratory=lab_a,
            status=Shipment.STATUS_SENT,
        )
        r = lab_client_a.get(f"/api/v1/shipments/{sh.id}/")
        assert r.status_code == 200
        assert r.json()["can_mark_received"] is True

    def test_lab_worker_other_sees_false(self, lab_client_a, lab_b):
        sh = Shipment.objects.create(
            shipment_number="ОТ-7",
            direction="OUTBOUND",
            laboratory=lab_b,
            status=Shipment.STATUS_SENT,
        )
        r = lab_client_a.get(f"/api/v1/shipments/{sh.id}/")
        assert r.status_code == 200
        assert r.json()["can_mark_received"] is False


# ============================================================
# Container.current_holder
# ============================================================
@pytest.mark.django_db
class TestContainerCurrentHolder:
    def test_active_holder(self, admin_client, container):
        container.status = Container.STATUS_ACTIVE
        container.save()
        r = admin_client.get(f"/api/v1/storage/containers/{container.id}/?show_disposed=true")
        assert r.status_code == 200
        assert r.json()["current_holder"] == "У нас на складе"

    def test_disposed_holder(self, admin_client, container):
        container.status = Container.STATUS_DISPOSED
        container.save()
        r = admin_client.get(f"/api/v1/storage/containers/{container.id}/?show_disposed=true")
        assert r.json()["current_holder"] == "Утилизирована"

    def test_issued_holder_with_lab(self, admin_client, container, shipment_with_container):
        container.status = Container.STATUS_ISSUED
        container.save()
        r = admin_client.get(f"/api/v1/storage/containers/{container.id}/?show_disposed=true")
        assert r.json()["current_holder"] == "У лаборатории Лаб А"

    def test_in_transit_holder_with_lab(self, admin_client, container, shipment_with_container):
        container.status = Container.STATUS_IN_TRANSIT
        container.save()
        r = admin_client.get(f"/api/v1/storage/containers/{container.id}/?show_disposed=true")
        assert r.json()["current_holder"] == "В пути к Лаб А"


# ============================================================
# Sample.current_holder
# ============================================================
@pytest.mark.django_db
class TestSampleCurrentHolder:
    def test_active_holder(self, admin_client, sample):
        r = admin_client.get(f"/api/v1/samples/{sample.id}/")
        assert r.status_code == 200
        assert r.json()["current_holder"] == "У нас на складе"

    def test_disposed_holder(self, admin_client, sample):
        sample.container.status = Container.STATUS_DISPOSED
        sample.container.save()
        r = admin_client.get(f"/api/v1/samples/{sample.id}/")
        assert r.json()["current_holder"] == "Утилизирована"

    def test_issued_holder_with_lab(self, admin_client, sample, shipment_with_container):
        sample.container.status = Container.STATUS_ISSUED
        sample.container.save()
        r = admin_client.get(f"/api/v1/samples/{sample.id}/")
        assert r.json()["current_holder"] == "У лаборатории Лаб А"