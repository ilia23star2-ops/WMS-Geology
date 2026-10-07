"""
Тесты JWT-аутентификации.

Покрывают:
- login успех (возвращает access + refresh + role + username);
- login неверный пароль (401);
- refresh успех;
- logout успех (токен blacklisted);
- logout без refresh (400);
- logout неверным токеном (400);
- /me успех (с ролью и без);
- /me без аутентификации (401).
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.users.models import Role, UserProfile


@pytest.fixture
def client():
    return APIClient()


@pytest.fixture
def user_with_role(db):
    role = Role.objects.create(name="worker")
    user = User.objects.create_user(username="worker1", password="test12345")
    UserProfile.objects.create(user=user, role=role, full_name="Иван Рабочий")
    return user


@pytest.fixture
def user_no_role(db):
    return User.objects.create_user(username="norole", password="test12345")


# ============================================================
# Login
# ============================================================
def test_login_success(client, user_with_role):
    response = client.post(
        "/api/v1/auth/login/",
        {"username": "worker1", "password": "test12345"},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data
    assert "refresh" in response.data
    assert response.data["username"] == "worker1"
    assert response.data["role"] == "worker"
    assert response.data["full_name"] == "Иван Рабочий"


def test_login_without_role(client, user_no_role):
    response = client.post(
        "/api/v1/auth/login/",
        {"username": "norole", "password": "test12345"},
        format="json",
    )
    assert response.status_code == 200
    assert response.data["role"] is None


def test_login_wrong_password(client, user_with_role):
    response = client.post(
        "/api/v1/auth/login/",
        {"username": "worker1", "password": "wrong"},
        format="json",
    )
    assert response.status_code == 401


def test_login_nonexistent_user(client, db):
    response = client.post(
        "/api/v1/auth/login/",
        {"username": "ghost", "password": "x"},
        format="json",
    )
    assert response.status_code == 401


# ============================================================
# Refresh
# ============================================================
def test_refresh_success(client, user_with_role):
    login = client.post(
        "/api/v1/auth/login/",
        {"username": "worker1", "password": "test12345"},
        format="json",
    )
    refresh = login.data["refresh"]

    response = client.post(
        "/api/v1/auth/refresh/",
        {"refresh": refresh},
        format="json",
    )
    assert response.status_code == 200
    assert "access" in response.data


def test_refresh_invalid_token(client, db):
    response = client.post(
        "/api/v1/auth/refresh/",
        {"refresh": "not.a.token"},
        format="json",
    )
    assert response.status_code == 401


# ============================================================
# Logout
# ============================================================
def test_logout_success(client, user_with_role):
    login = client.post(
        "/api/v1/auth/login/",
        {"username": "worker1", "password": "test12345"},
        format="json",
    )
    access = login.data["access"]
    refresh = login.data["refresh"]

    client.credentials(HTTP_AUTHORIZATION=f"Bearer {access}")
    response = client.post(
        "/api/v1/auth/logout/",
        {"refresh": refresh},
        format="json",
    )
    assert response.status_code == 200

    # После blacklist — refresh больше не работает.
    client.credentials()
    refresh_response = client.post(
        "/api/v1/auth/refresh/",
        {"refresh": refresh},
        format="json",
    )
    assert refresh_response.status_code == 401


def test_logout_without_refresh(client, user_with_role):
    login = client.post(
        "/api/v1/auth/login/",
        {"username": "worker1", "password": "test12345"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    response = client.post("/api/v1/auth/logout/", {}, format="json")
    assert response.status_code == 400


def test_logout_invalid_refresh(client, user_with_role):
    login = client.post(
        "/api/v1/auth/login/",
        {"username": "worker1", "password": "test12345"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    response = client.post(
        "/api/v1/auth/logout/",
        {"refresh": "garbage"},
        format="json",
    )
    assert response.status_code == 400


def test_logout_requires_auth(client, db):
    response = client.post(
        "/api/v1/auth/logout/",
        {"refresh": "garbage"},
        format="json",
    )
    assert response.status_code in (401, 403)


# ============================================================
# /me
# ============================================================
def test_me_success(client, user_with_role):
    login = client.post(
        "/api/v1/auth/login/",
        {"username": "worker1", "password": "test12345"},
        format="json",
    )
    client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
    response = client.get("/api/v1/auth/me/")
    assert response.status_code == 200
    assert response.data["username"] == "worker1"
    assert response.data["role"] == "worker"
    assert response.data["full_name"] == "Иван Рабочий"


def test_me_requires_auth(client, db):
    response = client.get("/api/v1/auth/me/")
    assert response.status_code in (401, 403)