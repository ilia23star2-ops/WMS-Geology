"""
Снимок Container для AuditLog (3.x-offline-sync-b-4).

Вынесено из `apps/storage/views.py::_container_snapshot`, чтобы
использовать и в views, и в `services/bulk_place.py` без цикла
импортов (`views.py` ↔ `services/bulk_place.py`).
"""


def container_snapshot(container) -> dict:
    """
    Компактный снимок тары для AuditLog (вариант А из 1.70).

    Единый формат `old_value` / `new_value` для всех действий.
    `sample_count` — реальный из БД; для удалённой тары вызывается
    ДО удаления, снимок верен.
    """
    return {
        "status": container.status,
        "container_number": container.container_number,
        "container_type_id": container.container_type_id,
        "pallet_id": container.pallet_id,
        "floor_room_id": container.floor_room_id,
        "sample_count": container.samples.count() if container.pk else 0,
    }