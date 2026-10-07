# DATABASE.md — схема данных

## Общее

- **СУБД:** PostgreSQL 16+ (портативный, `D:\Dev\pgsql\`)
- **Кодировка:** UTF-8
- **Временная зона:** UTC (хранение), локальная (отображение)
- **Версия схемы:** 2 (актуальная; v1 — история серии 1.0)
- **Миграции:** Django migrations в `backend/apps/*/migrations/`

## Изменения v1 → v2

Решения **1.20 – 1.30** из `docs/DECISIONS.md`:

- Топология: 4 яруса A–D, 1 поддон в ячейке.
- `Pallet` → OneToOne с `Cell`, без QR, без `position_in_cell`, без `pallet_code`.
- `Cell` → без `max_pallets`, добавлен `cell_type`.
- `Container` → `container_type` (FK), `position_on_pallet` (опционально).
- Новые: `ContainerType`, `PickList`, `PickListItem`, `Shipment`, `MoveOperation`, `MoveOperationItem`, `InventoryIssue`.
- `InventoryScan` → поле `raw_barcode`.
- `Sample` → поля `disposed_at`, `disposed_by`, `disposal_reason`.

---

## Таблицы

### `Roles` (v1, без изменений)

| Поле | Тип | Описание |
|---|---|---|
| `role_id` | SERIAL PK | |
| `name` | VARCHAR(50) UNIQUE | `admin`, `manager`, `worker` |
| `description` | TEXT | |

### `Users` (Django auth_user, без изменений)

Стандартная `django.contrib.auth.User` + `UserProfile` (см. ниже).

### `UserProfiles`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INT OneToOne → User | |
| `role_id` | INT FK → Roles (NULL) | |
| `full_name` | VARCHAR(200) | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

### `AuditLogs`

| Поле | Тип | Описание |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `user_id` | INT FK → User (NULL) | NULL — системное действие |
| `action` | VARCHAR(100) | `SCAN`, `MOVE`, `CREATE`, `UPDATE`, `DELETE`, `BATCH_MOVE` |
| `entity_type` | VARCHAR(50) | `Sample`, `Container`, `WorkOrder`, ... |
| `entity_id` | INT (NULL) | |
| `old_value` | JSONB (NULL) | |
| `new_value` | JSONB (NULL) | |
| `created_at` | TIMESTAMPTZ | |

**Индексы:** `(entity_type, entity_id)`, `(user, -created_at)`, `(-created_at)`.

---

## Топология склада

### `Rooms`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(100) | |
| `description` | TEXT | |

### `Racks`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `room_id` | INT FK → Rooms | |
| `code` | VARCHAR(50) | |
| `description` | TEXT | |

**Уникальность:** `(room_id, code)`.

### `Sections` (пролёты)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `rack_id` | INT FK → Racks | |
| `code` | VARCHAR(50) | |
| `qr_code` | TEXT UNIQUE (NULL) | **Обязателен для виртуального вида** |
| `description` | TEXT | |

**Уникальность:** `(rack_id, code)`.
**QR payload:** `WMSG:SECTION:<id>`.

### `Tiers` (ярусы)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `section_id` | INT FK → Sections | |
| `code` | VARCHAR(1) | **A, B, C, D** (снизу вверх) |
| `level_number` | INT | 1=A, 2=B, 3=C, 4=D |
| `description` | TEXT | |

**Уникальность:** `(section_id, code)`.
**CHECK:** `code IN ('A','B','C','D')`.

### `Cells` (ячейки)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `tier_id` | INT FK → Tiers | |
| `code` | VARCHAR(50) | `1`, `2`, `3` |
| `full_address` | VARCHAR(500) UNIQUE | «Комната 1 / Стеллаж A / Пролёт 1 / Ярус A / Ячейка 1» |
| `cell_type` | VARCHAR(20) | `STANDARD` / `CORE` (пока всегда `STANDARD`) |
| `qr_code` | TEXT UNIQUE (NULL) | **Обязателен** |
| `is_active` | BOOLEAN | |

**Уникальность:** `(tier_id, code)`.
**QR payload:** `WMSG:CELL:<id>`.
**Убрано из v1:** `max_pallets` (вместимость — у поддона).

---

## Поддоны и тара

### `Pallets` (поддоны) — Вариант A

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `cell_id` | INT OneToOne → Cells (NULL) | 1 ячейка = 1 поддон |
| `floor_room_id` | INT FK → Rooms (NULL) | Если на полу |
| `pallet_type` | VARCHAR(20) | `STANDARD` / `CORE` (задел) |
| `capacity_override` | JSONB | `{"small_box": 15, "big_box": 6}` |
| `status` | VARCHAR(50) | `ACTIVE` / `EMPTY` / `IN_TRANSIT` |
| `created_at` | TIMESTAMPTZ | |

**CHECK:** `cell_id` XOR `floor_room_id`, или оба NULL («в пути»).
**Убрано из v1:** `pallet_code`, `qr_code`, `position_in_cell`.
**OneToOne:** `cell_id` уникален (в ячейке ровно 1 поддон).

### `ContainerTypes` (справочник типов тары)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(100) UNIQUE | «Коробка малая», «Ящик» |
| `size_class` | VARCHAR(10) | `S`, `M`, `L`, `XL` |
| `max_on_standard_pallet` | INT | По умолчанию влезает на поддон |
| `is_core` | BOOLEAN | Задел для керна |
| `description` | TEXT | |

### `Containers` (тара)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `container_number` | VARCHAR(100) UNIQUE | |
| `container_type_id` | INT FK → ContainerTypes | |
| `qr_code` | TEXT UNIQUE (NULL) | **Обязателен** |
| `pallet_id` | INT FK → Pallets (NULL) | Если на поддоне |
| `floor_room_id` | INT FK → Rooms (NULL) | Если на полу |
| `position_on_pallet` | INT (NULL) | Позиция на поддоне (порядок сканирования) |
| `status` | VARCHAR(50) | `ACTIVE` / `IN_TRANSIT` / `ISSUED` |
| `created_at` | TIMESTAMPTZ | |

**CHECK:** `pallet_id` и `floor_room_id` не заданы одновременно.
**QR payload:** `WMSG:CONTAINER:<id>`.

---

## Пробы и наряд-заказы

### `Wells` (скважины)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `well_name` | VARCHAR(150) | |
| `field_name` | VARCHAR(150) | |
| `cluster` | VARCHAR(100) | |
| `coordinates` | TEXT | (позже — PostGIS) |
| `created_at` | TIMESTAMPTZ | |

### `WorkOrders` (наряд-заказы)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `order_number` | VARCHAR(100) | |
| `order_type` | VARCHAR(20) | `INCOMING` / `CODED` |
| `linked_order_id` | INT FK → WorkOrders (NULL) | Self-reference |
| `status` | VARCHAR(50) | |
| `description` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Уникальность:** `(order_number, order_type)`.
**CHECK:** `id <> linked_order_id`.

### `Samples` (пробы)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `sample_number` | VARCHAR(100) | **Не уникален** |
| `research_type` | VARCHAR(100) | |
| `well_id` | INT FK → Wells (NULL) | |
| `depth_from` | NUMERIC(10,2) (NULL) | |
| `depth_to` | NUMERIC(10,2) (NULL) | |
| `site` | VARCHAR(150) | Участок |
| `container_id` | INT FK → Containers | **NOT NULL** (`PROTECT`) |
| `current_work_order_id` | INT FK → WorkOrders (NULL) | Актуальный Н/З |
| `status` | VARCHAR(50) | `IN_STORAGE`, `IN_TRANSIT`, `ISSUED`, `CONSUMED`, **`DISPOSED`** |
| `qr_code` | TEXT UNIQUE (NULL) | Опционально |
| `legacy_data` | JSONB (NULL) | Старые этикетки |
| `disposed_at` | TIMESTAMPTZ (NULL) | Когда утилизирована |
| `disposed_by_id` | INT FK → User (NULL) | Кто утилизировал |
| `disposal_reason` | TEXT | Причина |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы:** `sample_number`, `research_type`, `container`, `current_work_order`.

### `SampleWorkOrders`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `sample_id` | INT FK → Samples (CASCADE) | |
| `work_order_id` | INT FK → WorkOrders (CASCADE) | |
| `linked_at` | TIMESTAMPTZ | |

**Уникальность:** `(sample_id, work_order_id)`.

---

## Выборка и отправка

### `PickLists` (списки выборки)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `pick_list_number` | VARCHAR(100) UNIQUE | «В-2026-001» |
| `created_by_id` | INT FK → User (NULL) | |
| `status` | VARCHAR(50) | `DRAFT`, `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `created_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ (NULL) | |

### `PickListItems`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `pick_list_id` | INT FK → PickLists (CASCADE) | |
| `sample_id` | INT FK → Samples (PROTECT) | |
| `status` | VARCHAR(50) | `PENDING`, `PICKED`, `NOT_FOUND`, `SENT` |
| `picked_at` | TIMESTAMPTZ (NULL) | |
| `picked_by_id` | INT FK → User (NULL) | |
| `note` | TEXT | |

**Уникальность:** `(pick_list_id, sample_id)`.

### `Shipments` (отправки в лабораторию)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `shipment_number` | VARCHAR(100) UNIQUE | |
| `destination` | VARCHAR(200) | Лаборатория / адрес |
| `sent_by_id` | INT FK → User (NULL) | |
| `sent_at` | TIMESTAMPTZ | |
| `note` | TEXT | |

### `ShipmentItems`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `shipment_id` | INT FK → Shipments (CASCADE) | |
| `sample_id` | INT FK → Samples (PROTECT) | |
| `pick_list_item_id` | INT FK → PickListItems (NULL) | Если из списка |

**Уникальность:** `(shipment_id, sample_id)`.

---

## Пул перемещений

### `MoveOperations`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `operation_number` | VARCHAR(100) UNIQUE | |
| `target_cell_id` | INT FK → Cells (NULL) | Куда |
| `target_floor_room_id` | INT FK → Rooms (NULL) | Или на пол |
| `created_by_id` | INT FK → User (NULL) | |
| `status` | VARCHAR(50) | `DRAFT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED` |
| `created_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ (NULL) | |

### `MoveOperationItems`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `move_operation_id` | INT FK → MoveOperations (CASCADE) | |
| `pallet_id` | INT FK → Pallets (NULL) | Если перемещается поддон |
| `container_id` | INT FK → Containers (NULL) | Если перемещается тара |
| `source_cell_id` | INT FK → Cells (NULL) | Адрес на момент добавления |
| `source_floor_room_id` | INT FK → Rooms (NULL) | |
| `status` | VARCHAR(50) | `PENDING`, `MOVED`, `SKIPPED` |

**CHECK:** ровно одно из `pallet_id` / `container_id` задано.

---

## Инвентаризация

### `InventorySessions`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `session_name` | VARCHAR(100) | |
| `status` | VARCHAR(50) | `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `started_by_id` | INT FK → User (NULL) | |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ (NULL) | |

### `InventoryScans`

| Поле | Тип | Описание |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `session_id` | INT FK → InventorySessions (CASCADE) | |
| `sample_id` | INT FK → Samples (SET_NULL, NULL) | |
| `scanned_container_id` | INT FK → Containers (SET_NULL, NULL) | |
| `scanned_qr_code` | TEXT | Что отсканировали |
| `raw_barcode` | TEXT | **NEW** «Сырой» штрих-код |
| `scanned_at` | TIMESTAMPTZ | |
| `is_expected` | BOOLEAN (NULL) | |
| `note` | TEXT | |

### `InventoryIssues` (расхождения)

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `session_id` | INT FK → InventorySessions (CASCADE) | |
| `issue_type` | VARCHAR(50) | `CONTAINER_MISSING`, `CONTAINER_MISPLACED`, `CONTAINER_EXTRA`, `SAMPLE_MISSING`, `SAMPLE_STATUS_MISMATCH` |
| `sample_id` | INT FK → Samples (SET_NULL, NULL) | |
| `container_id` | INT FK → Containers (SET_NULL, NULL) | |
| `expected_value` | TEXT | Что ожидалось |
| `actual_value` | TEXT | Что найдено |
| `resolution` | TEXT | Как разрешили |
| `resolved_at` | TIMESTAMPTZ (NULL) | |
| `resolved_by_id` | INT FK → User (NULL) | |
| `created_at` | TIMESTAMPTZ | |

---

## Соглашения

- **Именование таблиц:** PascalCase во множественном числе.
- **Именование полей:** snake_case.
- **Timestamp:** `TIMESTAMPTZ` везде. Хранение в UTC.
- **Nullable:** явно указано у каждого поля.
- **JSONB:** `legacy_data`, `old_value`, `new_value`, `capacity_override`.
- **CHECK-constraints:** `condition=` (Django 5.2+).
- **CASCADE / PROTECT / SET_NULL:** явно указано у каждого FK.

## Миграции

### v1 → v2 (планируется)

**Причина:** уточнение топологии + 4 новых доменных процесса (см. 1.20–1.30).

**Изменения:**
- `storage.Pallet` — убрать `pallet_code`, `qr_code`, `position_in_cell`, `cell` → OneToOne, добавить `pallet_type`, `capacity_override`.
- `storage.Cell` — убрать `max_pallets`, добавить `cell_type`.
- `storage.Section` — добавить `qr_code`.
- `storage.ContainerType` — новая.
- `storage.Container` — добавить `container_type_id`, `position_on_pallet`.
- `samples.Sample` — добавить `disposed_at`, `disposed_by_id`, `disposal_reason`.
- `inventory.InventoryScan` — добавить `raw_barcode`.
- `inventory.InventoryIssue` — новая.
- Новые приложения: `picking` (PickList, PickListItem, Shipment, ShipmentItem), `movements` (MoveOperation, MoveOperationItem).

**Где:** будет реализовано в серии `feature/1.1-backend-api` или отдельной `feature/1.0a-topology-v2`.

## Бэкапы

- **Формат:** `pg_dump` (custom).
- **Где:** на сервере, вне репозитория.
- **Ротация:** ежедневно, хранение 30 дней.

## Что НЕ хранится

- Файлы образцов (фото, сканы этикеток) — только ссылки.
- Аудио, видео.
- Персональные данные за пределами `User`.
- QR на поддонах и пробах (физически нет).