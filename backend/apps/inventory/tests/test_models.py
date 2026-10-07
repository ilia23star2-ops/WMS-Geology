"""
Тесты моделей приложения inventory (v2).

Покрывают:
- InventorySession: статусы, ordering, started_by;
- InventoryScan: raw_barcode, sample может быть NULL;
- InventoryIssue: типы, разрешение, связь с сессией.
"""

import pytest
from django.contrib.auth.models import User

from apps.inventory.models import InventoryIssue, InventoryScan, InventorySession
from apps.samples.models import Sample
from apps.storage.models import Container, ContainerType


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def user(db):
    return User.objects.create_user(username="inv_user", password="x")


@pytest.fixture
def session(db, user):
    return InventorySession.objects.create(
        session_name="Инвентаризация 2026-Q1",
        started_by=user,
    )


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-INV-001",
        container_type=container_type,
    )


@pytest.fixture
def sample(db, container):
    return Sample.objects.create(
        sample_number="INV-001",
        research_type="Шлифы",
        container=container,
    )


# ============================================================
# InventorySession
# ============================================================
def test_session_default_status_active(db):
    s = InventorySession.objects.create(session_name="Тест")
    assert s.status == "ACTIVE"


def test_session_started_by_user(db, user):
    s = InventorySession.objects.create(
        session_name="Инвентаризация", started_by=user,
    )
    assert s.started_by == user


def test_session_started_by_null_allowed(db):
    s = InventorySession.objects.create(session_name="Auto-session")
    assert s.started_by is None


def test_session_ordering_desc_by_started(db):
    s1 = InventorySession.objects.create(session_name="Сессия 1")
    s2 = InventorySession.objects.create(session_name="Сессия 2")
    sessions = list(InventorySession.objects.all())
    assert sessions[0] == s2
    assert sessions[1] == s1


def test_session_str_contains_name_and_status(db, session):
    text = str(session)
    assert "Инвентаризация 2026-Q1" in text
    assert "Активна" in text


def test_session_completed_at_null_by_default(db):
    s = InventorySession.objects.create(session_name="X")
    assert s.completed_at is None


# ============================================================
# InventoryScan
# ============================================================
def test_scan_create_full(db, session, sample):
    scan = InventoryScan.objects.create(
        session=session,
        sample=sample,
        scanned_container=sample.container,
        scanned_qr_code="WMSG:SAMPLE:1",
        is_expected=True,
    )
    assert scan.pk is not None
    assert scan.is_expected is True
    assert scan.raw_barcode == ""


def test_scan_without_sample_allowed(db, session):
    scan = InventoryScan.objects.create(
        session=session,
        scanned_qr_code="UNKNOWN:QR:ABC",
        note="Неизвестная тара",
    )
    assert scan.sample is None


def test_scan_raw_barcode_saved(db, session, container):
    """v2: сохраняем «сырое» содержимое штрих-кода."""
    scan = InventoryScan.objects.create(
        session=session,
        scanned_container=container,
        raw_barcode="4600123456789",
    )
    scan.refresh_from_db()
    assert scan.raw_barcode == "4600123456789"


def test_scan_sample_delete_sets_null(db, session, sample):
    scan = InventoryScan.objects.create(session=session, sample=sample)
    Sample.objects.filter(pk=sample.pk).delete()
    scan.refresh_from_db()
    assert scan.sample is None


def test_scan_session_delete_cascades(db, session, sample):
    InventoryScan.objects.create(session=session, sample=sample)
    InventoryScan.objects.create(session=session, sample=sample)
    session.delete()
    assert InventoryScan.objects.filter(session_id=session.pk).count() == 0


def test_scan_ordering_desc_by_scanned_at(db, session, sample):
    s1 = InventoryScan.objects.create(session=session, sample=sample, scanned_qr_code="1")
    s2 = InventoryScan.objects.create(session=session, sample=sample, scanned_qr_code="2")
    scans = list(InventoryScan.objects.all())
    assert scans[0] == s2
    assert scans[1] == s1


def test_scan_is_expected_null_by_default(db, session, sample):
    scan = InventoryScan.objects.create(session=session, sample=sample)
    assert scan.is_expected is None


def test_scan_str_contains_session_and_sample(db, session, sample):
    scan = InventoryScan.objects.create(session=session, sample=sample)
    text = str(scan)
    assert "Инвентаризация 2026-Q1" in text
    assert "INV-001" in text


# ============================================================
# InventoryIssue (NEW в v2)
# ============================================================
def test_issue_create_container_missing(db, session, container):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
        expected_value="Ячейка A-01-A-1",
        actual_value="",
    )
    assert issue.pk is not None
    assert issue.resolved_at is None


def test_issue_create_sample_status_mismatch(db, session, sample):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_SAMPLE_STATUS_MISMATCH,
        sample=sample,
        expected_value="IN_STORAGE",
        actual_value="PICKED",
    )
    assert issue.sample == sample
    assert "Статус" in issue.get_issue_type_display()


def test_issue_resolve(db, session, container, user):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    issue.resolution = "Найдена в другой ячейке"
    issue.resolved_by = user
    issue.save()
    issue.refresh_from_db()
    assert issue.resolved_by == user
    assert "другой" in issue.resolution


def test_issue_session_delete_cascades(db, session, container):
    InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    session.delete()
    assert InventoryIssue.objects.filter(session_id=session.pk).count() == 0


def test_issue_container_delete_sets_null(db, session, container):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    container.delete()
    issue.refresh_from_db()
    assert issue.container is None


def test_issue_ordering_desc_by_created(db, session, container):
    i1 = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    i2 = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_EXTRA,
        container=container,
    )
    issues = list(InventoryIssue.objects.all())
    assert issues[0] == i2
    assert issues[1] == i1


def test_issue_str_contains_session_and_type(db, session, container):
    issue = InventoryIssue.objects.create(
        session=session,
        issue_type=InventoryIssue.ISSUE_CONTAINER_MISSING,
        container=container,
    )
    text = str(issue)
    assert "Инвентаризация" in text
    assert "Тара отсутствует" in text