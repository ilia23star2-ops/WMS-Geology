"""Тесты dispose/restore тары (c-2.x-lifecycle-1, решение 1.109)."""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

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
def site(db):
    return Site.objects.create(code="TST", name="Т")


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Ш")


@pytest.fixture
def disposable_type(db):
    return ContainerType.objects.create(name="Коробка", is_disposable=True)


@pytest.fixture
def reusable_type(db):
    return ContainerType.objects.create(name="Ящик", is_disposable=False)


@pytest.fixture
def make_container(db, site):
    def _make(ctype, status="ACTIVE"):
        return Container.objects.create(
            container_type=ctype, status=status,
        )
    return _make


@pytest.fixture
def make_sample(db, site, research_type):
    def _make(container, number):
        return Sample.objects.create(
            sample_number=number,
            research_type=research_type,
            site=site,
            container=container,
            status=Sample.STATUS_IN_STORAGE,
        )
    return _make


@pytest.mark.django_db
class TestDisposeLastSample:
    def test_disposable_container_goes_disposed(
        self, api_client, disposable_type, make_container, make_sample,
    ):
        c = make_container(disposable_type)
        s = make_sample(c, "TST-001")

        r = api_client.post(f"/api/v1/samples/{s.id}/dispose/")
        assert r.status_code == 200

        c.refresh_from_db()
        assert c.status == Container.STATUS_DISPOSED

    def test_reusable_container_goes_pending_filling(
        self, api_client, reusable_type, make_container, make_sample,
    ):
        c = make_container(reusable_type)
        s = make_sample(c, "TST-002")

        r = api_client.post(f"/api/v1/samples/{s.id}/dispose/")
        assert r.status_code == 200

        c.refresh_from_db()
        assert c.status == Container.STATUS_PENDING_FILLING

    def test_non_last_sample_does_not_change_container(
        self, api_client, disposable_type, make_container, make_sample,
    ):
        c = make_container(disposable_type)
        s1 = make_sample(c, "TST-003")
        s2 = make_sample(c, "TST-004")

        # dispose 1 из 2 — тара не должна меняться.
        r = api_client.post(f"/api/v1/samples/{s1.id}/dispose/")
        assert r.status_code == 200

        c.refresh_from_db()
        assert c.status == Container.STATUS_ACTIVE

        # dispose 2 из 2 — тара DISPOSED.
        r = api_client.post(f"/api/v1/samples/{s2.id}/dispose/")
        assert r.status_code == 200
        c.refresh_from_db()
        assert c.status == Container.STATUS_DISPOSED


@pytest.mark.django_db
class TestRestoreSample:
    def test_restore_returns_container_active_with_place(
        self, api_client, disposable_type, make_container, make_sample, site,
    ):
        from apps.storage.models import Cell, Pallet, Rack, Room, Section, Tier
        room = Room.objects.create(name="Ком1")
        rack = Rack.objects.create(room=room, code="A")
        section = Section.objects.create(rack=rack, code="S1")
        tier = Tier.objects.create(section=section, code="A")
        cell = Cell.objects.create(
            tier=tier, code="1", full_address="Ком1/A/S1/A/1",
        )
        pallet = Pallet.objects.create(cell=cell)

        c = make_container(disposable_type)
        c.pallet = pallet
        c.save()
        s = make_sample(c, "TST-010")

        api_client.post(f"/api/v1/samples/{s.id}/dispose/")
        c.refresh_from_db()
        assert c.status == Container.STATUS_DISPOSED

        r = api_client.post(f"/api/v1/samples/{s.id}/restore/")
        assert r.status_code == 200

        c.refresh_from_db()
        assert c.status == Container.STATUS_ACTIVE

    def test_restore_without_place_goes_pending_placement(
        self, api_client, disposable_type, make_container, make_sample,
    ):
        c = make_container(disposable_type)
        s = make_sample(c, "TST-011")

        api_client.post(f"/api/v1/samples/{s.id}/dispose/")
        api_client.post(f"/api/v1/samples/{s.id}/restore/")

        c.refresh_from_db()
        assert c.status == Container.STATUS_PENDING_PLACEMENT


@pytest.mark.django_db
class TestContainerTypeIsDisposable:
    def test_default_false(self, db):
        ct = ContainerType.objects.create(name="Что-то")
        assert ct.is_disposable is False

    def test_explicit_true(self, db):
        ct = ContainerType.objects.create(name="Коробка", is_disposable=True)
        assert ct.is_disposable is True
