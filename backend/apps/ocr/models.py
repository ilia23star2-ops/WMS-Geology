from django.db import models
from django.conf import settings
from apps.storage.models import Cell


class OcrBatch(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Черновик'),
        ('UPLOADING', 'Загрузка фото'),
        ('PROCESSING', 'Распознавание на сервере'),
        ('SENT', 'Отправлен'),               # 6e-1a: после «Отправить на сервер»
        ('REVIEW', 'Готово к проверке'),
        ('COMPLETED', 'Подтверждено и создано'),
        ('FAILED', 'Ошибка'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name='Пользователь')
    cell = models.ForeignKey(
        Cell, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name='Ячейка (legacy, если batch = одна ячейка)',
        help_text='6e-1a: обычно пусто — ячейка хранится в OcrTask.cell',
    )
    name = models.CharField(
        max_length=120, blank=True, default='',
        verbose_name='Имя пакета (6e-3-backend)',
        help_text='Пусто = безымянный; автоимя «ячейка + дата» ставится при создании.',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT', verbose_name='Статус')
    sent_at = models.DateTimeField(
        null=True, blank=True,
        verbose_name='Дата отправки (6e-1a)',
        help_text='Мобилка нажала «Отправить на сервер» — все фото распознаны.',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата обработки (все задачи DONE)')

    class Meta:
        verbose_name = 'Пакет оцифровки'
        verbose_name_plural = 'Пакеты оцифровки'
        ordering = ['-created_at']

    def __str__(self):
        return f'Пакет #{self.id} ({self.get_status_display()}) - {self.user.username}'


class OcrTask(models.Model):
    STATUS_CHOICES = [
        ('PENDING', 'Ожидает загрузки'),
        ('PROCESSING', 'В процессе'),
        ('READY', 'Распознано (ожидает проверки)'),
        ('DONE', 'Успешно подтверждено'),
        ('ERROR', 'Ошибка распознавания'),
    ]

    ZONE_TYPES = [
        ('work_order_coded', 'Н/З (текущий)'),
        ('work_order_incoming', 'Н/З (входящий)'),
        ('container_number', 'Номер тары'),
        ('research_type', 'Тип исследования'),
        ('sample', 'Проба'),
        ('site', 'Участок'),
    ]

    batch = models.ForeignKey(OcrBatch, on_delete=models.CASCADE, related_name='tasks', verbose_name='Пакет')
    image = models.ImageField(upload_to='ocr_tasks/%Y/%m/%d/', verbose_name='Фото')
    cell = models.ForeignKey(
        Cell, on_delete=models.SET_NULL, null=True, blank=True,
        verbose_name='Ячейка (6e-1a)',
        help_text='Из мобилки: оператор выбрал ячейку перед фото. Approve → Pallet + ACTIVE.',
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name='Статус')
    raw_ocr_data = models.JSONField(null=True, blank=True, verbose_name='Сырые данные OCR')
    reviewed_data = models.JSONField(null=True, blank=True, verbose_name='Подтвержденные данные')
    zones = models.JSONField(
        null=True, blank=True,
        verbose_name='Разметка зон',
        help_text='JSON-массив [{type, bbox, source}, ...].',
    )
    error_message = models.TextField(blank=True, default='', verbose_name='Ошибка')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')

    class Meta:
        verbose_name = 'Задача оцифровки'
        verbose_name_plural = 'Задачи оцифровки'

    def __str__(self):
        return f'Фото #{self.id} из пакета #{self.batch_id} ({self.get_status_display()})'


class OcrMemoryEntry(models.Model):
    """Память исправлений OCR (6e-5-ocr-memory, решение 1.127).

    Подтверждённые оператором пары «сырой токен → значение справочника».
    Заход 1: только модель. Источник обучения — только approve (1А),
    совпадение точное по канонизированному токену (2А), храним код
    справочника, а не FK (3А). Номер тары и даты не учим.
    """

    ZONE_TYPE_CHOICES = [
        ('site', 'Участок'),
        ('research_type', 'Тип исследования'),
        ('work_order_coded', 'Н/З (текущий)'),
        ('work_order_incoming', 'Н/З (входящий)'),
    ]

    zone_type = models.CharField(
        max_length=32, choices=ZONE_TYPE_CHOICES, db_index=True,
        verbose_name='Тип зоны',
    )
    raw_token = models.CharField(
        max_length=120, db_index=True,
        verbose_name='Сырой токен (канонизированный)',
        help_text='Токен из extracted после canon.canon_text.',
    )
    resolved_value = models.CharField(
        max_length=120,
        verbose_name='Значение (код справочника)',
        help_text='Код справочника, который подтвердил оператор.',
    )
    hit_count = models.PositiveIntegerField(
        default=0, verbose_name='Совпадений',
        help_text='Сколько раз память сработала при резолве.',
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Кто подтвердил',
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    last_used_at = models.DateTimeField(
        null=True, blank=True, verbose_name='Последнее использование',
    )

    class Meta:
        verbose_name = 'Память исправления OCR'
        verbose_name_plural = 'Память исправлений OCR'
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['zone_type', 'raw_token'],
                name='uniq_ocr_memory_zone_raw',
            ),
        ]

    def __str__(self):
        return f'{self.get_zone_type_display()}: {self.raw_token} → {self.resolved_value}'