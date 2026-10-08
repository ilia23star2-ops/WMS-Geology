# DATABASE.md — схема данных

## Общее

- **СУБД:** PostgreSQL 16+ (портативный / Docker).
- **Кодировка:** UTF-8.
- **Временная зона:** UTC (хранение), локальная (отображение).
- **Версия схемы:** 3.
- **Миграции:** Django migrations в `backend/apps/*/migrations/`.

## История версий

- **v1** — базовые модели (серия 1.0).
- **v2** — топология A–D, «тихий» Pallet, ContainerType (серия 1.0a).
- **v3** — справочники, структура номера пробы, приёмка (серия 1.3).

## Изменения v2 → v3

Решения **1.35 – 1.51** из `docs/DECISIONS.md`:

- Новые справочники: `ResearchTypes`, `Sites`, `Laboratories`, `ContainerComments`.
- `Samples.research_type` → FK на `ResearchTypes`.
- `Samples.site` → FK на `Sites`.
- `Samples` + `number_prefix`, `number_middle`, `number_sequence`, `is_encrypted`.
- `Containers` + `comment`, `comment_template_id`, статус `PENDING_PLACEMENT`.
- `WorkOrders` + `site_id` (FK).
- Новые: `Receipts`, `ReceiptItems`, `ImportSessions`.
- (Отложено) `PrintBatches`, `PrintBatchItems`.

---

## Таблицы

### Справочники

#### `ResearchTypes`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `code` | VARCHAR(20) UNIQUE | `ШЛ`, `ХА`, `ИЗ` |
| `name` | VARCHAR(100) | «Шлифы», «Хим. анализ» |
| `description` | TEXT | |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `code`.

#### `Sites`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `code` | VARCHAR(50) UNIQUE | `TST` |
| `name` | VARCHAR(200) | «Тестовый участок» |
| `match_patterns` | JSONB | `["TST", "Тест"]` — паттерны для распознавания Н/З |
| `description` | TEXT | |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `code`.

#### `Laboratories`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `code` | VARCHAR(50) UNIQUE | `ЛАБ-1` |
| `name` | VARCHAR(200) | «Лаборатория 1» |
| `prefixes` | JSONB | `["TAA-A", "TAA-B"]` — префиксы в номерах проб |
| `description` | TEXT | |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `code`.

#### `ContainerComments`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `text` | VARCHAR(500) | «Повреждена», «Влажная», «Особая маркировка» |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `text`.

---

### Пользователи

#### `Roles`, `Users` (Django auth_user), `UserProfiles`, `AuditLogs`

Без изменений (v1). См. историю.

---

### Топология склада

#### `Rooms`, `Racks`, `Sections`, `Tiers`, `Cells`

Без изменений (v2).

- `Sections.qr_code` — обязателен.
- `Cells.qr_code` — обязателен.
- `Cells.cell_type` — `STANDARD` / `CORE`.

#### `Pallets` (Вариант A)

Без изменений (v2):

- OneToOne с `Cell`.
- Без `qr_code`, без `pallet_code`, без `position_in_cell`.
- `pallet_type`, `capacity_override` (JSONB).
- Статусы: `ACTIVE / EMPTY / IN_TRANSIT`.

#### `ContainerTypes`

Без изменений (v2).

#### `Containers`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `container_number` | VARCHAR(100) UNIQUE | |
| `container_type_id` | INT FK → ContainerTypes (PROTECT) | |
| `qr_code` | TEXT UNIQUE NULL | `WMSG:CONTAINER:<id>` |
| `pallet_id` | INT FK → Pallets NULL | |
| `floor_room_id` | INT FK → Rooms NULL | |
| `position_on_pallet` | INT NULL | |
| **`comment`** | **TEXT** | **NEW** — произвольный комментарий |
| **`comment_template_id`** | **INT FK → ContainerComments NULL** | **NEW** — шаблон |
| **`status`** | **VARCHAR(50)** | **NEW значение: `PENDING_PLACEMENT`** |
| `created_at` | TIMESTAMPTZ | |

