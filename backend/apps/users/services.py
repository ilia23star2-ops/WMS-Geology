"""
Сервисы приложения users.

- `log_audit(...)` — запись в AuditLog.
- `generate_access_token(...)` — генерация AccessToken (raw + запись).
- `hash_access_token(raw)` — sha256 hex.
- `make_access_token_qr_svg(...)` — SVG QR для AccessToken (3.x-offline-auth-b).
"""
import hashlib
import secrets
from datetime import timedelta
from typing import Any

from django.utils import timezone

from apps.labels.services.qr_service import generate_qr_svg

from .models import AccessToken, AuditLog

# TTL по purpose.
# - web_login: 15 минут (одноразовый код для входа в web).
# - offline:   14 часов (одна смена + запас, 3.x-offline-sync-b-0).
ACCESS_TOKEN_TTL = {
    AccessToken.PURPOSE_WEB_LOGIN: timedelta(minutes=15),
    AccessToken.PURPOSE_OFFLINE: timedelta(hours=14),
}


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


def hash_access_token(raw: str) -> str:
    """sha256(raw_token), hex."""
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def generate_access_token(
    *,
    user,
    purpose: str,
    created_by=None,
) -> tuple[AccessToken, str]:
    """
    Сгенерировать AccessToken.

    Возвращает `(obj, raw_token)`. `raw_token` — единственный раз,
    когда его можно увидеть. В БД — только `hash`.
    """
    if purpose not in ACCESS_TOKEN_TTL:
        raise ValueError(f"Неизвестный purpose: {purpose!r}")

    raw = secrets.token_hex(32)  # 64 hex chars
    token_hash = hash_access_token(raw)
    expires_at = timezone.now() + ACCESS_TOKEN_TTL[purpose]

    obj = AccessToken.objects.create(
        user=user,
        purpose=purpose,
        token_hash=token_hash,
        expires_at=expires_at,
        created_by=created_by,
    )
    return obj, raw


def make_access_token_qr_svg(purpose: str, raw: str) -> str:
    """
    SVG QR для AccessToken.

    Payload:
    - `web_login`  → `WMSG:CODE:<raw>`
    - `offline`    → `WMSG:OFFLINE:<raw>`

    Mobile / web читает префикс и решает, что делать с raw.
    """
    prefix = "OFFLINE" if purpose == AccessToken.PURPOSE_OFFLINE else "CODE"
    payload = f"WMSG:{prefix}:{raw}"
    return generate_qr_svg(payload, box_size=8, border=2)