"""
Модели приложения "Склад".

Топология хранения (комната → стеллаж → пролёт → ярус → ячейка),
поддоны и тара.

Соответствует docs/DATABASE.md v1.
"""

from django.db import models
from django.db.models import Q


class Room(models.Model):
    """Комната — верхний уровень топологии склада."""

    name = models.CharField(max_length=100)
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Комната"
        verbose_name_plural = "Комнаты"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Rack(models.Model):
    """Стеллаж внутри комнаты."""

    room = models.ForeignKey(
        Room,
        on_delete=models.CASCADE,
        related_name="racks",
    )
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Стеллаж"
        verbose_name_plural = "Стеллажи"
        ordering = ["room", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["room", "code"],
                name="rack_unique_room_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.room.name} / {self.code}"


class Section(models.Model):
    """Пролёт внутри стеллажа."""

    rack = models.ForeignKey(
        Rack,
        on_delete=models.CASCADE,
        related_name="sections",
    )
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Пролёт"
        verbose_name_plural = "Пролёты"
        ordering = ["rack", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["rack", "code"],
                name="section_unique_rack_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.rack} / {self.code}"


class Tier(models.Model):
    """Ярус внутри пролёта."""

    section = models.ForeignKey(
        Section,
        on_delete=models.CASCADE,
        related_name="tiers",
    )
    code = models.CharField(max_length=50)
    level_number = models.IntegerField(
        null=True,
        blank=True,
        help_text="Порядковый номер яруса (снизу вверх)",
    )
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Ярус"
        verbose_name_plural = "Ярусы"
        ordering = ["section", "level_number", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "code"],
                name="tier_unique_section_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.section} / {self.code}"


class Cell(models.Model):
    """Ячейка на ярусе. Вмещает до `max_pallets` поддонов."""

    tier = models.ForeignKey(
        Tier,
        on_delete=models.CASCADE,
        related_name="cells",
    )
    code = models.CharField(max_length=50)
    full_address = models.CharField(
        max_length=500,
        unique=True,
        help_text="Полный адрес: Комната / Стеллаж / Пролёт / Ярус / Ячейка",
    )
    max_pallets = models.IntegerField(default=3)
    qr_code = models.TextField(
        unique=True,
        null=True,
        blank=True,
        help_text="Содержимое QR-кода, привязанного к ячейке",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Ячейка"
        verbose_name_plural = "Ячейки"
        ordering = ["tier", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["tier", "code"],
                name="cell_unique_tier_code",
            ),
        ]

    def __str__(self) -> str:
        return self.full_address


class Pallet(models.Model):
    """
    Поддон — платформа для тар.

    Может стоять:
    - в ячейке (cell + position_in_cell), либо
    - прямо на полу в комнате (floor_room), либо
    - нигде ("в пути" — все три поля NULL).

    Одновременно в ячейке и на полу — нельзя.
    """

    STATUS_ACTIVE = "ACTIVE"
    STATUS_EMPTY = "EMPTY"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Активен"),
        (STATUS_EMPTY, "Пуст"),
        (STATUS_IN_TRANSIT, "В пути"),
    ]

    pallet_code = models.CharField(max_length=100, unique=True)
    qr_code = models.TextField(unique=True, null=True, blank=True)
    cell = models.ForeignKey(
        Cell,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pallets",
    )
    position_in_cell = models.IntegerField(
        null=True,
        blank=True,
        help_text="Позиция поддона в ячейке: 1, 2 или 3",
    )
    floor_room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="floor_pallets",
        help_text="Комната, если поддон стоит прямо на полу",
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Поддон"
        verbose_name_plural = "Поддоны"
        ordering = ["pallet_code"]
        constraints = [
            # Либо в ячейке, либо на полу, либо нигде ("в пути").
            # Запрещено: одновременно cell и floor_room.
            models.CheckConstraint(
                condition=(
                    Q(cell__isnull=False, position_in_cell__isnull=False, floor_room__isnull=True)
                    | Q(cell__isnull=True, position_in_cell__isnull=True, floor_room__isnull=False)
                    | Q(cell__isnull=True, position_in_cell__isnull=True, floor_room__isnull=True)
                ),
                name="pallet_location_exclusive",
            ),
            models.CheckConstraint(
                condition=(
                    Q(position_in_cell__isnull=True)
                    | Q(position_in_cell__gte=1, position_in_cell__lte=3)
                ),
                name="pallet_position_in_cell_range",
            ),
        ]

    def __str__(self) -> str:
        return self.pallet_code


class Container(models.Model):
    """
    Тара — физический контейнер с пробами одного типа исследования.

    Может стоять либо на поддоне, либо прямо на полу в комнате,
    либо быть "в пути" (оба поля NULL).
    """

    STATUS_ACTIVE = "ACTIVE"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_ISSUED = "ISSUED"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Активна"),
        (STATUS_IN_TRANSIT, "В пути"),
        (STATUS_ISSUED, "Выдана"),
    ]

    container_number = models.CharField(max_length=100, unique=True)
    container_type = models.CharField(max_length=50, blank=True, default="")
    qr_code = models.TextField(unique=True, null=True, blank=True)
    pallet = models.ForeignKey(
        Pallet,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="containers",
    )
    floor_room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="floor_containers",
        help_text="Комната, если тара стоит прямо на полу",
    )
    status = models.CharField(
        max_length=50,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Тара"
        verbose_name_plural = "Тара"
        ordering = ["container_number"]
        constraints = [
            models.CheckConstraint(
                condition=~(Q(pallet__isnull=False) & Q(floor_room__isnull=False)),
                name="container_not_on_pallet_and_floor",
            ),
        ]

    def __str__(self) -> str:
        return self.container_number