**Статусы:** `ACTIVE / PENDING_PLACEMENT / IN_TRANSIT / ISSUED`.

**CHECK:** `pallet_id` и `floor_room_id` не заданы одновременно.

---

### Пробы и Н/З

#### `Wells`

Без изменений (v1).

#### `WorkOrders`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `order_number` | VARCHAR(100) | |
| `order_type` | VARCHAR(20) | `INCOMING` / `CODED` |
| `linked_order_id` | INT FK → WorkOrders NULL | self-ref |
| **`site_id`** | **INT FK → Sites NULL** | **NEW** — авто-определение участка |
| `status` | VARCHAR(50) | |
| `description` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Уникальность:** `(order_number, order_type)`.
**CHECK:** `id <> linked_order_id`.

#### `Samples`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `sample_number` | VARCHAR(100) | полный номер, как есть |
| **`is_encrypted`** | **BOOLEAN** | **NEW** — шифрованная или нет |
| **`number_prefix`** | **VARCHAR(50)** | **NEW** — `TAA-A` или `TST` |
| **`number_middle`** | **VARCHAR(50)** | **NEW** — `34076001` или `124` |
| **`number_sequence`** | **VARCHAR(20)** | **NEW** — `001`, `01`, `7021` |
| **`research_type_id`** | **INT FK → ResearchTypes (PROTECT)** | **ЗАМЕНА** CharField |
| `well_id` | INT FK → Wells NULL | |
| `depth_from` | NUMERIC(10,2) NULL | |
| `depth_to` | NUMERIC(10,2) NULL | |
| **`site_id`** | **INT FK → Sites NULL** | **ЗАМЕНА** CharField |
| `container_id` | INT FK → Containers (PROTECT) NOT NULL | |
| `current_work_order_id` | INT FK → WorkOrders NULL | |
| `status` | VARCHAR(50) | `IN_STORAGE / IN_TRANSIT / ISSUED / CONSUMED / DISPOSED / PENDING_DECRYPTION` |
| **`receipt_item_id`** | **INT FK → ReceiptItems NULL** | **NEW** — из какой приёмки |
| `qr_code` | TEXT UNIQUE NULL | |
| `legacy_data` | JSONB NULL | |
| `disposed_at` | TIMESTAMPTZ NULL | |
| `disposed_by_id` | INT FK → User NULL | |
| `disposal_reason` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы:** `sample_number`, `number_prefix`, `number_middle`, `research_type`, `container`, `current_work_order`, `site`, `status`.

**Статус `PENDING_DECRYPTION`** — для шифрованных проб без расшифровки (когда скважина неизвестна и не нужна на приёмке).

#### `SampleWorkOrders`

Без изменений (v2).

---

### Приёмка

#### `Receipts`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `receipt_number` | VARCHAR(100) UNIQUE | `ПР-2026-001` |
| `laboratory_id` | INT FK → Laboratories NULL | |
| `site_id` | INT FK → Sites NULL | |
| `excel_file` | FILE NULL | исходный Excel |
| `imported_at` | TIMESTAMPTZ NULL | когда загружен |
| `imported_by_id` | INT FK → User NULL | |
| `received_at` | TIMESTAMPTZ NULL | когда разгружено |
| `received_by_id` | INT FK → User NULL | |
| `expected_date` | DATE NULL | |
| `status` | VARCHAR(50) | `EXPECTED / IN_PROGRESS / CONFIRMED / CANCELLED` |
| `comment` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Индексы:** `receipt_number`, `status`, `expected_date`.

