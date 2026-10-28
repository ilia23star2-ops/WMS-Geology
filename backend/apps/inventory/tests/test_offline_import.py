"""
Тесты offline-import (3.x-offline-sync-b-3 + 3.x-offline-sync-b-4).

Покрывают:
- ошибки валидации (неверный format / version / пустой список);
- DISPOSE_SAMPLE (applied / идемпотентно);
- PICKED (applied / конфликт при DISPOSED);
- RECEIVING_MATCH (applied → Container PENDING_FILLING);
- RECEIVING_MATCH при удалённой строке → конфликт;
- PLACE (applied, обновляет cell_id);
- PLACE при mismatch `updated_at` → applied + ActualizationTask.
"""

import time

import pytest
from django.contrib.auth.models import User
from rest_framework.test import APIClient

from apps.inventory.models import ActualizationTask
from apps.picking.models import PickList, PickListItem
from apps.receiving.models import Receipt, ReceiptItem
from apps.samples.catalogs import ResearchType
from apps.samples.models import Sample
from apps.storage.models import (
    Cell,
    Container,
    ContainerType,
    Rack,
    Room,
    Section,
    Tier,
)


@pytest.fixture
def auth_client(db):
    user = User.objects.create_user(username="offline_import_test", password="x")
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def container_type(db):
    return ContainerType.objects.create(name="Коробка")


@pytest.fixture
def research_type(db):
    return ResearchType.objects.create(code="ШЛ", name="Шлифы")


@pytest.fixture
def container(db, container_type):
    return Container.objects.create(
        container_number="T-OFF-001", container_type=container_type,
    )


@pytest.fixture
def sample(db, container, research_type):
    return Sample.objects.create(
        sample_number="OFF-001",
        research_type=research_type,
        container=container,
        status=Sample.STATUS_IN_STORAGE,
    )


@pytest.fixture
def pick_list(db):
    return PickList.objects.create(pick_list_number="В-OFF-001")


@pytest.fixture
def pick_item(db, pick_list, sample):
    return PickListItem.objects.create(pick_list=pick_list, sample=sample)


@pytest.fixture
def receipt(db):
    return Receipt.objects.create(receipt_number="ПР-OFF-001")


@pytest.fixture
def receipt_item(db, receipt, container_type, research_type):
    return ReceiptItem.objects.create(
        receipt=receipt,
        container_type=container_type,
        expected_work_order_number="TST0001",
        expected_research_type_code=research_type.code,
        expected_samples_count=1,
        status=ReceiptItem.STATUS_EXPECTED,
    )


@pytest.fixture
def room(db):
    return Room.objects.create(name="Комната 1")


@pytest.fixture
def cell(db, room):
    rack = Rack.objects.create(room=room, code="A")
    section = Section.objects.create(rack=rack, code="S1")
    tier = Tier.objects.create(section=section, code="A", level_number=1)
    return Cell.objects.create(
        tier=tier, code="1", full_address="Комната 1 / A / S1 / A / 1",
    )


def _payload(operations, *, receipt_id=None, pick_list_id=None, fmt="WMSG-OFFLINE-EXCHANGE", version=1):
    ctx = {}
    if receipt_id is not None:
        ctx["receipt_id"] = receipt_id
    if pick_list_id is not None:
        ctx["pick_list_id"] = pick_list_id
    return {
        "format": fmt,
        "version": version,
        "device_id": "phone-1",
        "user": {"id": 1, "username": "worker1"},
        "task_context": ctx,
        "operations": operations,
    }


# ============================================================
# Валидация
# ============================================================
@pytest.mark.django_db
def test_wrong_format_returns_400(auth_client):
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload([], fmt="WRONG"),
        format="json",
    )
    assert response.status_code == 400


@pytest.mark.django_db
def test_wrong_version_returns_400(auth_client, sample):
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload(
            [{"op_id": "1", "type": "DISPOSE_SAMPLE", "entity": "Sample", "entity_id": sample.pk}],
            version=99,
        ),
        format="json",
    )
    assert response.status_code == 400


# ============================================================
# DISPOSE_SAMPLE
# ============================================================
@pytest.mark.django_db
def test_dispose_sample_applied(auth_client, sample):
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload([
            {
                "op_id": "uuid-1",
                "type": "DISPOSE_SAMPLE",
                "entity": "Sample",
                "entity_id": sample.pk,
                "data": {"reason": "разбита"},
            },
        ]),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["applied"] == 1
    assert response.data["conflicts"] == 0
    sample.refresh_from_db()
    assert sample.status == "DISPOSED"
    assert sample.disposal_reason == "разбита"


