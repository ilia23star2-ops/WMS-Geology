"""
Сервис bulk-создания тары с пробами.

Логика:
1. Найти или создать `WorkOrder` (CODED) по `work_order_coded`.
2. Если указан `work_order_incoming` — найти или создать (INCOMING)
   и связать через `linked_order` в обе стороны.
3. Для каждой тары из запроса:
   - создать `Container` со статусом `PENDING_PLACEMENT`;
   - для каждой группы проб:
     - если задан `well_name` — найти или создать `Well`;
     - сгенерировать полные номера проб и создать `Sample`.
"""

from django.db import transaction

from apps.samples.catalogs import ResearchType, Site
from apps.samples.models import Sample, Well
from apps.work_orders.models import WorkOrder

from ..models import Container


@transaction.atomic
def bulk_create_containers_with_samples(
    *,
    work_order_coded: str,
    work_order_incoming: str,
    research_type_id: int,
    site_id: int | None,
    containers_data: list[dict],
) -> list[Container]:
    """
    Создаёт тары с пробами.

    :returns: список созданных `Container`.
    :raises: `ValueError` при ошибке (не найдены справочники и т.п.).
    """
    rt = ResearchType.objects.filter(pk=research_type_id).first()
    if rt is None:
        raise ValueError(f"Тип исследования #{research_type_id} не найден.")

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
        # Связь в обе стороны.
        if wo_coded.linked_order_id != wo_incoming.pk:
            wo_coded.linked_order = wo_incoming
            wo_coded.save(update_fields=["linked_order"])
        if wo_incoming.linked_order_id != wo_coded.pk:
            wo_incoming.linked_order = wo_coded
            wo_incoming.save(update_fields=["linked_order"])

    # 3. Тары и пробы.
    created_containers: list[Container] = []
    for cdata in containers_data:
        container = Container.objects.create(
            container_number=cdata["container_number"],
            container_type_id=cdata["container_type_id"],
            status=Container.STATUS_PENDING_PLACEMENT,
        )
        created_containers.append(container)

        for gdata in cdata["sample_groups"]:
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
                Sample.objects.create(
                    sample_number=full_number,
                    research_type=rt,
                    well=well,
                    site=site,
                    container=container,
                    current_work_order=wo_coded,
                    status=Sample.STATUS_IN_STORAGE,
                )

    return created_containers