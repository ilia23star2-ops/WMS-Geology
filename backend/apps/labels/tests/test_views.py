"""
Тесты API приложения labels: PrintBatchViewSet.

Покрывают: CRUD, actions (add-containers, remove-container,
mark-ready, cancel), автогенерацию номера, ограничения по
статусам, отсутствие DELETE.
"""

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.labels.models import PrintBatch
from apps.storage.models import Container, ContainerType


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="labels_api", password="test")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def anon_client():
    return APIClient()


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def containers(db, container_type):
    return [
        Container.objects.create(
            container_number=f"T-{i:03d}",
            container_type=container_type,
        )
        for i in range(1, 4)
    ]


@pytest.fixture
def batch(db):
    return PrintBatch.objects.create(batch_number="ПЕЧ-2026-001")


# ============================================================
# Аутентификация
# ============================================================
def test_requires_auth(anon_client, db):
    response = anon_client.get("/api/v1/labels/print-batches/")
    assert response.status_code in (401, 403)


# ============================================================
# Создание партии
# ============================================================
def test_create_batch_generates_number(auth_client, db):
    response = auth_client.post(
        "/api/v1/labels/print-batches/",
        {"print_type": "LABELS"}, format="json",
    )
    assert response.status_code == 201
    assert response.data["batch_number"].startswith("ПЕЧ-")
    assert response.data["status"] == "DRAFT"
    assert response.data["created_by"] is not None
    assert response.data["total_items"] == 0


def test_create_two_batches_sequential_numbers(auth_client, db):
    r1 = auth_client.post(
        "/api/v1/labels/print-batches/", {}, format="json",
    )
    r2 = auth_client.post(
        "/api/v1/labels/print-batches/", {}, format="json",
    )
    assert r1.status_code == 201
    assert r2.status_code == 201
    assert r1.data["batch_number"] != r2.data["batch_number"]


def test_create_batch_default_print_type_labels(auth_client, db):
    response = auth_client.post(
        "/api/v1/labels/print-batches/", {}, format="json",
    )
    assert response.status_code == 201
    assert response.data["print_type"] == "LABELS"


# ============================================================
# Список и фильтры
# ============================================================
def test_list_filter_by_status(auth_client, db):
    PrintBatch.objects.create(batch_number="ПЕЧ-2026-001")
    PrintBatch.objects.create(
        batch_number="ПЕЧ-2026-002",
        status=PrintBatch.STATUS_PRINTED,
    )
    response = auth_client.get(
        "/api/v1/labels/print-batches/?status=PRINTED"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


def test_list_filter_by_print_type(auth_client, db):
    PrintBatch.objects.create(
        batch_number="ПЕЧ-2026-001",
        print_type=PrintBatch.PRINT_TYPE_LABELS,
    )
    PrintBatch.objects.create(
        batch_number="ПЕЧ-2026-002",
        print_type=PrintBatch.PRINT_TYPE_QR_ONLY,
    )
    response = auth_client.get(
        "/api/v1/labels/print-batches/?print_type=QR_ONLY"
    )
    assert response.status_code == 200
    assert response.data["count"] == 1


# ============================================================
# Add containers
# ============================================================
def test_add_containers_success(auth_client, batch, containers):
    ids = [c.pk for c in containers]
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": ids}, format="json",
    )
    assert response.status_code == 200
    assert response.data["total_items"] == 3
    assert len(response.data["items"]) == 3


def test_add_containers_duplicates_in_request(
    auth_client, batch, containers,
):
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": [containers[0].pk, containers[0].pk]},
        format="json",
    )
    assert response.status_code == 400


def test_add_containers_missing_container(auth_client, batch):
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": [99999]}, format="json",
    )
    assert response.status_code == 400


def test_add_containers_already_in_batch(
    auth_client, batch, containers,
):
    cid = containers[0].pk
    auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": [cid]}, format="json",
    )
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": [cid]}, format="json",
    )
    assert response.status_code == 400


