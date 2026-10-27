"""
Сервис заполнения тары пробами (2f-9b).
"""

from apps.samples.models import Sample, Well
from apps.work_orders.models import WorkOrder


def fill_container_with_samples(
    container,
    container_number: str | None,
    work_order_coded: str,
    work_order_incoming: str,
    research_type_id: int,
    site_id: int | None,
    sample_groups: list[dict],
) -> list[Sample]:
    """
    Создаёт пробы в таре.
    """
    if container_number and not container.container_number:
        container.container_number = container_number
        container.save(update_fields=["container_number"])

    # Ищем или создаём WorkOrder
    work_order = WorkOrder.objects.filter(
        order_number=work_order_coded,
        order_type="CODED",
    ).first()
    if not work_order:
        work_order = WorkOrder.objects.create(
            order_number=work_order_coded,
            order_type="CODED",
        )

    created_samples = []

    for group in sample_groups:
        # Определяем статус (2f-9b)
        group_status = group.get("status", "NORMAL")
        sample_status = (
            Sample.STATUS_SELECTED 
            if group_status == "SELECTED" 
            else Sample.STATUS_PENDING_PLACEMENT
        )

        well = None
        well_name = group.get("well_name")
        if well_name:
            well, _ = Well.objects.get_or_create(well_name=well_name)

        prefix = group["prefix"]
        middle = group["middle"]
        seq_from = group["sequence_from"]
        seq_to = group["sequence_to"]
        seq_digits = group["sequence_digits"]

        for i in range(seq_from, seq_to + 1):
            seq_str = str(i).zfill(seq_digits)
            sample_number = f"{prefix}{middle}{seq_str}"
            
            sample = Sample.objects.create(
                sample_number=sample_number,
                research_type_id=research_type_id,
                container=container,
                current_work_order=work_order,
                site_id=site_id,
                well=well,
                status=sample_status,
            )
            created_samples.append(sample)

    return created_samples