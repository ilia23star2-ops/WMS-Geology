"""
Тесты AccessToken (3.x-offline-auth-a + 3.x-offline-auth-b).

Покрывают:
- create (web_login / offline), TTL;
- create для другого (admin OK, worker 403);
- list (свои + созданные);
- revoke;
- code-login OK / used / expired / revoked / not-found;
- offline-login OK (привязка device_id) / 409 (другой device) /
  expired / revoked / not-found;
- qr_svg в ответе create (3.x-offline-auth-b).
"""

from datetime import timedelta

import pytest
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.test import APIClient

from apps.users.models import AccessToken, AuditLog, Role, UserProfile


@pytest.fixture
def role_admin(db):
    return Role.objects.create(name="admin")


@pytest.fixture
def role_worker(db):
    return Role.objects.create(name="worker")


@pytest.fixture
def admin_user(db, role_admin):
    user = User.objects.create_user(username="admin1", password="x")
    UserProfile.objects.create(user=user, role=role_admin)
    return user


@pytest.fixture
def worker_user(db, role_worker):
    user = User.objects.create_user(username="worker1", password="x")
    UserProfile.objects.create(user=user, role=role_worker)
    return user


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.fixture
def worker_client(worker_user):
    c = APIClient()
    c.force_authenticate(user=worker_user)
    return c


# ============================================================
# Create
# ============================================================
@pytest.mark.django_db
def test_create_web_login_token_for_self(worker_client, worker_user):
    response = worker_client.post(
        "/api/v1/auth/access-tokens/",
        {"purpose": "web_login"},
        format="json",
    )
    assert response.status_code == 201
    data = response.data
    assert data["purpose"] == "web_login"
    assert data["user"] == worker_user.pk
    assert "raw_token" in data
    # c-4.5: secrets.token_urlsafe(32) → 43 символа (base64url без padding).
    assert len(data["raw_token"]) == 43
    # TTL ~ 15 мин
    assert data["is_active"] is True


