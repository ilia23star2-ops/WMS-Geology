"""
Сервис размещения тар в ячейку или на пол (3.x-offline-sync-b-4).

Перенесено из `ContainerViewSet.bulk_place`, чтобы вызывать
и из API (view), и из `offline_import` (mobile).

Поведение 1:1 с view до выноса:
- 400 — валидация (пустой container_ids, нет cell_id/floor_room_id);
- 404 — не найдено (тары / ячейка / комната);
- успех — аудит PLACE на каждую тару, sync_sample_status.
"""

from django.db import transaction

from apps.samples.services import sync_sample_status_for_container
from apps.users.services import log_audit

from ..models import Cell, Container, Pallet, Room
from .snapshot import container_snapshot


def bulk_place_containers(
    *,
    container_ids: list[int],
    cell_id: int | None = None,
    floor_room_id: int | None = None,
    user=None,
) -> tuple[dict | None, dict | None]:
    """
    Разместить тары в ячейку (через поддон) или на пол в комнате.

    :returns: `(result, error)`.
      - при успехе: `({"message": "...", "moved": N}, None)`.
      - при ошибке: `(None, {"error": "...", "status": 400 или 404})`.
    """
    if not container_ids:
        return None, {"error": "Укажите container_ids.", "status": 400}
    if not cell_id and not floor_room_id:
        return None, {
            "error": "Укажите cell_id или floor_room_id.",
            "status": 400,
        }

    containers = Container.objects.filter(pk__in=container_ids)
    if not containers.exists():
        return None, {"error": "Тары не найдены.", "status": 404}

    target_pallet = None
    target_cell = None
    target_room = None
    msg = ""

    if cell_id:
        target_cell = Cell.objects.filter(pk=cell_id, is_active=True).first()
        if not target_cell:
            return None, {
                "error": "Ячейка не найдена или неактивна.",
                "status": 404,
            }
        target_pallet, _ = Pallet.objects.get_or_create(
            cell=target_cell,
            defaults={"status": Pallet.STATUS_ACTIVE},
        )
        msg = (
            f"Успешно размещено в ячейку {target_cell.full_address}: "
            f"{len(containers)} тар."
        )
    else:
        target_room = Room.objects.filter(pk=floor_room_id).first()
        if not target_room:
            return None, {"error": "Комната не найдена.", "status": 404}
        msg = (
            f"Успешно размещено на пол в комнате "
            f"{target_room.name}: {len(containers)} тар."
        )

    moved = 0
    audit_user = user if (user and user.is_authenticated) else None

    with transaction.atomic():
        for c in containers:
            old_value = container_snapshot(c)
            if target_cell:
                c.pallet = target_pallet
                c.floor_room = None
            else:
                c.pallet = None
                c.floor_room = target_room

            c.status = Container.STATUS_ACTIVE
            c.save(update_fields=["pallet", "floor_room", "status"])
            sync_sample_status_for_container(c)
            log_audit(
                user=audit_user,
                action="PLACE",
                entity_type="Container",
                entity_id=c.pk,
                old_value=old_value,
                new_value=container_snapshot(c),
            )
            moved += 1

    return {"message": msg, "moved": moved}, None