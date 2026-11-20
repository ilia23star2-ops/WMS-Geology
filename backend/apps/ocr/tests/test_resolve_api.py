"""Тесты выдачи вердиктов резолвера в ответах API (6e-4-resolve-3)."""
import base64
import json
from subprocess import CompletedProcess
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.ocr.views import _zone_verdicts
from apps.samples.catalogs import Site

PNG_B64 = (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
    'YAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)

_OCR_OUTPUT = json.dumps({'text': 'TST0001', 'words': [
    {'text': 'TST0001', 'confidence': 0.9,
     'bbox': [[10, 20], [100, 20], [100, 50], [10, 50]]},
]})


def _fake_ocr_ok():
    return CompletedProcess(args=[], returncode=0, stdout=_OCR_OUTPUT, stderr='')


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username='rv', password='p')


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
def test_zone_verdicts_resolves_site_via_homoglyphs():
    Site.objects.create(code='TST', name='Тестовый', is_active=True)
    verdicts = _zone_verdicts({'site': 'ТЗТ'})
    assert len(verdicts) == 1
    v = verdicts[0]
    assert v['zone_type'] == 'site'
    assert v['resolved'] is True
    assert v['needs_input'] is False
    assert v['value'] == 'TST'


@pytest.mark.django_db
def test_zone_verdicts_garbage_needs_input():
    Site.objects.create(code='TST', name='Тестовый', is_active=True)
    v = _zone_verdicts({'site': 'QQQ'})[0]
    assert v['resolved'] is False
    assert v['needs_input'] is True
    assert v['value'] is None


@pytest.mark.django_db
def test_zone_verdicts_skips_absent_zones():
    assert _zone_verdicts({}) == []
    assert _zone_verdicts({'container_number': 'T-001'}) == []


@pytest.mark.django_db
def test_recognize_response_contains_zone_verdicts(api_client, png):
    with patch('apps.ocr.views.subprocess.run', return_value=_fake_ocr_ok()):
        resp = api_client.post('/api/v1/ocr/recognize/', {'image': png})
    assert resp.status_code == 200
    body = resp.json()
    assert 'zone_verdicts' in body
    assert isinstance(body['zone_verdicts'], list)