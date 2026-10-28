"""
Сервис офлайн-импорта (3.x-offline-sync-b-3 + 3.x-offline-sync-b-4).

Принимает JSON от mobile (формат `WMSG-OFFLINE-EXCHANGE`, version 1),
применяет операции по классам:

- **A. Append-only** (`DISPOSE_SAMPLE`) — идемпотентно. Если проба уже
  DISPOSED/CONSUMED — applied без изменений.
- **B. Факты физического мира** (`RECEIVING_MATCH`, `RECEIVING_MISSING`,
  `PICKED`, `NOT_FOUND`, `PLACE`) — mobile прав. Применяем. Для `PLACE`
  при расхождении `server_updated_at` создаём `ActualizationTask` типа
  `CONTAINER_MISPLACED` (сигнал «у сервера были вопросы»), но всё равно
  применяем данные mobile.

`RECEIVING_*` идут батчем через `check_receipt`. `PLACE` — через
`bulk_place_containers` (сервис, 3.x-offline-sync-b-4).

Формат payload:

    {
      "format": "WMSG-OFFLINE-EXCHANGE",
      "version": 1,
      "exported_at": "2026-10-28T14:30:00Z",
      "device_id": "phone-1",
      "user": {"id": 5, "username": "worker1"},
      "task_context": {
        "task_type": "RECEIVING" | "PICKING",
        "receipt_id": 8,       # для RECEIVING_*
        "pick_list_id": 3      # для PICKED/NOT_FOUND (необязательно)
      },
      "operations": [
        {"op_id": "uuid-1", "type": "RECEIVING_MATCH",
         "entity": "ReceiptItem", "entity_id": 42,
         "data": {"container_number": "T-001"}},
        {"op_id": "uuid-2", "type": "PLACE",
         "entity": "Container", "entity_id": 55,
         "server_updated_at": "2026-10-28T10:00:00Z",
         "data": {"cell_id": 5}}
      ]
    }
"""

import logging

from django.db import transaction
from django.utils import timezone

from apps.inventory.models import ActualizationTask
from apps.picking.models import PickListItem
from apps.receiving.models import Receipt, ReceiptItem
from apps.receiving.services.import_service import check_receipt
from apps.samples.models import Sample
from apps.storage.models import Container
from apps.storage.services.bulk_place import bulk_place_containers

logger = logging.getLogger(__name__)

# Класс B: mobile прав, но если сервер уже в терминальном статусе — конфликт.
_TERMINAL_SAMPLE_STATUSES = {
    Sample.STATUS_DISPOSED,
    Sample.STATUS_CONSUMED,
}


def _create_task(
    *,
    task_type: str,
    entity_type: str,
    entity_id: int | None,
    server_value: dict | None,
    mobile_value: dict | None,
    payload: dict | None,
) -> ActualizationTask:
    return ActualizationTask.objects.create(
        task_type=task_type,
        entity_type=entity_type,
        entity_id=entity_id,
        server_value=server_value,
        mobile_value=mobile_value,
        payload=payload or {},
    )


def _apply_dispose_sample(op: dict, user, device_id: str) -> str:
    """
    Класс A: dispose пробы. Идемпотентно.

    Возвращает `"applied"`.
    """
    entity_id = op["entity_id"]
    sample = Sample.objects.filter(pk=entity_id).first()
    if sample is None:
        raise ValueError(f"Проба #{entity_id} не найдена.")

    # Уже в терминальном статусе — идемпотентно.
    if sample.status in _TERMINAL_SAMPLE_STATUSES:
        return "applied"

    data = op.get("data") or {}
    sample.status = Sample.STATUS_DISPOSED
    sample.disposed_at = timezone.now()
    if user and getattr(user, "is_authenticated", False):
        sample.disposed_by = user
    sample.disposal_reason = (data.get("reason") or "")[:2000]
    sample.save(update_fields=[
        "status", "disposed_at", "disposed_by", "disposal_reason",
    ])
    return "applied"


