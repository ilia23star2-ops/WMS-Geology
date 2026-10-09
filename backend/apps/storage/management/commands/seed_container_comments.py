"""
Management-команда: заполнение справочника ContainerComment.

Создаёт базовые шаблоны комментариев к таре.

Использование:
    python manage.py seed_container_comments
"""

from django.core.management.base import BaseCommand

from apps.storage.catalogs import ContainerComment

COMMENTS = [
    {"text": "Повреждена", "sort_order": 10},
    {"text": "Влажная", "sort_order": 20},
    {"text": "Особая маркировка", "sort_order": 30},
    {"text": "Пересыпано", "sort_order": 40},
]


class Command(BaseCommand):
    help = "Создаёт базовые комментарии к таре."

    def handle(self, *args, **options) -> None:
        created = 0
        updated = 0
        for item in COMMENTS:
            obj, was_created = ContainerComment.objects.update_or_create(
                text=item["text"],
                defaults={"sort_order": item["sort_order"]},
            )
            if was_created:
                created += 1
                self.stdout.write(f"  + {obj.text}")
            else:
                updated += 1
                self.stdout.write(f"  = {obj.text}")

        self.stdout.write(
            self.style.SUCCESS(
                f"Готово. Создано: {created}, уже было: {updated}."
            )
        )