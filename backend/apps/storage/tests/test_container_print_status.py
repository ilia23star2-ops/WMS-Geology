"""
Тесты поля `print_batch_status` в ContainerSerializer (2f-17b).

Логика (DECISIONS 1.71):
- последняя не-CANCELLED партия печати, в которую входит тара;
- нет партий или только CANCELLED → null;
- если тара снова попала в новую DRAFT — показываем DRAFT.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.labels.models import PrintBatch, PrintBatchItem
from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="print_status", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-PS-001",
        container_type=container_type,
    )


def _get_container(client, cid: int):
    return client.get(f"/api/v1/storage/containers/{cid}/")


# ============================================================
# null — тара не в партии
# ============================================================
@pytest.mark.django_db
def test_print_batch_status_null_without_batch(auth_client, container):
    response = _get_container(auth_client, container.pk)
    assert response.status_code == 200
    assert response.data["print_batch_status"] is None


# ============================================================
# DRAFT
# ============================================================
@pytest.mark.django_db
def test_print_batch_status_draft(auth_client, container):
    batch = PrintBatch.objects.create(
        batch_number="ПЕЧ-PS-001",
        status=PrintBatch.STATUS_DRAFT,
    )
    PrintBatchItem.objects.create(batch=batch, container=container)

    response = _get_container(auth_client, container.pk)
    assert response.data["print_batch_status"] == "DRAFT"


# ============================================================
# PRINTED
# ============================================================
@pytest.mark.django_db
def test_print_batch_status_printed(auth_client, container):
    batch = PrintBatch.objects.create(
        batch_number="ПЕЧ-PS-002",
        status=PrintBatch.STATUS_PRINTED,
    )
    PrintBatchItem.objects.create(batch=batch, container=container)

    response = _get_container(auth_client, container.pk)
    assert response.data["print_batch_status"] == "PRINTED"


# ============================================================
# CANCELLED — не показывается (вариант А)
# ============================================================
@pytest.mark.django_db
def test_print_batch_status_cancelled_shown_as_null(auth_client, container):
    batch = PrintBatch.objects.create(
        batch_number="ПЕЧ-PS-003",
        status=PrintBatch.STATUS_CANCELLED,
    )
    PrintBatchItem.objects.create(batch=batch, container=container)

    response = _get_container(auth_client, container.pk)
    assert response.data["print_batch_status"] is None