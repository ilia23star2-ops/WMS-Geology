"""
Сервисы приложения «Пробы».

Явные функции — без Django signals.
Вызываются из views / других сервисов в конкретных точках
изменения статуса тары.
"""

from apps.samples.models import Sample
from apps.storage.models import Container


# Статусы проб, которые управляются отдельно и не должны
# перезаписываться при синхронизации со статусом тары.
_PROTECTED_SAMPLE_STATUSES = frozenset({
    Sample.STATUS_DISPOSED,
    Sample.STATUS_SELECTED,  # 2f-9c: Защищаем "выбранные" пробы
})


# Маппинг: статус тары → статус пробы внутри неё.
_CONTAINER_TO_SAMPLE_STATUS = {
    Container.STATUS_ACTIVE: Sample.STATUS_IN_STORAGE,
    Container.STATUS_PENDING_PLACEMENT: Sample.STATUS_PENDING_PLACEMENT,
    Container.STATUS_IN_TRANSIT: Sample.STATUS_IN_TRANSIT,
}


def sync_sample_status_for_container(container: Container) -> int:
    """
    Синхронизирует статус проб внутри тары со статусом самой тары.

    Возвращает количество обновлённых проб.

    Правила:
    - Пробы в «защищённых» статусах (DISPOSED, SELECTED)
      не трогаются — они управляются отдельно.
    - Неизвестный статус тары → 0 обновлений, без исключений.

    Вызывается явно из view / сервисов после изменения статуса тары.
    Django signals не используются.
    """
    new_status = _CONTAINER_TO_SAMPLE_STATUS.get(container.status)
    if new_status is None:
        return 0

    return (
        container.samples
        .exclude(status__in=_PROTECTED_SAMPLE_STATUSES)
        .update(status=new_status)
    )

# ============================================================
# c-2.x-lifecycle-1 (решение 1.109): утилизация/восстановление тары
# ============================================================

def _handle_container_after_dispose(container: Container) -> str:
    """
    После утилизации пробы — проверить тару.

    Если в таре остались «живые» (не-DISPOSED) пробы — статус тары
    не меняем. Если нет:
    - `container_type.is_disposable=True` → `Container.DISPOSED`;
    - `False` (многоразовая) → `Container.PENDING_FILLING`.

    Возвращает новый (или текущий) статус тары.
    """
    has_alive = (
        container.samples
        .exclude(status=Sample.STATUS_DISPOSED)
        .exists()
    )
    if has_alive:
        return container.status

    is_disposable = bool(
        container.container_type and container.container_type.is_disposable
    )
    new_status = (
        Container.STATUS_DISPOSED
        if is_disposable
        else Container.STATUS_PENDING_FILLING
    )
    if container.status != new_status:
        container.status = new_status
        container.save(update_fields=["status", "updated_at"])
    return new_status


def _handle_container_after_restore(container: Container) -> str:
    """
    После восстановления пробы из DISPOSED — вернуть тару.

    Тара могла быть в `DISPOSED` (все пробы утилизированы) или
    `PENDING_FILLING` (многоразовая, этикетку сорвали).

    - Если у тары есть место (`pallet` / `floor_room`) → `ACTIVE`.
    - Иначе → `PENDING_FILLING` (надо разместить).

    Возвращает новый (или текущий) статус тары.
    """
    if container.status not in (
        Container.STATUS_DISPOSED,
        Container.STATUS_PENDING_FILLING,
    ):
        return container.status

    has_place = (
        container.pallet_id is not None
        or container.floor_room_id is not None
    )
    # c-2.x-lifecycle-1-fix: если места нет, но проба есть —
    # это PENDING_PLACEMENT (не PENDING_FILLING: проба уже в таре).
    new_status = (
        Container.STATUS_ACTIVE
        if has_place
        else Container.STATUS_PENDING_PLACEMENT
    )
    if container.status != new_status:
        container.status = new_status
        container.save(update_fields=["status", "updated_at"])
    return new_status
