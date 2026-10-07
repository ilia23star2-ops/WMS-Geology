# DATABASE.md — схема данных

## Общее

- **СУБД:** PostgreSQL 16+
- **Кодировка:** UTF-8
- **Временная зона:** UTC (хранение), локальная (отображение)
- **Версия схемы:** 1
- **Миграции:** SQL-файлы в `backend/migrations/` (позже — Django
  migrations).

## Таблицы

### `Roles`

| Поле | Тип | Описание |
|---|---|---|
| `role_id` | SERIAL PK | Идентификатор |
| `name` | VARCHAR(50) UNIQUE | `admin`, `manager`, `worker` |
| `description` | TEXT | Описание |

### `Users`

| Поле | Тип | Описание |
|---|---|---|
| `user_id` | SERIAL PK | |
| `username` | VARCHAR(100) UNIQUE | Логин |
| `full_name` | VARCHAR(200) | ФИО |
| `role_id` | INT FK → Roles | Роль |
| `is_active` | BOOLEAN | Активен |
| `created_at` | TIMESTAMPTZ | |

### `Rooms`

| Поле | Тип | Описание |
|---|---|---|
| `room_id` | SERIAL PK | |
| `name` | VARCHAR(100) | Название |
| `description` | TEXT | |

### `Racks`

| Поле | Тип | Описание |
|---|---|---|
| `rack_id` | SERIAL PK | |
| `room_id` | INT FK → Rooms | |
| `code` | VARCHAR(50) | Код |
| `description` | TEXT | |

**Уникальность:** `(room_id, code)`

### `Sections`

| Поле | Тип | Описание |
|---|---|---|
| `section_id` | SERIAL PK | |
| `rack_id` | INT FK → Racks | |
| `code` | VARCHAR(50) | Пролёт |
| `description` | TEXT | |

**Уникальность:** `(rack_id, code)`

### `Tiers`

| Поле | Тип | Описание |
|---|---|---|
| `tier_id` | SERIAL PK | |
| `section_id` | INT FK → Sections | |
| `code` | VARCHAR(50) | Ярус |
| `level_number` | INT | Порядковый номер |
| `description` | TEXT | |

**Уникальность:** `(section_id, code)`

### `Cells`

| Поле | Тип | Описание |
|---|---|---|
| `cell_id` | SERIAL PK | |
| `tier_id` | INT FK → Tiers | |
| `code` | VARCHAR(50) | Ячейка |
| `full_address` | VARCHAR(500) UNIQUE | Полный адрес |
| `max_pallets` | INT DEFAULT 3 | Макс. поддонов |
| `qr_code` | TEXT UNIQUE | QR-код |
| `is_active` | BOOLEAN | |

**Уникальность:** `(tier_id, code)`

### `Pallets`

| Поле | Тип | Описание |
|---|---|---|
| `pallet_id` | SERIAL PK | |
| `pallet_code` | VARCHAR(100) UNIQUE | Код поддона |
| `qr_code` | TEXT UNIQUE | QR-код |
| `cell_id` | INT FK → Cells | NULL, если на полу |
| `position_in_cell` | INT | 1, 2, 3 |
| `floor_room_id` | INT FK → Rooms | NULL, если в ячейке |
| `status` | VARCHAR(50) | `ACTIVE`, `EMPTY`, `IN_TRANSIT` |
| `created_at` | TIMESTAMPTZ | |

**CHECK:** либо `cell_id + position_in_cell`, либо `floor_room_id`.

### `Containers`

| Поле | Тип | Описание |
|---|---|---|
| `container_id` | SERIAL PK | |
| `container_number` | VARCHAR(100) UNIQUE | Номер тары |
| `container_type` | VARCHAR(50) | Коробка / мешок / кернобокс |
| `qr_code` | TEXT UNIQUE | QR-код |
| `pallet_id` | INT FK → Pallets | NULL, если на полу |
| `floor_room_id` | INT FK → Rooms | NULL, если на поддоне |
| `status` | VARCHAR(50) | |
| `created_at` | TIMESTAMPTZ | |

### `Wells`

| Поле | Тип | Описание |
|---|---|---|
| `well_id` | SERIAL PK | |
| `well_name` | VARCHAR(150) | Номер/название |
| `field_name` | VARCHAR(150) | Месторождение |
| `cluster` | VARCHAR(100) | Куст |
| `coordinates` | TEXT | Координаты (позже — PostGIS) |
| `created_at` | TIMESTAMPTZ | |