#### `ReceiptItems`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `receipt_id` | INT FK → Receipts (CASCADE) | |
| `container_id` | INT FK → Containers NULL | создаётся при подтверждении |
| `expected_container_number` | VARCHAR(100) | ожидаемый номер тары |
| `expected_work_order_number` | VARCHAR(100) | |
| `expected_research_type_code` | VARCHAR(20) | |
| `expected_site_code` | VARCHAR(50) NULL | |
| `expected_samples_count` | INT NULL | |
| `actual_container_number` | VARCHAR(100) NULL | |
| `actual_samples_count` | INT NULL | |
| `scanned_barcodes` | JSONB NULL | |
| `status` | VARCHAR(50) | `EXPECTED / MATCHED / DISCREPANCY / MISSING / EXTRA / PENDING_DECRYPTION` |
| `work_order_id` | INT FK → WorkOrders NULL | |
| `research_type_id` | INT FK → ResearchTypes NULL | |
| `site_id` | INT FK → Sites NULL | |
| `note` | TEXT | |

**Индексы:** `receipt`, `status`.

#### `ImportSessions`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `file` | FILE | загруженный Excel |
| `file_format` | VARCHAR(20) | `XLSX / CSV` |
| `uploaded_at` | TIMESTAMPTZ | |
| `uploaded_by_id` | INT FK → User NULL | |
| `status` | VARCHAR(50) | `PARSING / PARSED / ERROR / APPLIED` |
| `parse_errors` | JSONB | список ошибок парсинга |
| `receipt_id` | INT FK → Receipts NULL | после применения |

---

### Выборка и отправка

#### `PickLists`, `PickListItems`, `Shipments`, `ShipmentItems`

Без изменений (v2).

---

### Пул перемещений

#### `MoveOperations`, `MoveOperationItems`

Без изменений (v2).

---

### Инвентаризация

#### `InventorySessions`, `InventoryScans`, `InventoryIssues`

Без изменений (v2).

---

### Отложено (серия 2.0+)

#### `PrintBatches`, `PrintBatchItems`

Для массовой печати этикеток и QR (решение 1.48).

Пока не создаём — появится, когда дойдём до печати.

#### `SampleDecryption`

Таблица соответствия шифрованных и нешифрованных проб (решение 1.42).

Пока не создаём — есть `Sample.legacy_data` (JSONB) как временное место.

---

## Соглашения

- **Именование таблиц:** PascalCase во множественном числе.
- **Именование полей:** snake_case.
- **Timestamp:** `TIMESTAMPTZ` везде. Хранение в UTC.
- **JSONB:** `legacy_data`, `match_patterns`, `prefixes`, `scanned_barcodes`,
  `parse_errors`, `capacity_override`.
- **CHECK-constraints:** `condition=` (Django 5.2+).
- **CASCADE / PROTECT / SET_NULL:** явно указано у каждого FK.
- **Справочники:** `PROTECT` на FK из реальных данных (удалить справочник
  нельзя, пока на него ссылаются).

## План миграций v3

### Шаг 1: Справочники

1. Создать `ResearchTypes`, `Sites`, `Laboratories`, `ContainerComments`.
2. Seed базовыми значениями (`seed_research_types`, `seed_sites`,
   `seed_laboratories`).

### Шаг 2: `Samples`

1. Добавить `number_prefix`, `number_middle`, `number_sequence`,
   `is_encrypted` (nullable).
2. Добавить `receipt_item_id` (FK, nullable).
3. **Миграция данных:** `research_type` (CharField) → `research_type_id` (FK).
   - Создать `ResearchType` по уникальным значениям.
   - Обновить FK.
   - Удалить старое поле.
4. **Миграция данных:** `site` (CharField) → `site_id` (FK). Аналогично.

### Шаг 3: `Containers`

1. Добавить `comment`, `comment_template_id`.
2. Добавить статус `PENDING_PLACEMENT` (изменение choices).

### Шаг 4: `WorkOrders`

1. Добавить `site_id` (FK, nullable).
2. Опционально — заполнить по паттернам Н/З.

### Шаг 5: Приёмка

1. Создать `Receipts`, `ReceiptItems`, `ImportSessions`.

## Бэкапы

Без изменений.

## Что НЕ хранится

Без изменений + **отложено**:
- Расшифровка проб (до появления ЛИМС-выгрузки).
- Печатные корзины (до серии 2.0).