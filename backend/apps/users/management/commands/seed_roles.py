"""
Management-команда: создание базовых ролей проекта.

Идемпотентна: повторный запуск не создаёт дубликатов,
только обновляет описания, если они изменились.

Использование:
    python manage.py seed_roles
"""

from django.core.management.base import BaseCommand

from apps.users.models import Role

DEFAULT_ROLES = [
    {
        "name": "admin",
        "description": "Администратор: управление пользователями, топологией, БД.",
    },
    {
        "name": "manager",
        "description": "Менеджер: создание наряд-заказов, аналитика, отчёты.",
    },
    {
        "name": "worker",
        "description": "Рабочий (кладовщик): приёмка, выдача, перемещения, инвентаризация.",
    },
]


class Command(BaseCommand):
    help = "Создаёт базовые роли проекта (admin, manager, worker)."

    def handle(self, *args, **options) -> None:
        created = 0
        updated = 0

        for role_data in DEFAULT_ROLES:
            role, was_created = Role.objects.update_or_create(
                name=role_data["name"],
                defaults={"description": role_data["description"]},
            )
            if was_created:
                created += 1
                self.stdout.write(self.style.SUCCESS(f"  + создана роль: {role.name}"))
            else:
                updated += 1
                self.stdout.write(f"  = роль уже есть: {role.name}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово. Создано: {created}, уже существовало: {updated}."
            )
        )