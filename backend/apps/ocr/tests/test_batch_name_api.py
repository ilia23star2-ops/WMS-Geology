"""API имени пакета OCR (6e-3-backend-2)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

pytestmark = pytest.mark.django_db


def make_client():
    user = get_user_model().objects.create_user(username="name-api", password="p")
    client = APIClient()
    client.force_authenticate(user)
    return client


def test_post_batch_gets_auto_name():
    client = make_client()
    r = client.post("/api/v1/ocr/batches/", {}, format="json")
    assert r.status_code == 201
    assert r.data["name"].startswith("OCR ")


def test_post_batch_keeps_given_name():
    client = make_client()
    r = client.post("/api/v1/ocr/batches/", {"name": "Первый"}, format="json")
    assert r.status_code == 201
    assert r.data["name"] == "Первый"


def test_patch_renames_batch():
    client = make_client()
    created = client.post("/api/v1/ocr/batches/", {"name": "Первый"}, format="json")
    bid = created.data["id"]
    r = client.patch(f"/api/v1/ocr/batches/{bid}/", {"name": "Второй"}, format="json")
    assert r.status_code == 200
    assert r.data["name"] == "Второй"
    assert r.data["status"] == "DRAFT"


def test_patch_sent_keeps_name():
    client = make_client()
    created = client.post("/api/v1/ocr/batches/", {"name": "X"}, format="json")
    bid = created.data["id"]
    r = client.patch(f"/api/v1/ocr/batches/{bid}/", {"status": "SENT"}, format="json")
    assert r.status_code == 200
    assert r.data["status"] == "SENT"
    assert r.data["name"] == "X"