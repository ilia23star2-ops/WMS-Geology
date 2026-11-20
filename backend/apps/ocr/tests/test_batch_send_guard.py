"""SENT запрещён при незавершённых фото (6e-3-backend-4c)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.ocr.models import OcrTask

pytestmark = pytest.mark.django_db


def make_client():
    user = get_user_model().objects.create_user(username="sent-guard", password="p")
    client = APIClient()
    client.force_authenticate(user)
    return client


def _batch(client):
    return client.post("/api/v1/ocr/batches/", {}, format="json").data["id"]


def test_sent_blocked_while_photo_pending():
    client = make_client()
    bid = _batch(client)
    OcrTask.objects.create(batch_id=bid, image="ocr_tasks/x.jpg", status="PENDING")
    r = client.patch(f"/api/v1/ocr/batches/{bid}/", {"status": "SENT"}, format="json")
    assert r.status_code == 400
    assert "незавершённых" in r.data["error"]


def test_sent_allowed_when_photos_ready():
    client = make_client()
    bid = _batch(client)
    OcrTask.objects.create(batch_id=bid, image="ocr_tasks/y.jpg", status="READY")
    r = client.patch(f"/api/v1/ocr/batches/{bid}/", {"status": "SENT"}, format="json")
    assert r.status_code == 200
    assert r.data["status"] == "SENT"
