"""
Тесты API приложения inventory.

Покрывают:
- CRUD сессий, сканов, расхождений;
- custom action `complete` (успех + повторный вызов);
- custom action `resolve` (успех, повторный вызов, без resolution);
- фильтры (status, session_id, issue_type, resolved).
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.inventory.models import InventoryIssue, InventoryScan, InventorySession
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


# ============================================================
# Фикстуры
# ============================================================
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
def sample(db, container):
    return Sample.objects.create(
        sample_number="INV-001", research_type="Шлифы", container=container,
    )


@pytest.fixture
def session(db):
    return InventorySession.objects.create(session_name="Инвентаризация 1")


# ============================================================
# Аутентификация
# ============================================================
def test_sessions_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/inventory-sessions/")
    assert response.status_code in (401, 403)


# ============================================================
# InventorySession — CRUD
# ============================================================
def test_session_create_sets_started_by(auth_client, db):
    response = auth_client.post(
        "/api/v1/inventory-sessions/",
        {"session_name": "Новая сессия"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["session_name"] == "Новая сессия"
    assert response.data["status"] == "ACTIVE"
    assert response.data["started_by"] is not None


def test_session_list_filter_by_status(auth_client, session):
    InventorySession.objects.create(
        session_name="Завершённая",
        status=InventorySession.STATUS_COMPLETED,
    )
    response = auth_client.get("/api/v1/inventory-sessions/?status=ACTIVE")
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_session_retrieve(auth_client, session):
    response = auth_client.get(
        f"/api/v1/inventory-sessions/{session.pk}/"
    )
    assert response.status_code == 200
    assert response.data["session_name"] == "Инвентаризация 1"


def test_session_update(auth_client, session):
    response = auth_client.patch(
        f"/api/v1/inventory-sessions/{session.pk}/",
        {"session_name": "Обновлённая"},
        format="json",
    )
    assert response.status_code == 200


def test_session_delete(auth_client, session):
    response = auth_client.delete(
        f"/api/v1/inventory-sessions/{session.pk}/"
    )
    assert response.status_code == 204


# ============================================================
# Custom action: complete
# ============================================================
def test_session_complete_success(auth_client, session):
    response = auth_client.post(
        f"/api/v1/inventory-sessions/{session.pk}/complete/",
        format="json",
    )
    assert response.status_code == 200
    session.refresh_from_db()
    assert session.status == "COMPLETED"
    assert session.completed_at is not None


def test_session_complete_twice_raises(auth_client, session):
    auth_client.post(
        f"/api/v1/inventory-sessions/{session.pk}/complete/",
        format="json",
    )
    response = auth_client.post(
        f"/api/v1/inventory-sessions/{session.pk}/complete/",
        format="json",
    )
    assert response.status_code == 400


# ============================================================
# InventoryScan
# ============================================================
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
    assert response.data["container_number"] == "T-INV-001"


def test_scan_list_filter_by_session(auth_client, session, sample):
    other_session = InventorySession.objects.create(session_name="Сессия 2")
    InventoryScan.objects.create(session=session, sample=sample)
    InventoryScan.objects.create(session=other_session, sample=sample)

    response = auth_client.get(
        f"/api/v1/inventory-scans/?session_id={session.pk}"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_scan_list_filter_by_is_expected(auth_client, session, sample):
    InventoryScan.objects.create(session=session, sample=sample, is_expected=True)
    InventoryScan.objects.create(session=session, sample=sample, is_expected=False)

    response = auth_client.get(
        "/api/v1/inventory-scans/?is_expected=false"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# InventoryIssue — CRUD
# ============================================================
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
    assert response.data["issue_type"] == "CONTAINER_MISSING"
    assert response.data["container_number"] == "T-INV-001"


def test_issue_list_filter_by_type(auth_client, session, container):
    InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_EXTRA,
        container=container,
    )
    response = auth_client.get(
        "/api/v1/inventory-issues/?issue_type=CONTAINER_MISSING"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_issue_list_filter_resolved(auth_client, session, container, db):
    user = User.objects.create_user(username="resolver", password="x")
    issue1 = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    issue2 = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_EXTRA,
        container=container,
    )
    issue2.resolution = "ok"
    issue2.resolved_at = issue2.created_at
    issue2.resolved_by = user
    issue2.save()

    response = auth_client.get("/api/v1/inventory-issues/?resolved=false")
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Custom action: resolve
# ============================================================
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
    assert issue.resolved_by is not None


def test_issue_resolve_without_text_raises(auth_client, session, container):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    response = auth_client.post(
        f"/api/v1/inventory-issues/{issue.pk}/resolve/",
        {},
        format="json",
    )
    assert response.status_code == 400


def test_issue_resolve_twice_raises(auth_client, session, container):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    auth_client.post(
        f"/api/v1/inventory-issues/{issue.pk}/resolve/",
        {"resolution": "ok"},
        format="json",
    )
    response = auth_client.post(
        f"/api/v1/inventory-issues/{issue.pk}/resolve/",
        {"resolution": "again"},
        format="json",
    )
    assert response.status_code == 400