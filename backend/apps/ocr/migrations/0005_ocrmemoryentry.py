import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('ocr', '0004_ocrbatch_name'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='OcrMemoryEntry',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('zone_type', models.CharField(choices=[('site', 'Участок'), ('research_type', 'Тип исследования'), ('work_order_coded', 'Н/З (текущий)'), ('work_order_incoming', 'Н/З (входящий)')], db_index=True, max_length=32, verbose_name='Тип зоны')),
                ('raw_token', models.CharField(db_index=True, help_text='Токен из extracted после canon.canon_text.', max_length=120, verbose_name='Сырой токен (канонизированный)')),
                ('resolved_value', models.CharField(help_text='Код справочника, который подтвердил оператор.', max_length=120, verbose_name='Значение (код справочника)')),
                ('hit_count', models.PositiveIntegerField(default=0, help_text='Сколько раз память сработала при резолве.', verbose_name='Совпадений')),
                ('created_at', models.DateTimeField(auto_now_add=True, verbose_name='Дата создания')),
                ('last_used_at', models.DateTimeField(blank=True, null=True, verbose_name='Последнее использование')),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL, verbose_name='Кто подтвердил')),
            ],
            options={
                'verbose_name': 'Память исправления OCR',
                'verbose_name_plural': 'Память исправлений OCR',
                'ordering': ['-created_at'],
            },
        ),
        migrations.AddConstraint(
            model_name='ocrmemoryentry',
            constraint=models.UniqueConstraint(fields=['zone_type', 'raw_token'], name='uniq_ocr_memory_zone_raw'),
        ),
    ]