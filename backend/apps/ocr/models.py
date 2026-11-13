from django.db import models
from django.conf import settings
from apps.storage.models import Cell


class OcrBatch(models.Model):
    STATUS_CHOICES = [
        ('DRAFT', 'Черновик'),
        ('UPLOADING', 'Загрузка фото'),
        ('PROCESSING', 'Распознавание на сервере'),
        ('REVIEW', 'Готово к проверке'),
        ('COMPLETED', 'Подтверждено и создано'),
        ('FAILED', 'Ошибка'),
    ]
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, verbose_name='Пользователь')
    cell = models.ForeignKey(Cell, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='Ячейка хранения')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='DRAFT', verbose_name='Статус')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name='Дата обработки')

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
        ('well', 'Скважина'),
    ]

    batch = models.ForeignKey(OcrBatch, on_delete=models.CASCADE, related_name='tasks', verbose_name='Пакет')
    image = models.ImageField(upload_to='ocr_tasks/%Y/%m/%d/', verbose_name='Фото')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING', verbose_name='Статус')
    raw_ocr_data = models.JSONField(null=True, blank=True, verbose_name='Сырые данные OCR')
    reviewed_data = models.JSONField(null=True, blank=True, verbose_name='Подтвержденные данные')
    zones = models.JSONField(
        null=True, blank=True,
        verbose_name='Разметка зон',
        help_text=(
            'JSON-массив: [{"type": "work_order_coded", '
            '"bbox": [[x,y],[x,y],[x,y],[x,y]], "source": "manual"}, ...]. '
            'Используется mapping-сервисом для извлечения полей из OCR.'
        ),
    )
    error_message = models.TextField(blank=True, default='', verbose_name='Ошибка')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')

    class Meta:
        verbose_name = 'Задача оцифровки'
        verbose_name_plural = 'Задачи оцифровки'

    def __str__(self):
        return f'Фото #{self.id} из пакета #{self.batch_id} ({self.get_status_display()})'