### `WorkOrders`

| Поле | Тип | Описание |
|---|---|---|
| `work_order_id` | SERIAL PK | |
| `order_number` | VARCHAR(100) | Название Н/З |
| `order_type` | VARCHAR(20) | `INCOMING` / `CODED` |
| `linked_order_id` | INT FK → WorkOrders | Парный Н/З |
| `status` | VARCHAR(50) | |
| `description` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Уникальность:** `(order_number, order_type)`
**CHECK:** `order_type IN ('INCOMING', 'CODED')`

### `Samples`

| Поле | Тип | Описание |
|---|---|---|
| `sample_id` | SERIAL PK | |
| `sample_number` | VARCHAR(100) | Номер пробы (**не уникален**) |
| `research_type` | VARCHAR(100) | Тип исследования |
| `well_id` | INT FK → Wells | |
| `depth_from` | NUMERIC(10,2) | |
| `depth_to` | NUMERIC(10,2) | |
| `site` | VARCHAR(150) | Участок |
| `container_id` | INT FK → Containers | **NOT NULL** |
| `current_work_order_id` | INT FK → WorkOrders | Актуальный Н/З |
| `status` | VARCHAR(50) | `IN_STORAGE`, `IN_TRANSIT`, `ISSUED`, `CONSUMED` |
| `qr_code` | TEXT UNIQUE | Опционально |
| `legacy_data` | JSONB | Данные старой этикетки |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы:**
- `idx_samples_number` — на `sample_number`
- `idx_samples_research_type` — на `research_type`
- `idx_samples_container` — на `container_id`
- `idx_samples_work_order` — на `current_work_order_id`

### `SampleWorkOrders`

| Поле | Тип | Описание |
|---|---|---|
| `sample_id` | INT FK → Samples | Часть PK |
| `work_order_id` | INT FK → WorkOrders | Часть PK |
| `linked_at` | TIMESTAMPTZ | Когда связали |

**PK:** `(sample_id, work_order_id)`

### `InventorySessions`

| Поле | Тип | Описание |
|---|---|---|
| `session_id` | SERIAL PK | |
| `session_name` | VARCHAR(100) | |
| `status` | VARCHAR(50) | `ACTIVE`, `COMPLETED`, `CANCELLED` |
| `started_by` | INT FK → Users | |
| `started_at` | TIMESTAMPTZ | |
| `completed_at` | TIMESTAMPTZ | |

### `InventoryScans`

| Поле | Тип | Описание |
|---|---|---|
| `scan_id` | BIGSERIAL PK | |
| `session_id` | INT FK → InventorySessions | |
| `sample_id` | INT FK → Samples | |
| `scanned_container_id` | INT FK → Containers | |
| `scanned_qr_code` | TEXT | Что сканировали |
| `scanned_at` | TIMESTAMPTZ | |
| `is_expected` | BOOLEAN | Ожидалось ли здесь |
| `note` | TEXT | |

### `AuditLog`

| Поле | Тип | Описание |
|---|---|---|
| `log_id` | BIGSERIAL PK | |
| `user_id` | INT FK → Users | |
| `action` | VARCHAR(100) | `SCAN`, `MOVE`, `CREATE`, `UPDATE` |
| `entity_type` | VARCHAR(50) | `Sample`, `Location`, `WorkOrder` |
| `entity_id` | INT | |
| `old_value` | JSONB | |
| `new_value` | JSONB | |
| `created_at` | TIMESTAMPTZ | |

## Соглашения

- **Именование таблиц:** PascalCase во множественном числе.
- **Именование полей:** snake_case.
- **Timestamp:** `TIMESTAMPTZ` везде. Хранение в UTC.
- **Nullable:** явно указано у каждого поля.
- **JSONB:** только для `legacy_data`, `old_value`, `new_value`.

## Миграции

### v0 → v1 (initial)

**Причина:** Старт проекта.
**Изменения:** Создание всех таблиц.
**Где:** `backend/migrations/001_initial_schema.sql` (позже).

## Бэкапы

- **Формат:** `pg_dump` (custom).
- **Где:** на сервере, вне репозитория.
- **Ротация:** ежедневно, хранение 30 дней.

## Что НЕ хранится

- Файлы образцов (фото, сканы этикеток) — только ссылки.
- Аудио, видео.
- Персональные данные за пределами `Users`.