"""
Тесты API приложения inventory.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.inventory.models import InventoryIssue, InventoryScan, InventorySession
from apps.samples.catalogs import ResearchType
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="inv_api", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-INV-001", container_type=container_type,
    )


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def sample(db, container, research_type):
    return Sample.objects.create(
        sample_number="INV-001",
        research_type=research_type,
        container=container,
    )


@pytest.fixture
def session(db):
    return InventorySession.objects.create(session_name="Инвентаризация 1")


def test_sessions_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/inventory-sessions/")
    assert response.status_code in (401, 403)


def test_session_create_sets_started_by(auth_client, db):
    response = auth_client.post(
        "/api/v1/inventory-sessions/",
        {"session_name": "Новая сессия"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["started_by"] is not None


def test_session_complete_success(auth_client, session):
    response = auth_client.post(
        f"/api/v1/inventory-sessions/{session.pk}/complete/", format="json",
    )
    assert response.status_code == 200
    session.refresh_from_db()
    assert session.status == "COMPLETED"


def test_session_complete_twice_raises(auth_client, session):
    auth_client.post(
        f"/api/v1/inventory-sessions/{session.pk}/complete/", format="json",
    )
    response = auth_client.post(
        f"/api/v1/inventory-sessions/{session.pk}/complete/", format="json",
    )
    assert response.status_code == 400


def test_scan_create_with_raw_barcode(auth_client, session, container):
    response = auth_client.post(
        "/api/v1/inventory-scans/",
        {
            "session": session.pk,
            "scanned_container": container.pk,
            "raw_barcode": "4600123456789",
        },
        format="json",
    )
    assert response.status_code == 201
    assert response.data["raw_barcode"] == "4600123456789"


def test_scan_list_filter_by_session(auth_client, session, sample):
    other = InventorySession.objects.create(session_name="Сессия 2")
    InventoryScan.objects.create(session=session, sample=sample)
    InventoryScan.objects.create(session=other, sample=sample)

    response = auth_client.get(
        f"/api/v1/inventory-scans/?session_id={session.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_issue_create(auth_client, session, container):
    response = auth_client.post(
        "/api/v1/inventory-issues/",
        {
            "session": session.pk,
            "issue_type": "CONTAINER_MISSING",
            "container": container.pk,
            "expected_value": "Ячейка A-01-A-1",
        },
        format="json",
    )
    assert response.status_code == 201


def test_issue_resolve_success(auth_client, session, container):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    response = auth_client.post(
        f"/api/v1/inventory-issues/{issue.pk}/resolve/",
        {"resolution": "Найдена в ячейке B-02"},
        format="json",
    )
    assert response.status_code == 200
    issue.refresh_from_db()
    assert issue.resolved_at is not None


def test_issue_resolve_without_text_raises(auth_client, session, container):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    response = auth_client.post(
        f"/api/v1/inventory-issues/{issue.pk}/resolve/",
        {}, format="json",
    )
    assert response.status_code == 400