def test_add_containers_to_non_draft_fails(
    auth_client, batch, containers,
):
    batch.status = PrintBatch.STATUS_READY
    batch.save()
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": [containers[0].pk]}, format="json",
    )
    assert response.status_code == 400


# ============================================================
# Remove container
# ============================================================
def test_remove_container_success(auth_client, batch, containers):
    ids = [c.pk for c in containers]
    auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": ids}, format="json",
    )
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/remove-container/",
        {"container_id": containers[0].pk}, format="json",
    )
    assert response.status_code == 200
    assert response.data["total_items"] == 2


def test_remove_container_not_in_batch(auth_client, batch, containers):
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/remove-container/",
        {"container_id": containers[0].pk}, format="json",
    )
    assert response.status_code == 404


def test_remove_container_without_id_fails(auth_client, batch):
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/remove-container/",
        {}, format="json",
    )
    assert response.status_code == 400


# ============================================================
# Mark ready
# ============================================================
def test_mark_ready_empty_fails(auth_client, batch):
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/mark-ready/",
    )
    assert response.status_code == 400


def test_mark_ready_with_items_success(
    auth_client, batch, containers,
):
    auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": [containers[0].pk]}, format="json",
    )
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/mark-ready/",
    )
    assert response.status_code == 200
    assert response.data["status"] == "READY"


def test_mark_ready_from_cancelled_fails(
    auth_client, batch, containers,
):
    auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/add-containers/",
        {"container_ids": [containers[0].pk]}, format="json",
    )
    batch.refresh_from_db()
    batch.status = PrintBatch.STATUS_CANCELLED
    batch.save()
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/mark-ready/",
    )
    assert response.status_code == 400


# ============================================================
# Cancel
# ============================================================
def test_cancel_draft_success(auth_client, batch):
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/cancel/",
    )
    assert response.status_code == 200
    assert response.data["status"] == "CANCELLED"


def test_cancel_ready_success(auth_client, batch):
    batch.status = PrintBatch.STATUS_READY
    batch.save()
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/cancel/",
    )
    assert response.status_code == 200
    assert response.data["status"] == "CANCELLED"


def test_cancel_printed_fails(auth_client, batch):
    batch.status = PrintBatch.STATUS_PRINTED
    batch.save()
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/cancel/",
    )
    assert response.status_code == 400


def test_cancel_already_cancelled_fails(auth_client, batch):
    batch.status = PrintBatch.STATUS_CANCELLED
    batch.save()
    response = auth_client.post(
        f"/api/v1/labels/print-batches/{batch.pk}/cancel/",
    )
    assert response.status_code == 400


# ============================================================
# Update (PATCH)
# ============================================================
def test_patch_comment_draft(auth_client, batch):
    response = auth_client.patch(
        f"/api/v1/labels/print-batches/{batch.pk}/",
        {"comment": "Комментарий"}, format="json",
    )
    assert response.status_code == 200
    assert response.data["comment"] == "Комментарий"


def test_patch_non_draft_fails(auth_client, batch):
    batch.status = PrintBatch.STATUS_READY
    batch.save()
    response = auth_client.patch(
        f"/api/v1/labels/print-batches/{batch.pk}/",
        {"comment": "Комментарий"}, format="json",
    )
    assert response.status_code == 400


def test_batch_number_is_read_only(auth_client, batch):
    old = batch.batch_number
    auth_client.patch(
        f"/api/v1/labels/print-batches/{batch.pk}/",
        {"batch_number": "ПЕЧ-9999-999"}, format="json",
    )
    batch.refresh_from_db()
    assert batch.batch_number == old


# ============================================================
# DELETE не разрешён
# ============================================================
def test_delete_method_not_allowed(auth_client, batch):
    response = auth_client.delete(
        f"/api/v1/labels/print-batches/{batch.pk}/"
    )
    assert response.status_code == 405


def test_put_method_not_allowed(auth_client, batch):
    response = auth_client.put(
        f"/api/v1/labels/print-batches/{batch.pk}/",
        {}, format="json",
    )
    assert response.status_code == 405