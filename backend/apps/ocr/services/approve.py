"""Превращение распознанной OcrTask в Container + Sample.

c-6f-1: priority payload.cell_id > batch.cell_id.
c-6e-1a: priority payload.cell_id > task.cell_id > batch.cell_id.
"""
from django.db import transaction
from django.utils import timezone

from apps.storage.models import Container, ContainerType
from apps.storage.services import fill_container_with_samples
from apps.storage.services.bulk_place import bulk_place_containers
from apps.users.services import log_audit


def approve_task(task, payload, user):
    """Применяет reviewed_data к OcrTask.

    Создаёт Container (PENDING_FILLING), заполняет пробами через
    fill_container_with_samples. Если есть cell_id — размещает через
    bulk_place_containers → Container.ACTIVE.

    Приоритет cell_id: payload.cell_id > task.cell_id > task.batch.cell_id > None.

    Возвращает dict {container_id, samples_created, batch_completed}.
    """
    if task.status == 'DONE':
        raise ValueError('Задача уже подтверждена.')

    container_type_id = payload['container_type_id']
    try:
        container_type = ContainerType.objects.get(pk=container_type_id)
    except ContainerType.DoesNotExist:
        raise ValueError(f'Тип тары #{container_type_id} не найден.')

    # c-6e-1a: priority payload > task > batch.
    cell_id = payload.get('cell_id')
    if not cell_id:
        cell_id = task.cell_id
    if not cell_id and task.batch:
        cell_id = task.batch.cell_id

    with transaction.atomic():
        container = Container.objects.create(
            container_number=payload.get('container_number') or None,
            container_type=container_type,
            status=Container.STATUS_PENDING_FILLING,
        )

        samples = fill_container_with_samples(
            container=container,
            container_number=payload.get('container_number'),
            work_order_coded=payload['work_order_coded'],
            work_order_incoming=payload.get('work_order_incoming', ''),
            research_type_id=payload['research_type_id'],
            site_id=payload.get('site_id'),
            sample_groups=payload['sample_groups'],
        )

        if cell_id:
            result, error = bulk_place_containers(
                container_ids=[container.pk],
                cell_id=cell_id,
                floor_room_id=None,
                user=user,
            )
            if error:
                raise ValueError(error.get('error', 'Ошибка размещения.'))
            container.refresh_from_db()

        task.reviewed_data = {**payload, 'container_id': container.pk}
        task.status = 'DONE'
        task.save(update_fields=['reviewed_data', 'status'])

        batch = task.batch
        batch_completed = False
        if not batch.tasks.exclude(status='DONE').exists():
            batch.status = 'COMPLETED'
            batch.processed_at = timezone.now()
            batch.save(update_fields=['status', 'processed_at'])
            batch_completed = True
        elif batch.status in ('DRAFT', 'SENT'):
            batch.status = 'REVIEW'
            batch.save(update_fields=['status'])

        log_audit(
            user=user,
            action='CREATE',
            entity_type='Container',
            entity_id=container.pk,
            old_value=None,
            new_value={
                'container_number': container.container_number,
                'status': container.status,
                'created_samples': len(samples),
                'source': 'ocr_approve',
                'ocr_task_id': task.pk,
                'placed_to_cell_id': cell_id,
            },
        )

    return {
        'container_id': container.pk,
        'samples_created': len(samples),
        'batch_completed': batch_completed,
    }