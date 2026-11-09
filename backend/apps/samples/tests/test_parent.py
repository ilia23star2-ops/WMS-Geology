"""Тесты parent_container_id / parent_sample_id (c-2.x-lifecycle-3)."""

import pytest
from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка", is_disposable=True)


@pytest.fixture
def site(db):
    return Site.objects.create(code="TST", name="Т")


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Ш")


@pytest.mark.django_db
class TestParentContainer:
    def test_default_null(self, container_type):
        c = Container.objects.create(container_type=container_type)
        assert c.parent_container_id is None

    def test_set_parent(self, container_type):
        parent = Container.objects.create(container_type=container_type)
        child = Container.objects.create(
            container_type=container_type, parent_container=parent,
        )
        assert child.parent_container_id == parent.id
        assert child.parent_container == parent

    def test_returned_as_reverse(self, container_type):
        parent = Container.objects.create(container_type=container_type)
        child = Container.objects.create(
            container_type=container_type, parent_container=parent,
        )
        assert list(parent.returned_as.all()) == [child]

    def test_parent_delete_sets_null(self, container_type):
        parent = Container.objects.create(container_type=container_type)
        child = Container.objects.create(
            container_type=container_type, parent_container=parent,
        )
        parent.delete()
        child.refresh_from_db()
        assert child.parent_container_id is None


@pytest.mark.django_db
class TestParentSample:
    def test_default_null(self, container_type, site, research_type):
        c = Container.objects.create(container_type=container_type)
        s = Sample.objects.create(
            sample_number="TST-001",
            research_type=research_type,
            site=site,
            container=c,
        )
        assert s.parent_sample_id is None

    def test_set_parent(self, container_type, site, research_type):
        c = Container.objects.create(container_type=container_type)
        parent = Sample.objects.create(
            sample_number="TST-001", research_type=research_type,
            site=site, container=c,
        )
        child = Sample.objects.create(
            sample_number="TST-002", research_type=research_type,
            site=site, container=c, parent_sample=parent,
        )
        assert child.parent_sample_id == parent.id
        assert list(parent.returned_as.all()) == [child]

    def test_parent_delete_sets_null(self, container_type, site, research_type):
        c = Container.objects.create(container_type=container_type)
        parent = Sample.objects.create(
            sample_number="TST-001", research_type=research_type,
            site=site, container=c,
        )
        child = Sample.objects.create(
            sample_number="TST-002", research_type=research_type,
            site=site, container=c, parent_sample=parent,
        )
        parent.delete()
        child.refresh_from_db()
        assert child.parent_sample_id is None


@pytest.mark.django_db
class TestContainerTypeIsDisposableInSerializer:
    """Фикс c-2.x-lifecycle-3a: is_disposable возвращается в API."""

    def test_api_returns_is_disposable(self, client, container_type):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.create_user(username="u", password="p")
        client.force_login(user)

        r = client.get(f"/api/v1/storage/container-types/{container_type.id}/")
        assert r.status_code == 200
        assert r.json()["is_disposable"] is True
