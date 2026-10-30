import base64
import hashlib
import io
import json
import secrets
from datetime import timedelta

import qrcode
import qrcode.image.svg
from django.utils import timezone

from .models import AccessToken, AuditLog


def generate_access_token(user, purpose: str, created_by=None):
    """Генерирует сырой токен, сохраняет его хэш в БД и возвращает (obj, raw)."""
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_access_token(raw_token)

    ttl = (
        timedelta(hours=14)
        if purpose == AccessToken.PURPOSE_OFFLINE
        else timedelta(minutes=15)
    )
    expires_at = timezone.now() + ttl

    obj = AccessToken.objects.create(
        user=user,
        purpose=purpose,
        token_hash=token_hash,
        expires_at=expires_at,
        created_by=created_by,
    )
    return obj, raw_token


def hash_access_token(raw_token: str) -> str:
    """Хэширует сырой токен для хранения в БД."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def log_audit(
    user,
    action: str,
    entity_type: str,
    entity_id: int,
    old_value: dict | None = None,
    new_value: dict | None = None,
):
    """Пишет запись в журнал аудита.

    `old_value` восстанавливается в сигнатуре (регресс): DECISIONS 1.70
    фиксирует `old_value` + `new_value` (diff при UPDATE/DELETE).
    """
    AuditLog.objects.create(
        user=user,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        old_value=old_value,
        new_value=new_value,
    )


def _user_payload(user) -> dict:
    """Данные пользователя для встраивания в QR.

    Нужны, чтобы мобилка показывала корректное имя и роль
    даже без сети (в pending offline режиме).
    """
    role = None
    full_name = ""
    if hasattr(user, "profile"):
        if user.profile.role:
            role = user.profile.role.name
        full_name = user.profile.full_name
    return {
        "id": user.pk,
        "username": user.username,
        "full_name": full_name,
        "role": role,
    }


def make_access_token_qr_svg(purpose: str, raw_token: str, expires_at, user) -> str:
    """
    Генерирует SVG QR-код.

    Внутри — base64(JSON) с токеном, назначением, датой истечения
    и данными пользователя. Мобилка использует эти данные, чтобы
    показывать корректное имя и роль ещё до обмена токена на JWT.
    """
    payload = {
        "token": raw_token,
        "purpose": purpose,
        "expires_at": expires_at.isoformat(),
        "user": _user_payload(user),
    }
    json_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    b64_string = base64.b64encode(json_bytes).decode("utf-8")

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
        image_factory=qrcode.image.svg.SvgPathImage,
    )
    qr.add_data(b64_string)
    qr.make(fit=True)
    img = qr.make_image()
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")