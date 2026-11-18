"""Тесты PATCH /ocr/batches/{id}/ {status: SENT} (6e-a3)."""
import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.ocr.models import OcrBatch


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="bs", password="p")


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.mark.django_db
def test_patch_sent_ok(api_client, user):
    batch = OcrBatch.objects.create(user=user, status='DRAFT')
    resp = api_client.patch(
        f'/api/v1/ocr/batches/{batch.pk}/', {'status': 'SENT'}, format='json',
    )
    assert resp.status_code == 200
    batch.refresh_from_db()
    assert batch.status == 'SENT'
    assert batch.sent_at is not None


@pytest.mark.django_db
def test_patch_sent_from_completed_400(api_client, user):
    batch = OcrBatch.objects.create(user=user, status='COMPLETED')
    resp = api_client.patch(
        f'/api/v1/ocr/batches/{batch.pk}/', {'status': 'SENT'}, format='json',
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_patch_other_status_400(api_client, user):
    batch = OcrBatch.objects.create(user=user, status='DRAFT')
    resp = api_client.patch(
        f'/api/v1/ocr/batches/{batch.pk}/', {'status': 'REVIEW'}, format='json',
    )
    assert resp.status_code == 400