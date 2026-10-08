"""
Справочники приложения samples.

- ResearchType — тип исследования (ШЛ, ХА, ИЗ).
- Site — участок (с паттернами распознавания).
- Laboratory — лаборатория (с префиксами проб).

Импортируются в models.py для регистрации Django.
"""

from django.db import models


class ResearchType(models.Model):
    """Тип лабораторного исследования."""

    code = models.CharField(
        max_length=20,
        unique=True,
        help_text="Короткий код: ШЛ, ХА, ИЗ.",
    )
    name = models.CharField(
        max_length=100,
        help_text="Полное название: «Шлифы», «Хим. анализ».",
    )
    description = models.TextField(blank=True, default="")
    sort_order = models.IntegerField(
        default=100,
        help_text="Порядок в списках (меньше — выше).",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Устаревшие скрываются из выпадающих списков.",
    )

    class Meta:
        verbose_name = "Тип исследования"
        verbose_name_plural = "Типы исследования"
        ordering = ["sort_order", "code"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class Site(models.Model):
    """Участок отбора проб."""

    code = models.CharField(
        max_length=50,
        unique=True,
        help_text="Код участка: TST, СЕВ.",
    )
    name = models.CharField(
        max_length=200,
        help_text="Полное название: «Тестовый участок».",
    )
    match_patterns = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'Паттерны для распознавания Н/З. '
            'Пример: ["TST", "Тест"].'
        ),
    )
    description = models.TextField(blank=True, default="")
    sort_order = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Участок"
        verbose_name_plural = "Участки"
        ordering = ["sort_order", "code"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"


class Laboratory(models.Model):
    """Лаборатория-отправитель проб."""

    code = models.CharField(
        max_length=50,
        unique=True,
        help_text="Код лаборатории: ЛАБ-1.",
    )
    name = models.CharField(
        max_length=200,
        help_text="Полное название: «Лаборатория 1».",
    )
    prefixes = models.JSONField(
        default=list,
        blank=True,
        help_text=(
            'Префиксы проб. Пример: ["TAA-A", "TAA-B"].'
        ),
    )
    description = models.TextField(blank=True, default="")
    sort_order = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Лаборатория"
        verbose_name_plural = "Лаборатории"
        ordering = ["sort_order", "code"]

    def __str__(self) -> str:
        return f"{self.code} — {self.name}"