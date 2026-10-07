"""
Тесты моделей приложения inventory.

Покрывают:
- создание сессии со статусом ACTIVE по умолчанию;
- привязку started_by к User;
- каскадное удаление сканов при удалении сессии;
- поведение sample при удалении пробы (SET_NULL);
- возможность скана без sample (неизвестный объект);
- ordering по -started_at / -scanned_at;
- __str__ сессии и скана.
"""

import pytest
from django.contrib.auth.models import User

from apps.inventory.models import InventoryScan, InventorySession
from apps.samples.models import Sample
from apps.storage.models import Container


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def user(db):
    """Пользователь."""
    return User.objects.create_user(username="inv_user", password="x")


@pytest.fixture
def session(db, user):
    """Активная сессия инвентаризации."""
    return InventorySession.objects.create(
        session_name="Инвентаризация 2026-Q1",
        started_by=user,
    )


@pytest.fixture
def container(db):
    """Тара."""
    return Container.objects.create(container_number="T-INV-001")


@pytest.fixture
def sample(db, container):
    """Проба в таре."""
    return Sample.objects.create(
        sample_number="INV-001",
        research_type="Шлифы",
        container=container,
    )


# ============================================================
# InventorySession
# ============================================================
def test_session_default_status_active(db):
    """По умолчанию статус — ACTIVE."""
    s = InventorySession.objects.create(session_name="Тест")
    assert s.status == "ACTIVE"


def test_session_started_by_user(db, user):
    """started_by сохраняется."""
    s = InventorySession.objects.create(
        session_name="Инвентаризация",
        started_by=user,
    )
    assert s.started_by == user


def test_session_started_by_null_allowed(db):
    """started_by может быть NULL (системная сессия)."""
    s = InventorySession.objects.create(session_name="Auto-session")
    assert s.started_by is None


def test_session_ordering_desc_by_started(db):
    """Свежие сессии — первыми."""
    s1 = InventorySession.objects.create(session_name="Сессия 1")
    s2 = InventorySession.objects.create(session_name="Сессия 2")
    sessions = list(InventorySession.objects.all())
    assert sessions[0] == s2
    assert sessions[1] == s1


def test_session_str_contains_name_and_status(db, session):
    """__str__ содержит имя и человекочитаемый статус."""
    text = str(session)
    assert "Инвентаризация 2026-Q1" in text
    assert "Активна" in text


def test_session_completed_at_null_by_default(db):
    """completed_at по умолчанию NULL."""
    s = InventorySession.objects.create(session_name="X")
    assert s.completed_at is None


# ============================================================
# InventoryScan
# ============================================================
def test_scan_create_full(db, session, sample):
    """Скан с полными данными создаётся."""
    scan = InventoryScan.objects.create(
        session=session,
        sample=sample,
        scanned_container=sample.container,
        scanned_qr_code="WMSG:SAMPLE:1",
        is_expected=True,
    )
    assert scan.pk is not None
    assert scan.is_expected is True
    assert scan.note == ""


def test_scan_without_sample_allowed(db, session):
    """Скан без sample (неизвестный объект) — допустимо."""
    scan = InventoryScan.objects.create(
        session=session,
        scanned_qr_code="UNKNOWN:QR:ABC",
        note="Неизвестная тара",
    )
    assert scan.sample is None
    assert scan.scanned_qr_code == "UNKNOWN:QR:ABC"


def test_scan_sample_delete_sets_null(db, session, sample):
    """Удаление пробы обнуляет sample в сканах, но скан остаётся."""
    scan = InventoryScan.objects.create(
        session=session,
        sample=sample,
        scanned_qr_code="X",
    )
    sample_pk = sample.pk
    # Проба привязана к таре через PROTECT — удаляем через Sample напрямую,
    # но связь с тарой нам не мешает, если тара не удаляется.
    Sample.objects.filter(pk=sample_pk).delete()
    scan.refresh_from_db()
    assert scan.sample is None


def test_scan_session_delete_cascades(db, session, sample):
    """Удаление сессии каскадно удаляет её сканы."""
    InventoryScan.objects.create(session=session, sample=sample)
    InventoryScan.objects.create(session=session, sample=sample)
    session.delete()
    assert InventoryScan.objects.filter(session_id=session.pk).count() == 0


def test_scan_ordering_desc_by_scanned_at(db, session, sample):
    """Свежие сканы — первыми."""
    s1 = InventoryScan.objects.create(session=session, sample=sample, scanned_qr_code="1")
    s2 = InventoryScan.objects.create(session=session, sample=sample, scanned_qr_code="2")
    scans = list(InventoryScan.objects.all())
    assert scans[0] == s2
    assert scans[1] == s1


def test_scan_is_expected_null_by_default(db, session, sample):
    """is_expected по умолчанию NULL (ещё не рассчитано)."""
    scan = InventoryScan.objects.create(session=session, sample=sample)
    assert scan.is_expected is None


def test_scan_str_contains_session_and_sample(db, session, sample):
    """__str__ содержит имя сессии и номер пробы."""
    scan = InventoryScan.objects.create(session=session, sample=sample)
    text = str(scan)
    assert "Инвентаризация 2026-Q1" in text
    assert "INV-001" in text