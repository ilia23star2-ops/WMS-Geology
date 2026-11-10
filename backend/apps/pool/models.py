from django.conf import settings
from django.db import models
from django.db.models import Q


class Pool(models.Model):
    """Буфер пользователя (корзина)."""
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name="pool"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Пул"
        verbose_name_plural = "Пулы"

    def __str__(self) -> str:
        return f"Пул пользователя {self.user.username}"


class PoolItem(models.Model):
    """Элемент буфера: либо тара, либо проба."""
    pool = models.ForeignKey(
        Pool, 
        on_delete=models.CASCADE, 
        related_name="items"
    )
    container = models.ForeignKey(
        "storage.Container", 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name="pool_items"
    )
    sample = models.ForeignKey(
        "samples.Sample", 
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name="pool_items"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Элемент пула"
        verbose_name_plural = "Элементы пула"
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(container__isnull=False, sample__isnull=True) |
                    Q(container__isnull=True, sample__isnull=False)
                ),
                name="pool_item_exclusive"
            )
        ]

    def __str__(self) -> str:
        if self.container:
            return f"Тара {self.container_id} в пуле"
        return f"Проба {self.sample_id} в пуле"