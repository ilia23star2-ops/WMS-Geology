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
    Sample.STATUS_CONSUMED,
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
    - Пробы в «защищённых» статусах (DISPOSED, CONSUMED, SELECTED)
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