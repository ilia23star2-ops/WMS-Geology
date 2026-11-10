"""Тесты OUTBOUND-рейсов (c-2.x-shipments-1)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.picking.models import Shipment, ShipmentContainerItem
from apps.samples.catalogs import Site, ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType

User = get_user_model()


@pytest.fixture
def api_client(db):
    user = User.objects.create_user(username="testuser", password="p")

    user.is_superuser = True

    user.save()
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container_factory(db, container_type):
    def _make(status="ACTIVE"):
        return Container.objects.create(
            container_type=container_type, status=status,
        )
    return _make


@pytest.fixture
def sample_factory(db, container_type):
    site = Site.objects.get_or_create(code="TST", defaults={"name": "Т"})[0]
    rt = ResearchType.objects.get_or_create(code="ШЛ", defaults={"name": "Ш"})[0]

    def _make(container, number="TST-001", status="IN_STORAGE"):
        return Sample.objects.create(
            sample_number=number,
            research_type=rt,
            site=site,
            container=container,
            status=status,
        )
    return _make


class TestShipmentModel:
    def test_default_status_is_draft(self, db):
        sh = Shipment.objects.create(shipment_number="ОТ-1")
        assert sh.status == Shipment.STATUS_DRAFT
        assert sh.sent_at is None

    def test_name_field_optional(self, db):
        sh = Shipment.objects.create(shipment_number="ОТ-2", name="Ноябрь")
        assert sh.name == "Ноябрь"

    def test_containers_count_outbound(self, db, container_factory):
        sh = Shipment.objects.create(
            shipment_number="ОТ-3", direction=Shipment.DIRECTION_OUTBOUND,
        )
        c1 = container_factory()
        c2 = container_factory()
        ShipmentContainerItem.objects.create(shipment=sh, container=c1)
        ShipmentContainerItem.objects.create(shipment=sh, container=c2)
        assert sh.containers_count == 2


@pytest.mark.django_db
class TestAddContainers:
    def test_add_containers_ok(self, api_client, container_factory):
        sh = Shipment.objects.create(
            shipment_number="ОТ-10", direction=Shipment.DIRECTION_OUTBOUND,
        )
        c1 = container_factory()
        c2 = container_factory()

        r = api_client.post(
            f"/api/v1/shipments/{sh.id}/add-containers/",
            {"container_ids": [c1.id, c2.id]},
            format="json",
        )
        assert r.status_code == 200
        assert r.json()["added_count"] == 2
        assert ShipmentContainerItem.objects.filter(shipment=sh).count() == 2

    def test_add_containers_inbound_forbidden(
        self, api_client, container_factory,
    ):
        sh = Shipment.objects.create(
            shipment_number="ОТ-11", direction=Shipment.DIRECTION_INBOUND,
        )
        c = container_factory()
        r = api_client.post(
            f"/api/v1/shipments/{sh.id}/add-containers/",
            {"container_ids": [c.id]},
            format="json",
        )
        assert r.status_code == 400

    def test_add_containers_missing_id(self, api_client, container_factory):
        sh = Shipment.objects.create(
            shipment_number="ОТ-12", direction=Shipment.DIRECTION_OUTBOUND,
        )
        r = api_client.post(
            f"/api/v1/shipments/{sh.id}/add-containers/",
            {"container_ids": [99999]},
            format="json",
        )
        assert r.status_code == 404


@pytest.mark.django_db
class TestRemoveContainer:
    def test_remove_ok(self, api_client, container_factory):
        sh = Shipment.objects.create(
            shipment_number="ОТ-20", direction=Shipment.DIRECTION_OUTBOUND,
        )
        c = container_factory()
        ShipmentContainerItem.objects.create(shipment=sh, container=c)

        r = api_client.post(
            f"/api/v1/shipments/{sh.id}/remove-container/",
            {"container_id": c.id},
            format="json",
        )
        assert r.status_code == 200
        assert r.json()["removed"] is True
        assert ShipmentContainerItem.objects.filter(shipment=sh).count() == 0


@pytest.mark.django_db
class TestSend:
    def test_send_sets_status_and_container_in_transit(
        self, api_client, container_factory, sample_factory,
    ):
        sh = Shipment.objects.create(
            shipment_number="ОТ-30", direction=Shipment.DIRECTION_OUTBOUND,
        )
        c = container_factory(status="ACTIVE")
        s = sample_factory(container=c, status="IN_STORAGE")
        ShipmentContainerItem.objects.create(shipment=sh, container=c)

        r = api_client.post(f"/api/v1/shipments/{sh.id}/send/")
        assert r.status_code == 200

        sh.refresh_from_db()
        c.refresh_from_db()
        s.refresh_from_db()
        assert sh.status == Shipment.STATUS_SENT
        assert sh.sent_at is not None
        assert c.status == "IN_TRANSIT"
        assert s.status == "IN_TRANSIT"

    def test_send_empty_shipment_400(self, api_client):
        sh = Shipment.objects.create(
            shipment_number="ОТ-31", direction=Shipment.DIRECTION_OUTBOUND,
        )
        r = api_client.post(f"/api/v1/shipments/{sh.id}/send/")
        assert r.status_code == 400

    def test_send_already_sent_400(self, api_client, container_factory):
        sh = Shipment.objects.create(
            shipment_number="ОТ-32",
            direction=Shipment.DIRECTION_OUTBOUND,
            status=Shipment.STATUS_SENT,
        )
        r = api_client.post(f"/api/v1/shipments/{sh.id}/send/")
        assert r.status_code == 400

@pytest.mark.django_db
class TestCreateShipmentAutoNumber:
    def test_create_auto_number_outbound(self, api_client, db):
        r = api_client.post(
            "/api/v1/shipments/",
            {"direction": "OUTBOUND"},
            format="json",
        )
        assert r.status_code == 201
        body = r.json()
        assert body["shipment_number"].startswith("ОТ-")
        assert body["status"] == "DRAFT"

    def test_create_auto_number_inbound(self, api_client, db):
        r = api_client.post(
            "/api/v1/shipments/",
            {"direction": "INBOUND"},
            format="json",
        )
        assert r.status_code == 201
        assert r.json()["shipment_number"].startswith("ПР-")

    def test_create_with_explicit_number(self, api_client, db):
        r = api_client.post(
            "/api/v1/shipments/",
            {"direction": "OUTBOUND", "shipment_number": "ОТ-9999-001"},
            format="json",
        )
        assert r.status_code == 201
        assert r.json()["shipment_number"] == "ОТ-9999-001"
