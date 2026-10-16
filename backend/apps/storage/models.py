"""
Модели приложения "Склад" (v7).

Топология: Комната → Стеллаж → Секция → Ярус (A–D) → Ячейка (1–3).
В ячейке ровно 1 поддон. На поддоне — N тар, в каждой таре — M проб.

Изменения v3 (этап 1.3, bundle-8b):
- `ContainerType.laboratory` — FK (nullable) на Laboratory.
- Уникальность: `(name, laboratory)` вместо `name`.

Изменения v4 (серия 2.x-web-v2, bundle-7a-2b):
- `Container.container_number` — nullable.
- +4 draft-поля: `draft_site`, `draft_research_type`,
  `draft_work_order_coded`, `draft_work_order_incoming`.

Изменения v5 (серия 2.x-web-v2, bundle-3d-3-fix-2):
- `Container.container_number` — больше **не уникален** глобально.

Изменения v6 (серия 2.x-web-v2, пачка 2f-4c-1):
- `Section.save()` и `Cell.save()` — автогенерация `qr_code`
  при создании, если не задан явно.

Изменения v7 (серия 2.x-web-v2, пачка 2f-5c-1):
- `Container.STATUS_PENDING_FILLING` — тара создана (импортом
  или вручную), но пробы в неё ещё не положены.
- `bulk-create` и `check_receipt` создают тары в этом статусе;
  `fill-samples` переводит в `PENDING_PLACEMENT`.
"""

from django.db import models
from django.db.models import Q

from apps.labels.services.qr_service import make_payload

from .catalogs import ContainerComment  # noqa: F401


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
        Room, on_delete=models.CASCADE, related_name="racks",
    )
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Стеллаж"
        verbose_name_plural = "Стеллажи"
        ordering = ["room", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["room", "code"], name="rack_unique_room_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.room.name} / {self.code}"


class Section(models.Model):
    """Секция (пролёт) внутри стеллажа. Содержит 4 яруса A–D."""

    rack = models.ForeignKey(
        Rack, on_delete=models.CASCADE, related_name="sections",
    )
    code = models.CharField(max_length=50)
    qr_code = models.TextField(
        unique=True,
        null=True,
        blank=True,
        help_text=(
            "QR-код секции. Автогенерируется при создании, если не задан."
        ),
    )
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Секция"
        verbose_name_plural = "Секции"
        ordering = ["rack", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["rack", "code"], name="section_unique_rack_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.rack} / {self.code}"

    def save(self, *args, **kwargs):
        """
        Сохраняет секцию; если `qr_code` пусто — генерирует по pk.

        Двойной `super().save()`: первый создаёт запись (или обновляет
        по переданным полям), получает pk; второй пишет `qr_code`.
        """
        super().save(*args, **kwargs)
        if not self.qr_code:
            self.qr_code = make_payload("SECTION", self.pk)
            super().save(update_fields=["qr_code"])


class Tier(models.Model):
    """Ярус внутри секции. Кодовое обозначение — A, B, C, D (снизу вверх)."""

    CODE_CHOICES = [
        ("A", "A (нижний)"),
        ("B", "B"),
        ("C", "C"),
        ("D", "D (верхний)"),
    ]

    section = models.ForeignKey(
        Section, on_delete=models.CASCADE, related_name="tiers",
    )
    code = models.CharField(max_length=1, choices=CODE_CHOICES)
    level_number = models.IntegerField(null=True, blank=True)
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Ярус"
        verbose_name_plural = "Ярусы"
        ordering = ["section", "level_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["section", "code"], name="tier_unique_section_code",
            ),
        ]

    def __str__(self) -> str:
        return f"{self.section} / {self.code}"


class Cell(models.Model):
    """Ячейка на ярусе. Вмещает ровно 1 поддон."""

    CELL_TYPE_STANDARD = "STANDARD"
    CELL_TYPE_CORE = "CORE"
    CELL_TYPE_CHOICES = [
        (CELL_TYPE_STANDARD, "Обычная"),
        (CELL_TYPE_CORE, "Керновая"),
    ]

    tier = models.ForeignKey(
        Tier, on_delete=models.CASCADE, related_name="cells",
    )
    code = models.CharField(max_length=50, help_text="1, 2 или 3")
    full_address = models.CharField(
        max_length=500,
        unique=True,
        help_text="Комната / Стеллаж / Секция / Ярус / Ячейка",
    )
    cell_type = models.CharField(
        max_length=20,
        choices=CELL_TYPE_CHOICES,
        default=CELL_TYPE_STANDARD,
    )
    qr_code = models.TextField(
        unique=True,
        null=True,
        blank=True,
        help_text=(
            "QR-код ячейки. Автогенерируется при создании, если не задан."
        ),
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Ячейка"
        verbose_name_plural = "Ячейки"
        ordering = ["tier", "code"]
        constraints = [
            models.UniqueConstraint(
                fields=["tier", "code"], name="cell_unique_tier_code",
            ),
        ]

    def __str__(self) -> str:
        return self.full_address

    def save(self, *args, **kwargs):
        """См. `Section.save()`."""
        super().save(*args, **kwargs)
        if not self.qr_code:
            self.qr_code = make_payload("CELL", self.pk)
            super().save(update_fields=["qr_code"])


class Pallet(models.Model):
    """Поддон — «тихий» объект (OneToOne с Cell)."""

    PALLET_TYPE_STANDARD = "STANDARD"
    PALLET_TYPE_CORE = "CORE"
    PALLET_TYPE_CHOICES = [
        (PALLET_TYPE_STANDARD, "Обычный"),
        (PALLET_TYPE_CORE, "Керновый"),
    ]

    STATUS_ACTIVE = "ACTIVE"
    STATUS_EMPTY = "EMPTY"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Активен"),
        (STATUS_EMPTY, "Пуст"),
        (STATUS_IN_TRANSIT, "В пути"),
    ]

    cell = models.OneToOneField(
        Cell,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pallet",
        help_text="Ячейка, где стоит поддон (1 ячейка = 1 поддон).",
    )
    floor_room = models.ForeignKey(
        Room,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="floor_pallets",
        help_text="Комната, если поддон стоит прямо на полу.",
    )
    pallet_type = models.CharField(
        max_length=20,
        choices=PALLET_TYPE_CHOICES,
        default=PALLET_TYPE_STANDARD,
    )
    capacity_override = models.JSONField(
        default=dict,
        blank=True,
        help_text=(
            "Переопределение вместимости на этом поддоне: "
            '{"container_type_id": max_count}.'
        ),
    )
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_ACTIVE,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Поддон"
        verbose_name_plural = "Поддоны"
        ordering = ["created_at"]
        constraints = [
            models.CheckConstraint(
                condition=(
                    Q(cell__isnull=False, floor_room__isnull=True)
                    | Q(cell__isnull=True, floor_room__isnull=False)
                    | Q(cell__isnull=True, floor_room__isnull=True)
                ),
                name="pallet_location_exclusive",
            ),
        ]

    def __str__(self) -> str:
        return f"Pallet #{self.pk}"


class ContainerType(models.Model):
    """
    Справочник типов тары.

    `laboratory = NULL` → общий тип, доступный всем.
    `laboratory = ЛАБ-А` → только этой лаборатории.

    Уникальность: `(name, laboratory)`.
    """

    name = models.CharField(max_length=100)
    laboratory = models.ForeignKey(
        "samples.Laboratory",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="container_types",
        help_text="NULL — общий тип, доступный всем лабораториям.",
    )
    size_class = models.CharField(max_length=10, blank=True, default="")
    max_on_standard_pallet = models.IntegerField(
        default=10,
        help_text="Максимум таких тар на стандартном поддоне.",
    )
    is_core = models.BooleanField(
        default=False,
        help_text="Задел: тип относится к керну.",
    )
    description = models.TextField(blank=True, default="")

    class Meta:
        verbose_name = "Тип тары"
        verbose_name_plural = "Типы тары"
        ordering = ["laboratory", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["name", "laboratory"],
                name="container_type_unique_name_lab",
            ),
        ]

    def __str__(self) -> str:
        if self.laboratory:
            return f"{self.name} ({self.laboratory.code})"
        return f"{self.name} (общий)"