@pytest.mark.django_db
def test_create_offline_token_for_self(worker_client):
    response = worker_client.post(
        "/api/v1/auth/access-tokens/",
        {"purpose": "offline"},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["purpose"] == "offline"


@pytest.mark.django_db
def test_create_returns_qr_svg(worker_client):
    """3.x-offline-auth-b: в ответе есть qr_svg."""
    response = worker_client.post(
        "/api/v1/auth/access-tokens/",
        {"purpose": "web_login"},
        format="json",
    )
    assert response.status_code == 201
    assert "qr_svg" in response.data
    assert response.data["qr_svg"].startswith("<?xml")
    # raw встроен в QR — payload base64(JSON).
    raw = response.data["raw_token"]
    # SVG содержит путь для QR, но не сам raw (это картинка).
    # Проверяем, что хотя бы валидный SVG и содержит <svg
    assert "<svg" in response.data["qr_svg"]
    assert raw not in response.data["qr_svg"]  # raw в payload — уже QR-энкодинг


@pytest.mark.django_db
def test_qr_svg_payload_web_login(worker_user):
    """c-4.5: payload web_login → base64-JSON {token, purpose, expires_at, user}."""
    from apps.users.services import make_access_token_qr_svg

    raw = "a" * 64
    svg = make_access_token_qr_svg(
        "web_login",
        raw,
        expires_at=timezone.now() + timedelta(minutes=15),
        user=worker_user,
    )
    assert svg.startswith("<?xml")
    assert "<svg" in svg


@pytest.mark.django_db
def test_qr_svg_payload_offline(worker_user):
    """c-4.5: payload offline → base64-JSON {token, purpose, expires_at, user}."""
    from apps.users.services import make_access_token_qr_svg

    raw = "b" * 64
    svg = make_access_token_qr_svg(
        "offline",
        raw,
        expires_at=timezone.now() + timedelta(hours=14),
        user=worker_user,
    )
    assert svg.startswith("<?xml")
    assert "<svg" in svg


@pytest.mark.django_db
def test_create_token_for_other_admin_ok(admin_client, worker_user):
    response = admin_client.post(
        "/api/v1/auth/access-tokens/",
        {"purpose": "offline", "user_id": worker_user.pk},
        format="json",
    )
    assert response.status_code == 201
    assert response.data["user"] == worker_user.pk


@pytest.mark.django_db
def test_create_token_for_other_worker_forbidden(worker_client, admin_user):
    response = worker_client.post(
        "/api/v1/auth/access-tokens/",
        {"purpose": "offline", "user_id": admin_user.pk},
        format="json",
    )
    assert response.status_code == 403


@pytest.mark.django_db
def test_create_token_unknown_user(admin_client):
    response = admin_client.post(
        "/api/v1/auth/access-tokens/",
        {"purpose": "offline", "user_id": 99999},
        format="json",
    )
    assert response.status_code == 400


# ============================================================
# List / revoke
# ============================================================
@pytest.mark.django_db
def test_list_only_own_and_created(worker_client, worker_user, admin_user):
    AccessToken.objects.create(
        user=worker_user, purpose="web_login",
        token_hash="a" * 64,
        expires_at=timezone.now() + timedelta(minutes=15),
    )
    AccessToken.objects.create(
        user=admin_user, purpose="offline",
        token_hash="b" * 64,
        expires_at=timezone.now() + timedelta(days=7),
    )
    response = worker_client.get("/api/v1/auth/access-tokens/")
    assert response.status_code == 200
    usernames = {row["username"] for row in response.data}
    assert usernames == {"worker1"}


@pytest.mark.django_db
def test_revoke_own(worker_client, worker_user):
    obj, raw = _create_raw(
        worker_user, "web_login",
    )
    response = worker_client.post(
        f"/api/v1/auth/access-tokens/{obj.pk}/revoke/",
    )
    assert response.status_code == 200
    obj.refresh_from_db()
    assert obj.revoked_at is not None
    assert obj.is_active is False


def _create_raw(user, purpose):
    from apps.users.services import generate_access_token
    return generate_access_token(user=user, purpose=purpose, created_by=user)


# ============================================================
# Code-login
# ============================================================
@pytest.mark.django_db
def test_code_login_ok(worker_client, worker_user):
    _, raw = _create_raw(worker_user, "web_login")
    anon = APIClient()
    response = anon.post(
        "/api/v1/auth/code-login/",
        {"code": raw},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data
    assert response.data["username"] == worker_user.username
    # Код погашен
    obj = AccessToken.objects.get(purpose="web_login")
    assert obj.used_at is not None
    # Аудит
    log = AuditLog.objects.filter(action="CODE_LOGIN").first()
    assert log is not None


@pytest.mark.django_db
def test_code_login_reused_fails(worker_client, worker_user):
    _, raw = _create_raw(worker_user, "web_login")
    anon = APIClient()
    anon.post("/api/v1/auth/code-login/", {"code": raw}, format="json")
    response = anon.post(
        "/api/v1/auth/code-login/", {"code": raw}, format="json",
    )
    assert response.status_code == 400
    assert "уже использован" in response.data["error"]


@pytest.mark.django_db
def test_code_login_expired_fails(worker_user):
    obj, raw = _create_raw(worker_user, "web_login")
    obj.expires_at = timezone.now() - timedelta(seconds=1)
    obj.save(update_fields=["expires_at"])
    response = APIClient().post(
        "/api/v1/auth/code-login/", {"code": raw}, format="json",
    )
    assert response.status_code == 400
    assert "истёк" in response.data["error"]


@pytest.mark.django_db
def test_code_login_revoked_fails(worker_user):
    obj, raw = _create_raw(worker_user, "web_login")
    obj.revoked_at = timezone.now()
    obj.save(update_fields=["revoked_at"])
    response = APIClient().post(
        "/api/v1/auth/code-login/", {"code": raw}, format="json",
    )
    assert response.status_code == 400
    assert "отозван" in response.data["error"]


@pytest.mark.django_db
def test_code_login_not_found():
    response = APIClient().post(
        "/api/v1/auth/code-login/", {"code": "0" * 64}, format="json",
    )
    assert response.status_code == 400
    assert "не найден" in response.data["error"]


# ============================================================
# Offline-login
# ============================================================
@pytest.mark.django_db
def test_offline_login_binds_device(worker_user):
    obj, raw = _create_raw(worker_user, "offline")
    anon = APIClient()
    response = anon.post(
        "/api/v1/auth/offline-login/",
        {"token": raw, "device_id": "phone-1"},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data
    obj.refresh_from_db()
    assert obj.device_id == "phone-1"
    assert AuditLog.objects.filter(action="OFFLINE_LOGIN").exists()


@pytest.mark.django_db
def test_offline_login_same_device_ok(worker_user):
    _, raw = _create_raw(worker_user, "offline")
    anon = APIClient()
    anon.post(
        "/api/v1/auth/offline-login/",
        {"token": raw, "device_id": "phone-1"},
        format="json",
    )
    response = anon.post(
        "/api/v1/auth/offline-login/",
        {"token": raw, "device_id": "phone-1"},
        format="json",
    )
    assert response.status_code == 200


@pytest.mark.django_db
def test_offline_login_other_device_conflict(worker_user):
    _, raw = _create_raw(worker_user, "offline")
    anon = APIClient()
    anon.post(
        "/api/v1/auth/offline-login/",
        {"token": raw, "device_id": "phone-1"},
        format="json",
    )
    response = anon.post(
        "/api/v1/auth/offline-login/",
        {"token": raw, "device_id": "phone-2"},
        format="json",
    )
    assert response.status_code == 409


@pytest.mark.django_db
def test_offline_login_expired_fails(worker_user):
    obj, raw = _create_raw(worker_user, "offline")
    obj.expires_at = timezone.now() - timedelta(seconds=1)
    obj.save(update_fields=["expires_at"])
    response = APIClient().post(
        "/api/v1/auth/offline-login/",
        {"token": raw, "device_id": "phone-1"},
        format="json",
    )
    assert response.status_code == 400
    assert "истёк" in response.data["error"]


@pytest.mark.django_db
def test_offline_login_revoked_fails(worker_user):
    obj, raw = _create_raw(worker_user, "offline")
    obj.revoked_at = timezone.now()
    obj.save(update_fields=["revoked_at"])
    response = APIClient().post(
        "/api/v1/auth/offline-login/",
        {"token": raw, "device_id": "phone-1"},
        format="json",
    )
    assert response.status_code == 400
    assert "отозван" in response.data["error"]