"""Фикстуры для тестов apps.ocr."""
import base64

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient


# Минимальный валидный PNG 1×1 (прозрачный), проходит Django ImageField.
_PNG_1X1_B64 = (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
    'YAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)


@pytest.fixture(autouse=True)
def _media_root(tmp_path, settings):
    """Все загрузки OCR-тестов идут во временную папку — не в backend/media/."""
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


@pytest.fixture
def user(db):
    User = get_user_model()
    return User.objects.create_user(username='ocr_test', password='pass')


@pytest.fixture
def api_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def png_upload():
    """Свежий SimpleUploadedFile на каждый тест (файл одноразовый)."""
    return SimpleUploadedFile(
        'test.png',
        base64.b64decode(_PNG_1X1_B64),
        content_type='image/png',
    )