class Container(models.Model):
    """
    Тара — физический контейнер с пробами одного типа исследования.

    Жизненный цикл:
    1. **Создание** (bulk-create или check_receipt при приёмке).
       `container_number` может быть пустым или заданным.
       Статус — `PENDING_FILLING` («Ожидает заполнения»):
       тара есть физически, но проб внутри нет.
    2. **Заполнение** (fill-samples). Присваивается `container_number`
       (если был пуст). Пробы создаются. Статус → `PENDING_PLACEMENT`.
    3. **Размещение** (отдельный шаг в будущем). Ячейка присвоена.
       Статус → `ACTIVE`.

    `container_number` — **не уникален** глобально: это «этикетка
    внутри группы (Н/З × ТИ)». Номера `1, 2, 3` могут встречаться
    у разных групп. Уникальный идентификатор — `id` (в QR).
    """

    STATUS_PENDING_FILLING = "PENDING_FILLING"
    STATUS_PENDING_PLACEMENT = "PENDING_PLACEMENT"
    STATUS_ACTIVE = "ACTIVE"
    STATUS_IN_TRANSIT = "IN_TRANSIT"
    STATUS_ISSUED = "ISSUED"
    STATUS_CHOICES = [
        (STATUS_PENDING_FILLING, "Ожидает заполнения"),
        (STATUS_PENDING_PLACEMENT, "Ожидает размещения"),
        (STATUS_ACTIVE, "Активна"),
        (STATUS_IN_TRANSIT, "В пути"),
        (STATUS_ISSUED, "Выдана"),
    ]

    container_number = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        help_text=(
            "Номер тары — «этикетка внутри группы (Н/З × ТИ)». "
            "Не уникален глобально. NULL — заготовка без номера."
        ),
    )
    container_type = models.ForeignKey(
        ContainerType,
        on_delete=models.PROTECT,
        related_name="containers",
    )
    qr_code = models.TextField(
        unique=True,
        null=True,
        blank=True,
        help_text="QR-код тары. Обязателен для приёмки/выборки.",
    )
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
        help_text="Комната, если тара стоит прямо на полу.",
    )
    position_on_pallet = models.IntegerField(
        null=True,
        blank=True,
        help_text="Позиция на поддоне (порядок сканирования). Опционально.",
    )
    status = models.CharField(
        max_length=50, choices=STATUS_CHOICES, default=STATUS_ACTIVE,
    )
    comment = models.TextField(
        blank=True,
        default="",
        help_text="Произвольный комментарий к таре.",
    )
    comment_template = models.ForeignKey(
        ContainerComment,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="containers",
        help_text="Шаблон комментария (если выбран из списка).",
    )

    draft_site = models.ForeignKey(
        "samples.Site",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="draft_site_containers",
        help_text="Участок (черновик до заполнения пробами).",
    )
    draft_research_type = models.ForeignKey(
        "samples.ResearchType",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="draft_rt_containers",
        help_text="Тип исследования (черновик).",
    )
    draft_work_order_coded = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Зашифрованный Н/З (черновик).",
    )
    draft_work_order_incoming = models.CharField(
        max_length=100,
        blank=True,
        default="",
        help_text="Входящий Н/З (черновик).",
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
        return self.container_number or f"Черновик #{self.pk}"