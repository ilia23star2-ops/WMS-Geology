"""
Тесты management-команды seed_roles.

Проверяют:
- создание трёх базовых ролей;
- идемпотентность (повторный запуск не создаёт дубликатов);
- обновление описания при изменении.
"""

from io import StringIO

import pytest
from django.core.management import call_command

from apps.users.models import Role


def test_seed_roles_creates_three_roles(db):
    """Команда создаёт admin, manager, worker."""
    call_command("seed_roles", stdout=StringIO())
    names = set(Role.objects.values_list("name", flat=True))
    assert names == {"admin", "manager", "worker"}


def test_seed_roles_idempotent(db):
    """Повторный запуск не создаёт дубликатов."""
    call_command("seed_roles", stdout=StringIO())
    call_command("seed_roles", stdout=StringIO())
    assert Role.objects.count() == 3


def test_seed_roles_updates_description(db):
    """Если описание изменилось — команда его обновляет."""
    Role.objects.create(name="admin", description="старое описание")
    call_command("seed_roles", stdout=StringIO())
    role = Role.objects.get(name="admin")
    assert "Администратор" in role.description


def test_seed_roles_output_mentions_created(db):
    """В выводе команды есть упоминание о создании."""
    out = StringIO()
    call_command("seed_roles", stdout=out)
    assert "создана" in out.getvalue() or "Создано" in out.getvalue()


def test_seed_roles_success_message(db):
    """В конце команда сообщает «Готово»."""
    out = StringIO()
    call_command("seed_roles", stdout=out)
    assert "Готово" in out.getvalue()