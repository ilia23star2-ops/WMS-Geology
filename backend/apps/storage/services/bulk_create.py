"""
Сервисы bulk-операций с тарой и пробами.

Разделены на две функции (bundle-7a-2):

1. `bulk_create_containers` — только тары со статусом
   `PENDING_PLACEMENT`. Никаких проб и Н/З.

2. `fill_container_with_samples` — заполнение существующей тары
   пробами. Тут же наряд-заказы (CODED + опц. INCOMING),
   скважины и пробы.

Обе — атомарные, явные вызовы, без Django signals.
"""

from django.db import transaction

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample, Well
from apps.samples.services import sync_sample_status_for_container
from apps.storage.models import Container
from apps.work_orders.models import WorkOrder


@transaction.atomic
def bulk_create_containers(*, containers_data: list[dict]) -> list[Container]:
    """
    Создать N тар без проб.

    Все тары получают статус `PENDING_PLACEMENT` — место определяется
    отдельным шагом (решение 1.47).

    :param containers_data: список словарей
        `{"container_number": str, "container_type_id": int}`.
    :returns: список созданных `Container`.
    :raises: `ValueError` при ошибке в данных.
    """
    created: list[Container] = []
    for cdata in containers_data:
        container = Container.objects.create(
            container_number=cdata["container_number"],
            container_type_id=cdata["container_type_id"],
            status=Container.STATUS_PENDING_PLACEMENT,
        )
        created.append(container)
    return created


@transaction.atomic
def fill_container_with_samples(
    *,
    container: Container,
    work_order_coded: str,
    work_order_incoming: str = "",
    research_type_id: int,
    site_id: int | None = None,
    sample_groups: list[dict],
) -> list[Sample]:
    """
    Заполнить существующую тару пробами.

    Правила:
    - одна тара = один тип исследования; при попытке добавить пробы
      другого ТИ в тару, где уже есть пробы — `ValueError`;
    - `work_order_coded` — найти или создать CODED Н/З;
    - `work_order_incoming` — если задан, найти/создать INCOMING
      и связать `linked_order` в обе стороны;
    - `well_name` в группе — найти или создать `Well`
      (для нешифрованных);
    - статус проб синхронизируется со статусом тары
      через `sync_sample_status_for_container`.

    :returns: список созданных `Sample`.
    :raises: `ValueError` при ошибке (не найдены справочники,
        конфликт типа исследования).
    """
    rt = ResearchType.objects.filter(pk=research_type_id).first()
    if rt is None:
        raise ValueError(f"Тип исследования #{research_type_id} не найден.")

    # Одна тара = один тип исследования.
    existing_type_ids = set(
        container.samples.values_list("research_type_id", flat=True)
    )
    if existing_type_ids and existing_type_ids != {research_type_id}:
        raise ValueError(
            "В таре уже есть пробы другого типа исследования. "
            "Одна тара = один тип исследования."
        )

    site = None
    if site_id is not None:
        site = Site.objects.filter(pk=site_id).first()
        if site is None:
            raise ValueError(f"Участок #{site_id} не найден.")

    # 1. CODED Н/З.
    wo_coded, _ = WorkOrder.objects.get_or_create(
        order_number=work_order_coded,
        order_type=WorkOrder.TYPE_CODED,
        defaults={"site": site},
    )
    if site is not None and wo_coded.site_id is None:
        wo_coded.site = site
        wo_coded.save(update_fields=["site"])

    # 2. INCOMING Н/З (если указан).
    incoming = (work_order_incoming or "").strip()
    if incoming:
        wo_incoming, _ = WorkOrder.objects.get_or_create(
            order_number=incoming,
            order_type=WorkOrder.TYPE_INCOMING,
            defaults={"site": site},
        )
        if wo_coded.linked_order_id != wo_incoming.pk:
            wo_coded.linked_order = wo_incoming
            wo_coded.save(update_fields=["linked_order"])
        if wo_incoming.linked_order_id != wo_coded.pk:
            wo_incoming.linked_order = wo_coded
            wo_incoming.save(update_fields=["linked_order"])

    # 3. Пробы.
    created: list[Sample] = []
    for gdata in sample_groups:
        well = None
        well_name = (gdata.get("well_name") or "").strip()
        if well_name:
            well = Well.objects.filter(well_name=well_name).first()
            if well is None:
                well = Well.objects.create(well_name=well_name)

        prefix = gdata["prefix"]
        middle = gdata["middle"]
        digits = gdata.get("sequence_digits", 3)
        start = gdata["sequence_from"]
        end = gdata["sequence_to"]

        for seq in range(start, end + 1):
            full_number = f"{prefix}{middle}{seq:0{digits}d}"
            sample = Sample.objects.create(
                sample_number=full_number,
                research_type=rt,
                well=well,
                site=site,
                container=container,
                current_work_order=wo_coded,
                status=Sample.STATUS_IN_STORAGE,  # временно, ниже sync
            )
            created.append(sample)

    # Синхронизируем статус проб со статусом тары.
    sync_sample_status_for_container(container)

    return created