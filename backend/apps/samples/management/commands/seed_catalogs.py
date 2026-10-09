"""
Management-команда: заполнение справочников samples.

Создаёт placeholder-значения для:
- ResearchType (ШЛ, ХА, ИЗ).
- Site (Тестовый, Северный).
- Laboratory (ЛАБ-1, ЛАБ-2).

Идемпотентна: повторный запуск обновляет описания, не создаёт дубликаты.

Использование:
    python manage.py seed_catalogs
"""

from django.core.management.base import BaseCommand

from apps.samples.catalogs import Laboratory, ResearchType, Site

RESEARCH_TYPES = [
    {"code": "ШЛ", "name": "Шлифы", "sort_order": 10},
    {"code": "ХА", "name": "Химический анализ", "sort_order": 20},
    {"code": "ИЗ", "name": "Изотопный анализ", "sort_order": 30},
]

SITES = [
    {
        "code": "TST",
        "name": "Тестовый участок",
        "match_patterns": ["TST", "Тест"],
        "sort_order": 10,
    },
    {
        "code": "СЕВ",
        "name": "Северный участок",
        "match_patterns": ["СЕВ", "Север"],
        "sort_order": 20,
    },
]

LABORATORIES = [
    {
        "code": "ЛАБ-1",
        "name": "Лаборатория 1",
        "prefixes": ["ЛАБ1"],
        "sort_order": 10,
    },
    {
        "code": "ЛАБ-2",
        "name": "Лаборатория 2",
        "prefixes": ["ЛАБ2"],
        "sort_order": 20,
    },
]


class Command(BaseCommand):
    help = "Создаёт placeholder-справочники: ResearchType, Site, Laboratory."

    def handle(self, *args, **options) -> None:
        rt_created, rt_updated = self._seed(
            ResearchType, RESEARCH_TYPES,
            fields=["name", "sort_order"],
        )
        site_created, site_updated = self._seed(
            Site, SITES,
            fields=["name", "match_patterns", "sort_order"],
        )
        lab_created, lab_updated = self._seed(
            Laboratory, LABORATORIES,
            fields=["name", "prefixes", "sort_order"],
        )

        self.stdout.write(
            self.style.SUCCESS(
                f"ResearchType: создано {rt_created}, "
                f"обновлено {rt_updated}."
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Site: создано {site_created}, обновлено {site_updated}."
            )
        )
        self.stdout.write(
            self.style.SUCCESS(
                f"Laboratory: создано {lab_created}, "
                f"обновлено {lab_updated}."
            )
        )

    def _seed(self, model, items, fields):
        """Универсальный seeding. Возвращает (created, updated)."""
        created = 0
        updated = 0
        for item in items:
            defaults = {f: item[f] for f in fields}
            obj, was_created = model.objects.update_or_create(
                code=item["code"],
                defaults=defaults,
            )
            if was_created:
                created += 1
                self.stdout.write(f"  + {model.__name__}: {obj.code}")
            else:
                updated += 1
                self.stdout.write(f"  = {model.__name__}: {obj.code}")
        return created, updated