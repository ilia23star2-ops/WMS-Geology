"""
Справочники приложения storage.

- ContainerComment — шаблоны комментариев к таре.
"""

from django.db import models


class ContainerComment(models.Model):
    """Шаблон комментария к таре."""

    text = models.CharField(
        max_length=500,
        unique=True,
        help_text="Например: «Повреждена», «Влажная».",
    )
    sort_order = models.IntegerField(default=100)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Комментарий к таре"
        verbose_name_plural = "Комментарии к таре"
        ordering = ["sort_order", "text"]

    def __str__(self) -> str:
        return self.text