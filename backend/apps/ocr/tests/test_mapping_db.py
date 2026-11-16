"""Интеграционный тест mapping + реальные справочники (6a-fix5a).

Проверяет, что views.py передаёт Site/ResearchType/ContainerType
в extract_fields, и что fuzzy match работает на данных из БД.
"""
import base64
import json
from subprocess import CompletedProcess
from unittest.mock import patch

import pytest
from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient

from apps.samples.catalogs import ResearchType, Site
from apps.storage.models import ContainerType

PNG_B64 = (
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk'
    'YAAAAAYAAjCB0C8AAAAASUVORK5CYII='
)

_OCR_OUT = json.dumps({
    "text": "Тестовый участок TST1234 ICP Ящики TST1234501 TST1234502",
    "words": [],
})


@pytest.fixture(autouse=True)
def _media(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path)
    return tmp_path


@pytest.fixture
def user(db):
    return get_user_model().objects.create_user(username="mdb", password="p")


@pytest.fixture
def api_client(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


@pytest.fixture
def catalogs(db):
    Site.objects.create(
        code="TST", name="Тестовый участок",
        match_patterns=["TST", "Тест"], is_active=True,
    )
    ResearchType.objects.create(code="ICP", name="ICP", is_active=True)
    ContainerType.objects.create(name="Ящик")
    return None


@pytest.mark.django_db
def test_recognize_fuzzy_extracts_all_fields(api_client, catalogs):
    img = SimpleUploadedFile("x.png", base64.b64decode(PNG_B64), content_type="image/png")
    fake = CompletedProcess(args=[], returncode=0, stdout=_OCR_OUT, stderr="")

    with patch("apps.ocr.views.subprocess.run", return_value=fake):
        resp = api_client.post(
            "/api/v1/ocr/recognize/",
            {"image": img},
            format="multipart",
        )

    assert resp.status_code == 200
    ex = resp.json()["extracted"]
    assert ex["site"] == "TST"
    assert ex["research_type"] == "ICP"
    assert ex["container_type"] == "Ящик"
    assert ex["work_order_coded"] == "TST1234"
    assert "TST1234501" in ex["samples"]
    assert "TST1234502" in ex["samples"]
    assert ex["source"] == "fallback"