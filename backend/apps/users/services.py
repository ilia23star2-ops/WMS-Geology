"""
Сервисы приложения users.

- `log_audit(...)` — запись в AuditLog.
"""
from typing import Any

from .models import AuditLog


def log_audit(
    *,
    user,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    old_value: dict[str, Any] | None = None,
    new_value: dict[str, Any] | None = None,
) -> AuditLog:
    """
    Записать событие в журнал аудита.

    Анонимный пользователь (или None) → `user = NULL`
    (системное действие). Возвращает созданную запись.
    """
    return AuditLog.objects.create(
        user=user if (user and user.is_authenticated) else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
    )