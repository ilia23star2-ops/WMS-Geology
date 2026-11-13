"""Тесты recognize + zones_json (5e-2)."""
import base64
import json
from subprocess import CompletedProcess
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.ocr.models import OcrTask

PNG_B64 = (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
    'YAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)

_OCR_OUTPUT = json.dumps({
    'text': 'TST0001 TAA-A34076001',
    'words': [
        {'text': 'TST0001', 'confidence': 0.9,
         'bbox': [[10, 20], [100, 20], [100, 50], [10, 50]]},
        {'text': 'TAA-A34076001', 'confidence': 0.9,
         'bbox': [[10, 100], [200, 100], [200, 130], [10, 130]]},
    ],
})


def _fake_ocr_ok():
    return CompletedProcess(args=[], returncode=0, stdout=_OCR_OUTPUT, stderr='')


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username='rz', password='p')


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def png():
    return SimpleUploadedFile(
        'x.png', base64.b64decode(PNG_B64), content_type='image/png',
    )


@pytest.fixture(autouse=True)
def _media(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


@pytest.mark.django_db
def test_recognize_with_zones_extracts_fields(api_client, png):
    zones = [
        {'type': 'work_order_coded',
         'bbox': [[5, 15], [110, 15], [110, 55], [5, 55]], 'source': 'manual'},
    ]
    with patch('apps.ocr.views.subprocess.run', return_value=_fake_ocr_ok()):
        resp = api_client.post(
            '/api/v1/ocr/recognize/',
            {
                'image': png,
                'zones_json': json.dumps(zones),
            },
            format='multipart',
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body['extracted']['work_order_coded'] == 'TST0001'
    assert 'TAA-A34076001' in body['extracted']['samples']
    assert body['extracted']['source'] == 'mixed'

    task = OcrTask.objects.get(id=body['task_id'])
    assert task.zones == zones
    assert task.raw_ocr_data['extracted']['work_order_coded'] == 'TST0001'


@pytest.mark.django_db
def test_recognize_without_zones_fallback(api_client, png):
    with patch('apps.ocr.views.subprocess.run', return_value=_fake_ocr_ok()):
        resp = api_client.post(
            '/api/v1/ocr/recognize/',
            {'image': png},
            format='multipart',
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body['extracted']['work_order_coded'] is None
    assert 'TAA-A34076001' in body['extracted']['samples']
    assert body['extracted']['source'] == 'fallback'


@pytest.mark.django_db
def test_recognize_invalid_zones_json_400(api_client, png):
    resp = api_client.post(
        '/api/v1/ocr/recognize/',
        {'image': png, 'zones_json': 'not-a-json'},
        format='multipart',
    )
    assert resp.status_code == 400
    assert 'zones_json' in resp.json()['error']


@pytest.mark.django_db
def test_recognize_invalid_zone_type_400(api_client, png):
    zones = [{'type': 'UNKNOWN', 'bbox': [[0, 0], [10, 0], [10, 10], [0, 10]]}]
    resp = api_client.post(
        '/api/v1/ocr/recognize/',
        {'image': png, 'zones_json': json.dumps(zones)},
        format='multipart',
    )
    assert resp.status_code == 400