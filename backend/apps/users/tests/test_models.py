"""
Тесты моделей приложения users.

Покрывают:
- уникальность Role.name;
- OneToOne-связь UserProfile ↔ User;
- каскадное удаление профиля при удалении User;
- JSONB-поля AuditLog;
- поведение AuditLog.user при удалении User (SET_NULL);
- сортировку AuditLog по created_at DESC.
"""

import pytest
from django.contrib.auth.models import User
from django.db import IntegrityError

from apps.users.models import AuditLog, Role, UserProfile


# ============================================================
# Фикстуры
# ============================================================
@pytest.fixture
def role_manager(db):
    """Роль 'manager'."""
    return Role.objects.create(name="manager", description="Менеджер")


@pytest.fixture
def user(db):
    """Обычный пользователь."""
    return User.objects.create_user(username="test_user", password="test123")


# ============================================================
# Role
# ============================================================
def test_role_create_returns_str_name(db):
    """Role создаётся, __str__ возвращает name."""
    role = Role.objects.create(name="admin")
    assert str(role) == "admin"


def test_role_name_unique_raises(db):
    """Одинаковое имя роли — ошибка."""
    Role.objects.create(name="admin")
    with pytest.raises(IntegrityError):
        Role.objects.create(name="admin")


def test_role_ordering_by_name(db):
    """Роли сортируются по name."""
    Role.objects.create(name="worker")
    Role.objects.create(name="admin")
    Role.objects.create(name="manager")
    names = list(Role.objects.values_list("name", flat=True))
    assert names == ["admin", "manager", "worker"]


# ============================================================
# UserProfile
# ============================================================
def test_user_profile_created_with_role(db, user, role_manager):
    """Профиль создаётся с ролью."""
    profile = UserProfile.objects.create(
        user=user,
        role=role_manager,
        full_name="Иван Иванов",
    )
    assert profile.pk is not None
    assert profile.role.name == "manager"
    assert profile.full_name == "Иван Иванов"


def test_user_profile_one_to_one_raises(db, user):
    """Два профиля на одного пользователя — ошибка."""
    UserProfile.objects.create(user=user)
    with pytest.raises(IntegrityError):
        UserProfile.objects.create(user=user)


def test_user_profile_role_null_allowed(db, user):
    """Профиль без роли — допустимо."""
    profile = UserProfile.objects.create(user=user)
    assert profile.role is None


def test_user_delete_cascades_to_profile(db, user):
    """Удаление User каскадно удаляет профиль."""
    profile = UserProfile.objects.create(user=user)
    profile_pk = profile.pk
    user.delete()
    assert UserProfile.objects.filter(pk=profile_pk).count() == 0


def test_user_profile_str_with_role(db, user, role_manager):
    """__str__ профиля содержит username и роль."""
    profile = UserProfile.objects.create(user=user, role=role_manager)
    assert "test_user" in str(profile)
    assert "manager" in str(profile)


def test_user_profile_str_without_role(db, user):
    """__str__ профиля без роли содержит 'без роли'."""
    profile = UserProfile.objects.create(user=user)
    assert "без роли" in str(profile)


# ============================================================
# AuditLog
# ============================================================
def test_audit_log_create_with_json_fields(db, user):
    """AuditLog создаётся с JSONB-полями."""
    log = AuditLog.objects.create(
        user=user,
        action="MOVE",
        entity_type="Pallet",
        entity_id=42,
        old_value={"location": "A-01"},
        new_value={"location": "A-02"},
    )
    assert log.pk is not None
    assert log.old_value["location"] == "A-01"
    assert log.new_value["location"] == "A-02"


def test_audit_log_user_can_be_null(db):
    """Системная запись без пользователя — допустимо."""
    log = AuditLog.objects.create(
        action="SYSTEM_CHECK",
        entity_type="System",
    )
    assert log.user is None


def test_audit_log_user_delete_sets_null(db, user):
    """Удаление User не удаляет AuditLog, а обнуляет user."""
    log = AuditLog.objects.create(
        user=user,
        action="TEST",
        entity_type="Test",
        entity_id=1,
    )
    user.delete()
    log.refresh_from_db()
    assert log.user is None


def test_audit_log_ordering_desc_by_created(db, user):
    """Свежие записи аудита идут первыми."""
    log1 = AuditLog.objects.create(
        user=user, action="A", entity_type="X", entity_id=1,
    )
    log2 = AuditLog.objects.create(
        user=user, action="B", entity_type="X", entity_id=2,
    )
    logs = list(AuditLog.objects.all())
    assert logs[0] == log2
    assert logs[1] == log1


def test_audit_log_str_contains_action_and_entity(db, user):
    """__str__ содержит действие и тип сущности."""
    log = AuditLog.objects.create(
        user=user,
        action="SCAN",
        entity_type="Container",
        entity_id=7,
    )
    text = str(log)
    assert "SCAN" in text
    assert "Container" in text
    assert "7" in text