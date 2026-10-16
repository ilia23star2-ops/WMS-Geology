"""
Сервисы bulk-операций с тарой и пробами.

Разделены на две функции (bundle-7a-2):

1. `bulk_create_containers` — создание N тар-заготовок без проб.
   Draft-поля (участок, ТИ, Н/З) сохраняются для последующего
   заполнения. `container_number` опционален.

2. `fill_container_with_samples` — заполнение существующей тары
   пробами. Присваивает `container_number` (если был NULL),
   создаёт Н/З, `Well`, `Sample`. Обнуляет draft-поля.
   Переводит статус тары из `PENDING_FILLING` в
   `PENDING_PLACEMENT`.

Обе — атомарные, явные вызовы, без Django signals.
"""

from django.db import transaction

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample, Well
from apps.samples.services import sync_sample_status_for_container
from apps.storage.models import Container
from apps.work_orders.models import WorkOrder


@transaction.atomic
def bulk_create_containers(
    *,
    containers_data: list[dict],
    draft_site_id: int | None = None,
    draft_research_type_id: int | None = None,
    draft_work_order_coded: str = "",
    draft_work_order_incoming: str = "",
) -> list[Container]:
    """
    Создать N тар-заготовок без проб.

    Все тары получают статус `PENDING_FILLING` — «Ожидает заполнения»:
    тара создана, пробы ещё не положены. После `fill-samples` тара
    переходит в `PENDING_PLACEMENT`.

    Draft-поля (`draft_site`, `draft_research_type`,
    `draft_work_order_coded`, `draft_work_order_incoming`) —
    общие для всей партии. Сохраняются на таре, чтобы форма
    заполнения пробами была предзаполнена.

    `container_number` в каждом элементе `containers_data` опционален.
    Если не указан (или пустая строка) — тара создаётся без номера.

    :param containers_data: список словарей
        `{"container_number": str | None, "container_type_id": int}`.
    :returns: список созданных `Container`.
    :raises: `ValueError` при ошибке в данных.
    """
    # Валидация draft-полей (если заданы).
    if draft_site_id is not None:
        if not Site.objects.filter(pk=draft_site_id).exists():
            raise ValueError(f"Участок #{draft_site_id} не найден.")

    if draft_research_type_id is not None:
        if not ResearchType.objects.filter(pk=draft_research_type_id).exists():
            raise ValueError(
                f"Тип исследования #{draft_research_type_id} не найден."
            )

    created: list[Container] = []
    for cdata in containers_data:
        container = Container.objects.create(
            container_number=cdata.get("container_number") or None,
            container_type_id=cdata["container_type_id"],
            status=Container.STATUS_PENDING_FILLING,
            draft_site_id=draft_site_id,
            draft_research_type_id=draft_research_type_id,
            draft_work_order_coded=draft_work_order_coded or "",
            draft_work_order_incoming=draft_work_order_incoming or "",
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
    container_number: str | None = None,
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
    - `container_number` — если задан и у тары номер ещё не присвоен,
      присвоить (с проверкой уникальности);
    - draft-поля тары обнуляются после успешного заполнения;
    - если тара была в статусе `PENDING_FILLING`, после заполнения
      она переходит в `PENDING_PLACEMENT`;
    - статус проб синхронизируется со статусом тары
      через `sync_sample_status_for_container`.

    :returns: список созданных `Sample`.
    :raises: `ValueError` при ошибке (не найдены справочники,
        конфликт типа исследования, конфликт номера тары).
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

    # Проверка присваиваемого номера тары.
    new_number = (container_number or "").strip() or None
    if new_number and not container.container_number:
        if Container.objects.filter(container_number=new_number).exclude(
            pk=container.pk,
        ).exists():
            raise ValueError(
                f"Тара с номером {new_number} уже существует."
            )

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

    # 4. Обновить тару: номер, статус, draft-поля.
    update_fields: list[str] = []
    if new_number and not container.container_number:
        container.container_number = new_number
        update_fields.append("container_number")

    # PENDING_FILLING → PENDING_PLACEMENT (после появления проб).
    if container.status == Container.STATUS_PENDING_FILLING:
        container.status = Container.STATUS_PENDING_PLACEMENT
        update_fields.append("status")

    if container.draft_site_id:
        container.draft_site = None
        update_fields.append("draft_site")
    if container.draft_research_type_id:
        container.draft_research_type = None
        update_fields.append("draft_research_type")
    if container.draft_work_order_coded:
        container.draft_work_order_coded = ""
        update_fields.append("draft_work_order_coded")
    if container.draft_work_order_incoming:
        container.draft_work_order_incoming = ""
        update_fields.append("draft_work_order_incoming")

    if update_fields:
        container.save(update_fields=update_fields)

    # 5. Синхронизируем статус проб со статусом тары.
    sync_sample_status_for_container(container)

    return created