@pytest.mark.django_db
def test_dispose_sample_idempotent(auth_client, sample):
    sample.status = Sample.STATUS_DISPOSED
    sample.save(update_fields=["status"])
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload([
            {"op_id": "uuid-1", "type": "DISPOSE_SAMPLE", "entity": "Sample", "entity_id": sample.pk},
        ]),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["applied"] == 1
    assert response.data["conflicts"] == 0


# ============================================================
# PICKED / NOT_FOUND
# ============================================================
@pytest.mark.django_db
def test_picked_applied(auth_client, pick_item, pick_list):
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload(
            [
                {
                    "op_id": "uuid-2",
                    "type": "PICKED",
                    "entity": "PickListItem",
                    "entity_id": pick_item.pk,
                    "data": {"note": "нашёл"},
                },
            ],
            pick_list_id=pick_list.pk,
        ),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["applied"] == 1
    pick_item.refresh_from_db()
    assert pick_item.status == "PICKED"
    assert pick_item.note == "нашёл"


@pytest.mark.django_db
def test_picked_sample_disposed_conflict(auth_client, pick_item, sample):
    sample.status = Sample.STATUS_DISPOSED
    sample.save(update_fields=["status"])
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload([
            {
                "op_id": "uuid-3",
                "type": "PICKED",
                "entity": "PickListItem",
                "entity_id": pick_item.pk,
            },
        ]),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["conflicts"] == 1
    assert response.data["tasks_created"] == 1
    task = ActualizationTask.objects.get()
    assert task.task_type == "SAMPLE_STATUS_CONFLICT"
    assert task.entity_id == sample.pk


# ============================================================
# RECEIVING_*
# ============================================================
@pytest.mark.django_db
def test_receiving_match_applied(auth_client, receipt, receipt_item, container_type):
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload(
            [
                {
                    "op_id": "uuid-4",
                    "type": "RECEIVING_MATCH",
                    "entity": "ReceiptItem",
                    "entity_id": receipt_item.pk,
                    "data": {"container_number": "T-IMPORT-1"},
                },
            ],
            receipt_id=receipt.pk,
        ),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["applied"] == 1
    receipt_item.refresh_from_db()
    assert receipt_item.status == "MATCHED"
    assert receipt_item.container is not None
    assert receipt_item.container.status == "PENDING_FILLING"


@pytest.mark.django_db
def test_receiving_match_deleted_item_conflict(auth_client, receipt):
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload(
            [
                {
                    "op_id": "uuid-5",
                    "type": "RECEIVING_MATCH",
                    "entity": "ReceiptItem",
                    "entity_id": 99999,
                    "data": {"container_number": "T-GHOST"},
                },
            ],
            receipt_id=receipt.pk,
        ),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["conflicts"] == 1
    assert response.data["tasks_created"] == 1
    task = ActualizationTask.objects.get()
    assert task.task_type == "RECEIPT_ITEM_DELETED"
    assert task.entity_id == 99999


# ============================================================
# PLACE (3.x-offline-sync-b-4)
# ============================================================
@pytest.mark.django_db
def test_place_applied(auth_client, container, cell):
    """PLACE применяется: container попадает на поддон в ячейке."""
    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload([
            {
                "op_id": "uuid-6",
                "type": "PLACE",
                "entity": "Container",
                "entity_id": container.pk,
                "data": {"cell_id": cell.pk},
            },
        ]),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["applied"] == 1
    assert response.data["conflicts"] == 0
    assert response.data["tasks_created"] == 0
    container.refresh_from_db()
    assert container.status == "ACTIVE"
    assert container.pallet is not None
    assert container.pallet.cell_id == cell.pk


@pytest.mark.django_db
def test_place_mismatch_creates_task(auth_client, container, cell, room):
    """
    PLACE при расхождении `updated_at` → применяется + ActualizationTask
    CONTAINER_MISPLACED (сигнал «у сервера были вопросы»).
    """
    # Запомним «старый» updated_at.
    old_updated_at = container.updated_at.isoformat()

    # Имитируем изменение на сервере.
    time.sleep(0.01)
    container.comment = "изменено офисом"
    container.save()

    response = auth_client.post(
        "/api/v1/offline-imports/",
        _payload([
            {
                "op_id": "uuid-7",
                "type": "PLACE",
                "entity": "Container",
                "entity_id": container.pk,
                "server_updated_at": old_updated_at,
                "data": {"floor_room_id": room.pk},
            },
        ]),
        format="json",
    )
    assert response.status_code == 200
    assert response.data["applied"] == 1
    assert response.data["tasks_created"] == 1
    task = ActualizationTask.objects.get()
    assert task.task_type == "CONTAINER_MISPLACED"
    assert task.entity_type == "Container"
    assert task.entity_id == container.pk
    # Задача НЕ блокирует применение: тара на полу.
    container.refresh_from_db()
    assert container.floor_room_id == room.pk