def _apply_pick_item(op: dict, user, device_id: str) -> str:
    """
    Класс B: PICKED / NOT_FOUND для PickListItem.

    Возвращает `"applied"` или `"conflict"`.
    При конфликте создаёт `ActualizationTask`.
    """
    entity_id = op["entity_id"]
    item = (
        PickListItem.objects
        .select_related("sample")
        .filter(pk=entity_id)
        .first()
    )
    if item is None:
        raise ValueError(f"Строка выборки #{entity_id} не найдена.")

    data = op.get("data") or {}
    target_status = (
        PickListItem.STATUS_PICKED
        if op["type"] == "PICKED"
        else PickListItem.STATUS_NOT_FOUND
    )
    mobile_value = {
        "status": target_status,
        "note": (data.get("note") or "")[:2000],
    }

    # Конфликт 1: проба уже в терминальном статусе на сервере.
    if item.sample.status in _TERMINAL_SAMPLE_STATUSES:
        _create_task(
            task_type=ActualizationTask.TYPE_SAMPLE_STATUS_CONFLICT,
            entity_type="Sample",
            entity_id=item.sample_id,
            server_value={"status": item.sample.status},
            mobile_value=mobile_value,
            payload={
                "device_id": device_id,
                "operation_id": op.get("op_id"),
                "pick_list_item_id": entity_id,
            },
        )
        return "conflict"

    # Конфликт 2: строка уже отправлена (SENT) — менять нельзя.
    if item.status == PickListItem.STATUS_SENT:
        _create_task(
            task_type=ActualizationTask.TYPE_PICK_LIST_CONFLICT,
            entity_type="PickListItem",
            entity_id=entity_id,
            server_value={"status": item.status},
            mobile_value=mobile_value,
            payload={
                "device_id": device_id,
                "operation_id": op.get("op_id"),
            },
        )
        return "conflict"

    # Применяем.
    item.status = target_status
    item.picked_at = timezone.now()
    if user and getattr(user, "is_authenticated", False):
        item.picked_by = user
    if mobile_value["note"]:
        item.note = mobile_value["note"]
    item.save(update_fields=["status", "picked_at", "picked_by", "note"])
    return "applied"


def _apply_place_op(op: dict, user, device_id: str) -> bool:
    """
    Класс B: PLACE — mobile прав, всегда применяем.

    Если `server_updated_at` (что mobile видел в кэше) расходится
    с текущим `updated_at` на сервере — создаём `ActualizationTask`
    `CONTAINER_MISPLACED` (сигнал «у сервера были вопросы», рабочий
    сходит проверит). Операция всё равно применяется.

    Возвращает `True`, если создана задача, `False` иначе.
    """
    entity_id = op["entity_id"]
    data = op.get("data") or {}
    cell_id = data.get("cell_id")
    floor_room_id = data.get("floor_room_id")

    if not cell_id and not floor_room_id:
        raise ValueError(
            f"PLACE для тары #{entity_id}: укажите cell_id или floor_room_id."
        )

    container = Container.objects.filter(pk=entity_id).first()
    if container is None:
        raise ValueError(f"Тара #{entity_id} не найдена.")

    server_updated_at = (op.get("server_updated_at") or "").strip()
    actual_updated_at = (
        container.updated_at.isoformat() if container.updated_at else ""
    )

    result, error = bulk_place_containers(
        container_ids=[entity_id],
        cell_id=cell_id,
        floor_room_id=floor_room_id,
        user=user,
    )
    if error:
        raise ValueError(error["error"])

    # Задача, если был expected_updated_at и он не совпал.
    if server_updated_at and server_updated_at != actual_updated_at:
        _create_task(
            task_type=ActualizationTask.TYPE_CONTAINER_MISPLACED,
            entity_type="Container",
            entity_id=entity_id,
            server_value={"updated_at": actual_updated_at},
            mobile_value={
                "cell_id": cell_id,
                "floor_room_id": floor_room_id,
            },
            payload={
                "device_id": device_id,
                "operation_id": op.get("op_id"),
                "expected_updated_at": server_updated_at,
            },
        )
        return True

    return False


