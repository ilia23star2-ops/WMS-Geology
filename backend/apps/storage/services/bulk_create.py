"""
Сервисы bulk-операций с тарой и пробами.
"""

from django.db import transaction

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample, Well
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
    """
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

    new_number = (container_number or "").strip() or None
    # ФИКС: Удалена проверка на уникальность container_number.
    # Теперь номер уникален только в рамках группы (Н/З × ТИ).

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

        # ФИКС: Берем статус из запроса (NORMAL / SELECTED)
        group_status = gdata.get("status", "NORMAL")
        sample_status = (
            Sample.STATUS_SELECTED
            if group_status == "SELECTED"
            else Sample.STATUS_PENDING_PLACEMENT
        )

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
                status=sample_status,
            )
            created.append(sample)

    # 4. Обновить тару: номер, статус.
    update_fields: list[str] = []
    if new_number and not container.container_number:
        container.container_number = new_number
        update_fields.append("container_number")

    if container.status == Container.STATUS_PENDING_FILLING:
        container.status = Container.STATUS_PENDING_PLACEMENT
        update_fields.append("status")

    # draft-поля НЕ обнуляем, чтобы они оставались в интерфейсе (фикс 2f-7f)
    
    if update_fields:
        container.save(update_fields=update_fields)

    return created