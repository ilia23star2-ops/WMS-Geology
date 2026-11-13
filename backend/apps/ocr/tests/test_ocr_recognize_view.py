"""Тесты эндпоинта POST /api/v1/ocr/recognize/."""
import json
from subprocess import CompletedProcess, TimeoutExpired
from unittest.mock import patch

import pytest

from apps.ocr.models import OcrBatch, OcrTask

ENDPOINT = '/api/v1/ocr/recognize/'

_VALID_JSON = json.dumps({
    'text': 'TST0001 Hello OCR',
    'words': [
        {
            'text': 'TST0001',
            'confidence': 0.95,
            'bbox': [[0, 0], [50, 0], [50, 20], [0, 20]],
        },
    ],
}, ensure_ascii=False)


def _fake_ok():
    return CompletedProcess(args=[], returncode=0, stdout=_VALID_JSON, stderr='')


@pytest.mark.django_db
def test_recognize_success_creates_task_ready(api_client, png_upload, user):
    with patch('apps.ocr.views.subprocess.run', return_value=_fake_ok()):
        resp = api_client.post(ENDPOINT, {'image': png_upload}, format='multipart')

    assert resp.status_code == 200
    body = resp.json()
    assert body['status'] == 'success'

    task = OcrTask.objects.get(id=body['task_id'])
    assert task.status == 'READY'
    assert task.raw_ocr_data['text'] == 'TST0001 Hello OCR'
    assert len(task.raw_ocr_data['words']) == 1

    batch = OcrBatch.objects.get(id=body['batch_id'])
    assert batch.user_id == user.id
    assert batch.tasks.count() == 1


@pytest.mark.django_db
def test_recognize_reuses_existing_batch(api_client, png_upload, user):
    batch = OcrBatch.objects.create(user=user)
    with patch('apps.ocr.views.subprocess.run', return_value=_fake_ok()):
        resp = api_client.post(
            ENDPOINT,
            {'image': png_upload, 'batch_id': str(batch.id)},
            format='multipart',
        )

    assert resp.status_code == 200
    assert resp.json()['batch_id'] == batch.id
    # Новый batch не создан — использован переданный
    assert OcrBatch.objects.filter(user=user).count() == 1
    assert batch.tasks.count() == 1


@pytest.mark.django_db
def test_recognize_no_image_returns_400(api_client):
    resp = api_client.post(ENDPOINT, {}, format='multipart')

    assert resp.status_code == 400
    assert 'No image' in resp.json()['error']
    assert OcrTask.objects.count() == 0


@pytest.mark.django_db
def test_recognize_unknown_batch_returns_404(api_client, png_upload):
    resp = api_client.post(
        ENDPOINT,
        {'image': png_upload, 'batch_id': '999999'},
        format='multipart',
    )

    assert resp.status_code == 404
    assert OcrTask.objects.count() == 0


@pytest.mark.django_db
def test_recognize_subprocess_failure_marks_task_error(api_client, png_upload):
    fake = CompletedProcess(args=[], returncode=1, stdout='', stderr='easyocr crashed')
    with patch('apps.ocr.views.subprocess.run', return_value=fake):
        resp = api_client.post(ENDPOINT, {'image': png_upload}, format='multipart')

    assert resp.status_code == 500
    task = OcrTask.objects.get()
    assert task.status == 'ERROR'
    assert 'easyocr crashed' in task.error_message


@pytest.mark.django_db
def test_recognize_timeout_returns_504(api_client, png_upload):
    with patch(
        'apps.ocr.views.subprocess.run',
        side_effect=TimeoutExpired(cmd='x', timeout=120),
    ):
        resp = api_client.post(ENDPOINT, {'image': png_upload}, format='multipart')

    assert resp.status_code == 504
    task = OcrTask.objects.get()
    assert task.status == 'ERROR'
    assert 'timeout' in task.error_message.lower()


@pytest.mark.django_db
def test_recognize_invalid_json_marks_error(api_client, png_upload):
    fake = CompletedProcess(args=[], returncode=0, stdout='not a json', stderr='')
    with patch('apps.ocr.views.subprocess.run', return_value=fake):
        resp = api_client.post(ENDPOINT, {'image': png_upload}, format='multipart')

    assert resp.status_code == 500
    task = OcrTask.objects.get()
    assert task.status == 'ERROR'
    assert 'Invalid JSON' in task.error_message