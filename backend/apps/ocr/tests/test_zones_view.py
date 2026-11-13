"""Тесты POST /api/v1/ocr/tasks/{id}/zones/.

c-3.x-migration-5e-1.
"""
import base64

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.ocr.models import OcrBatch, OcrTask

PNG_B64 = (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
    'YAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)


@pytest.fixture
def user(db):
    User = get_user_model()
    return User.objects.create_user(username='zones_test', password='p')


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def other_user(db):
    User = get_user_model()
    return User.objects.create_user(username='other', password='p')


@pytest.fixture
def ocr_task(user, tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    img = SimpleUploadedFile(
        'z.png', base64.b64decode(PNG_B64), content_type='image/png',
    )
    batch = OcrBatch.objects.create(user=user, status='REVIEW')
    return OcrTask.objects.create(batch=batch, image=img, status='READY')


@pytest.mark.django_db
def test_zones_saved_ok(api_client, ocr_task):
    payload = {
        'zones': [
            {
                'type': 'work_order_coded',
                'bbox': [[10, 20], [100, 20], [100, 50], [10, 50]],
                'source': 'manual',
            },
            {
                'type': 'container_number',
                'rect': [10, 60, 90, 30],
            },
        ],
    }
    resp = api_client.post(f'/api/v1/ocr/tasks/{ocr_task.pk}/zones/', payload, format='json')

    assert resp.status_code == 200
    body = resp.json()
    assert body['task_id'] == ocr_task.pk
    assert body['zones_count'] == 2

    ocr_task.refresh_from_db()
    assert len(ocr_task.zones) == 2
    # rect → bbox нормализован
    assert ocr_task.zones[1]['bbox'] == [[10, 60], [100, 60], [100, 90], [10, 90]]


@pytest.mark.django_db
def test_zones_empty_clears(api_client, ocr_task):
    ocr_task.zones = [{'type': 'sample', 'bbox': [[0, 0], [1, 0], [1, 1], [0, 1]]}]
    ocr_task.save()

    resp = api_client.post(
        f'/api/v1/ocr/tasks/{ocr_task.pk}/zones/',
        {'zones': []}, format='json',
    )
    assert resp.status_code == 200
    ocr_task.refresh_from_db()
    assert ocr_task.zones == []


@pytest.mark.django_db
def test_zones_invalid_type_400(api_client, ocr_task):
    payload = {
        'zones': [{'type': 'UNKNOWN', 'bbox': [[0, 0], [1, 0], [1, 1], [0, 1]]}],
    }
    resp = api_client.post(f'/api/v1/ocr/tasks/{ocr_task.pk}/zones/', payload, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_zones_missing_bbox_and_rect_400(api_client, ocr_task):
    payload = {'zones': [{'type': 'sample'}]}
    resp = api_client.post(f'/api/v1/ocr/tasks/{ocr_task.pk}/zones/', payload, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_zones_done_task_400(api_client, ocr_task):
    ocr_task.status = 'DONE'
    ocr_task.save()

    payload = {
        'zones': [{'type': 'sample', 'bbox': [[0, 0], [1, 0], [1, 1], [0, 1]]}],
    }
    resp = api_client.post(f'/api/v1/ocr/tasks/{ocr_task.pk}/zones/', payload, format='json')
    assert resp.status_code == 400
    assert 'подтверждённой' in resp.json()['error']


@pytest.mark.django_db
def test_zones_unknown_task_404(api_client):
    payload = {'zones': []}
    resp = api_client.post('/api/v1/ocr/tasks/99999/zones/', payload, format='json')
    assert resp.status_code == 404


@pytest.mark.django_db
def test_zones_other_user_404(other_user, ocr_task):
    c = APIClient()
    c.force_authenticate(user=other_user)
    payload = {
        'zones': [{'type': 'sample', 'bbox': [[0, 0], [1, 0], [1, 1], [0, 1]]}],
    }
    resp = c.post(f'/api/v1/ocr/tasks/{ocr_task.pk}/zones/', payload, format='json')
    assert resp.status_code == 404