def _apply_receiving_batch(
    receipt_id: int,
    ops: list[dict],
    user,
    device_id: str,
) -> dict:
    """
    Групповое применение RECEIVING_MATCH / RECEIVING_MISSING
    для одного Receipt через `check_receipt`.

    Возвращает `{"applied", "conflicts", "tasks", "errors"}`.
    """
    result = {"applied": 0, "conflicts": 0, "tasks": 0, "errors": []}

    receipt = Receipt.objects.filter(pk=receipt_id).first()
    if receipt is None:
        result["errors"].append({
            "error": f"Receipt #{receipt_id} не найден.",
        })
        return result

    existing_ids = set(
        ReceiptItem.objects
        .filter(receipt=receipt)
        .values_list("id", flat=True)
    )

    valid_items: list[dict] = []

    for op in ops:
        item_id = op["entity_id"]
        data = op.get("data") or {}
        is_match = op["type"] == "RECEIVING_MATCH"
        mobile_value = {
            "matched": is_match,
            "container_number": data.get("container_number"),
        }

        if item_id not in existing_ids:
            _create_task(
                task_type=ActualizationTask.TYPE_RECEIPT_ITEM_DELETED,
                entity_type="ReceiptItem",
                entity_id=item_id,
                server_value=None,
                mobile_value=mobile_value,
                payload={
                    "device_id": device_id,
                    "operation_id": op.get("op_id"),
                    "receipt_id": receipt_id,
                },
            )
            result["conflicts"] += 1
            result["tasks"] += 1
            continue

        valid_items.append({
            "item_id": item_id,
            "matched": is_match,
            "container_number": data.get("container_number"),
        })

    if valid_items:
        summary, errors = check_receipt(receipt, valid_items)
        if errors:
            result["errors"].extend(errors)
        else:
            result["applied"] += (
                int(summary.get("matched_count", 0))
                + int(summary.get("missing_count", 0))
            )

    return result


def apply_offline_export(payload: dict, user) -> dict:
    """
    Применить офлайн-экспорт (mobile → server).

    Возвращает:
        {
          "applied": int,
          "conflicts": int,
          "tasks_created": int,
          "errors": [{"op_id"?: str, "error": str}, ...],
        }

    Исключения `ValueError` → 400 на уровне view.
    """
    if payload.get("format") != "WMSG-OFFLINE-EXCHANGE":
        raise ValueError(
            f"Неверный формат: {payload.get('format')!r}. "
            "Ожидается 'WMSG-OFFLINE-EXCHANGE'."
        )
    if payload.get("version") != 1:
        raise ValueError(
            f"Неподдерживаемая версия: {payload.get('version')!r}. "
            "Ожидается 1."
        )

    operations = payload.get("operations") or []
    if not operations:
        raise ValueError("Пустой список операций.")

    context = payload.get("task_context") or {}
    device_id = payload.get("device_id", "")
    receipt_id = context.get("receipt_id")

    applied = 0
    conflicts = 0
    tasks_created = 0
    errors: list[dict] = []

    # Разделяем операции: RECEIVING_* — батчем по receipt, остальные — поштучно.
    receiving_ops: list[dict] = []
    other_ops: list[dict] = []
    for op in operations:
        if op.get("type") in ("RECEIVING_MATCH", "RECEIVING_MISSING"):
            receiving_ops.append(op)
        else:
            other_ops.append(op)

    with transaction.atomic():
        # 1. Не-receiving операции.
        for op in other_ops:
            op_id = op.get("op_id", "?")
            op_type = op.get("type")
            try:
                if op_type == "DISPOSE_SAMPLE":
                    _apply_dispose_sample(op, user, device_id)
                    applied += 1
                elif op_type in ("PICKED", "NOT_FOUND"):
                    result = _apply_pick_item(op, user, device_id)
                    if result == "applied":
                        applied += 1
                    else:
                        conflicts += 1
                        tasks_created += 1
                elif op_type == "PLACE":
                    task_created = _apply_place_op(op, user, device_id)
                    applied += 1
                    if task_created:
                        tasks_created += 1
                else:
                    errors.append({
                        "op_id": op_id,
                        "error": f"Неизвестный тип операции: {op_type!r}.",
                    })
            except ValueError as exc:
                errors.append({"op_id": op_id, "error": str(exc)})
            except Exception as exc:  # noqa: BLE001
                logger.exception("offline_import: unexpected error on %s", op_id)
                errors.append({
                    "op_id": op_id,
                    "error": f"Внутренняя ошибка: {exc}",
                })

        # 2. RECEIVING_* — батчем по receipt_id.
        if receiving_ops:
            if not receipt_id:
                errors.append({
                    "error": (
                        "В task_context нет `receipt_id`, "
                        "а операции RECEIVING_* требуют его."
                    ),
                })
            else:
                res = _apply_receiving_batch(
                    receipt_id, receiving_ops, user, device_id,
                )
                applied += res["applied"]
                conflicts += res["conflicts"]
                tasks_created += res["tasks"]
                errors.extend(res["errors"])

    logger.info(
        "offline_import: applied=%d conflicts=%d tasks=%d errors=%d",
        applied, conflicts, tasks_created, len(errors),
    )
    return {
        "applied": applied,
        "conflicts": conflicts,
        "tasks_created": tasks_created,
        "errors": errors,
    }