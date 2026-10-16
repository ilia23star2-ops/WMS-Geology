# DATABASE.md — схема данных

## Общее

- **СУБД:** PostgreSQL 16+ (портативный / Docker).
- **Кодировка:** UTF-8.
- **Временная зона:** UTC (хранение), локальная (отображение).
- **Версия схемы:** 7.
- **Миграции:** Django migrations в `backend/apps/*/migrations/`.

## История версий

- **v1** — базовые модели (серия 1.0).
- **v2** — топология A–D, «тихий» Pallet, ContainerType (1.0a).
- **v3** — справочники, структура номера пробы, приёмка (1.3).
- **v4** — Портал лабораторий: `Shipment.direction`, расширенные
  статусы, `ContainerType.laboratory_id`, `Receipt.shipment_id`.
- **v5** — Партии печати: `PrintBatches`, `PrintBatchItems` (2.1).
- **v6** — Container draft-поля + nullable `container_number`
  (2.x-web-v2, bundle-7a-2b).
- **v7** — Container `PENDING_FILLING` + снят UNIQUE с
  `container_number` + AlterField `qr_code` (help_text)
  (2.x-web-v2, пачки `2f-4c-1`, `2f-5c-1`, `receiving-3d-3-fix-2`).

## Изменения v6 → v7

Решения **1.61, 1.62, 1.63** из `docs/DECISIONS.md`:

**Миграция `storage/0006_alter_container_container_number`** (решение 1.61):
- `Containers.container_number` — **снят `UNIQUE`**.
- Семантика: номер тары — метка внутри группы (Н/З × ТИ),
  идентификатор — `id`. Уникальность в группе не проверяется
  на уровне БД.

**Миграция `storage/0007_alter_cell_qr_code_alter_section_qr_code`**
(решение 1.63):
- `Sections.qr_code`, `Cells.qr_code` — `AlterField` (только
  `help_text`: «Автогенерируется при создании»).
- Автогенерация выполняется в `save()`: `WMSG:SECTION:<id>` /
  `WMSG:CELL:<id>`.

**Миграция `storage/0008_alter_container_status` + data-migration**
(решение 1.62):
- В `Containers.status` добавлен `PENDING_FILLING`
  («Ожидает заполнения»). Статус — первым в `STATUS_CHOICES`.
- Data-migration: старые тары `PENDING_PLACEMENT` **без проб** →
  `PENDING_FILLING`. Тары с пробами — без изменений.

## Изменения v5 → v6

Решения **1.60** из `docs/DECISIONS.md`:

- `Containers.container_number` — стал nullable (заготовки без номера).
- +4 draft-поля: `draft_site_id` (FK → Sites, SET_NULL),
  `draft_research_type_id` (FK → ResearchTypes, SET_NULL),
  `draft_work_order_coded` (VARCHAR(100), default ""),
  `draft_work_order_incoming` (VARCHAR(100), default "").

## Изменения v4 → v5

Решения **1.48, 1.55, 1.56, 1.57** из `docs/DECISIONS.md`:

- Новые таблицы: `PrintBatches`, `PrintBatchItems`.

## Изменения v3 → v4

Решения **1.52**:

- `ContainerType.laboratory_id` (FK, nullable).
- `Shipment.direction` (`INBOUND` / `OUTBOUND`).
- `Shipment` — расширенные поля (`site_id`, `laboratory_id`,
  `shipment_date`, `driver_name`, `vehicle_number`, `assembled_at`,
  `sent_at`, `received_at`, `cancelled_at`, `cancelled_by_id`,
  `cancel_reason`) и расширенный набор статусов.
- `Receipt.shipment_id` (FK, nullable) — рейс-источник.

## Изменения v2 → v3

Решения **1.35 – 1.51**:

- Новые справочники: `ResearchTypes`, `Sites`, `Laboratories`,
  `ContainerComments`.
- `Samples.research_type` → FK на `ResearchTypes`.
- `Samples.site` → FK на `Sites`.
- `Samples` + `number_prefix`, `number_middle`, `number_sequence`,
  `is_encrypted`.
- `Containers` + `comment`, `comment_template_id`, статус
  `PENDING_PLACEMENT`.
- `WorkOrders` + `site_id` (FK).
- Новые: `Receipts`, `ReceiptItems`, `ImportSessions`.

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
| `match_patterns` | JSONB | `["TST", "Тест"]` |
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
| `prefixes` | JSONB | `["TAA-A", "TAA-B"]` |
| `description` | TEXT | |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `code`.

#### `ContainerComments`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `text` | VARCHAR(500) | «Повреждена», «Влажная» |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `text`.

---

### Пользователи

#### `Roles`, `Users` (Django auth_user), `UserProfiles`, `AuditLogs`

Без изменений (v1).

---

### Топология склада

#### `Rooms`, `Racks`, `Sections`, `Tiers`, `Cells`

Без изменений (v2).

- `Sections.qr_code` — автогенерируется в `save()` (payload
  `WMSG:SECTION:<id>`), если пусто.
- `Cells.qr_code` — автогенерируется в `save()` (payload
  `WMSG:CELL:<id>`), если пусто.
- `Cells.cell_type` — `STANDARD` / `CORE`.

#### `Pallets` (Вариант A)

Без изменений (v2):

- OneToOne с `Cell`.
- Без `qr_code`, без `pallet_code`, без `position_in_cell`.
- `pallet_type`, `capacity_override` (JSONB).
- Статусы: `ACTIVE / EMPTY / IN_TRANSIT`.

#### `ContainerTypes`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(100) | «Коробка», «Ящик» |
| `laboratory_id` | INT FK → Laboratories NULL | NULL = общий |
| `size_class` | VARCHAR(10) | `S / M / L / XL` |
| `max_on_standard_pallet` | INT DEFAULT 10 | |
| `is_core` | BOOLEAN DEFAULT FALSE | |
| `description` | TEXT | |

**Уникальность:** `(name, laboratory_id)`.
**Правило:** `laboratory_id = NULL` → общий тип; иначе — только этой
лаборатории.

#### `Containers`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `container_number` | VARCHAR(100) NULL | NULL = заготовка без номера. **Без UNIQUE** (см. 1.61) |
| `container_type_id` | INT FK → ContainerTypes (PROTECT) | |
| `qr_code` | TEXT UNIQUE NULL | `WMSG:CONTAINER:<id>` |
| `pallet_id` | INT FK → Pallets NULL | |
| `floor_room_id` | INT FK → Rooms NULL | |
| `position_on_pallet` | INT NULL | |
| `comment` | TEXT | |
| `comment_template_id` | INT FK → ContainerComments NULL | |
| `status` | VARCHAR(50) | `PENDING_FILLING / PENDING_PLACEMENT / ACTIVE / IN_TRANSIT / ISSUED` |
| `draft_site_id` | INT FK → Sites NULL | участок (черновик до заполнения) |
| `draft_research_type_id` | INT FK → ResearchTypes NULL | ТИ (черновик) |
| `draft_work_order_coded` | VARCHAR(100) DEFAULT "" | Н/З coded (черновик) |
| `draft_work_order_incoming` | VARCHAR(100) DEFAULT "" | Н/З входящий (черновик) |
| `created_at` | TIMESTAMPTZ | |

**CHECK:** `pallet_id` и `floor_room_id` не заданы одновременно.

**Статус `PENDING_FILLING`** (см. DECISIONS 1.62): тара создана
(импортом или через `bulk-create`), пробы ещё не заведены. После
`fill-samples` → `PENDING_PLACEMENT`. Признак того, что тару
надо заполнить.

**`container_number` — не уникален** (см. DECISIONS 1.61).
Семантика: метка внутри группы (Н/З × ТИ). Идентификатор — `id`.

**Draft-поля** заполняются при создании тары-заготовки
(`POST /storage/containers/bulk-create/`). Используются для
предзаполнения формы `fill-samples`. Обнуляются после успешного
заполнения тары пробами.

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
| `site_id` | INT FK → Sites NULL | |
| `status` | VARCHAR(50) | |
| `description` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Уникальность:** `(order_number, order_type)`.
**CHECK:** `id <> linked_order_id`.

#### `Samples`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `sample_number` | VARCHAR(100) | полный номер, как есть (не уникален) |
| `is_encrypted` | BOOLEAN | шифрованная или нет |
| `number_prefix` | VARCHAR(50) | `TAA-A` или `TST` |
| `number_middle` | VARCHAR(50) | `34076001` или `124` |
| `number_sequence` | VARCHAR(20) | `001`, `01`, `7021` |
| `research_type_id` | INT FK → ResearchTypes (PROTECT) | |
| `well_id` | INT FK → Wells NULL | |
| `depth_from` | NUMERIC(10,2) NULL | |
| `depth_to` | NUMERIC(10,2) NULL | |
| `site_id` | INT FK → Sites NULL | |
| `container_id` | INT FK → Containers (PROTECT) NOT NULL | |
| `current_work_order_id` | INT FK → WorkOrders NULL | |
| `status` | VARCHAR(50) | `IN_STORAGE / IN_TRANSIT / ISSUED / CONSUMED / DISPOSED / PENDING_DECRYPTION / PENDING_PLACEMENT` |
| `receipt_item_id` | INT FK → ReceiptItems NULL | |
| `qr_code` | TEXT UNIQUE NULL | |
| `legacy_data` | JSONB NULL | |
| `disposed_at` | TIMESTAMPTZ NULL | |
| `disposed_by_id` | INT FK → User NULL | |
| `disposal_reason` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы:** `sample_number`, `number_prefix`, `number_middle`,
`research_type`, `container`, `current_work_order`, `site`, `status`.

**Примечание:** поля `number_prefix`, `number_middle`,
`number_sequence`, `is_encrypted` пока не реализованы — задел
на серию 2.x.

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
| `shipment_id` | INT FK → Shipments NULL | рейс-источник |
| `excel_file` | FILE NULL | исходный Excel |
| `imported_at` | TIMESTAMPTZ NULL | |
| `imported_by_id` | INT FK → User NULL | |
| `received_at` | TIMESTAMPTZ NULL | |
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
| `container_id` | INT FK → Containers NULL | |
| `container_type_id` | INT FK → ContainerTypes NULL | тип тары (заполняется из импорта/разбора) |
| `expected_container_number` | VARCHAR(100) | |
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

**Удаление** (`DELETE /receipt-items/{id}/`) — каскадное
(см. DECISIONS 1.64): пробы тары → тара → строка. Одна транзакция,
`ProtectedError` → 409.

#### `ImportSessions`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `file` | FILE | загруженный Excel |
| `file_format` | VARCHAR(20) | `XLSX / CSV` |
| `uploaded_at` | TIMESTAMPTZ | |
| `uploaded_by_id` | INT FK → User NULL | |
| `status` | VARCHAR(50) | `PARSING / PARSED / ERROR / APPLIED` |
| `parse_errors` | JSONB | список ошибок/вопросов |
| `receipt_id` | INT FK → Receipts NULL | |

---

### Выборка и отправка

#### `PickLists`, `PickListItems`

Без изменений (v2).

#### `Shipments`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `shipment_number` | VARCHAR(100) UNIQUE | `Р-2026-001` / `ОТ-2026-001` |
| `direction` | VARCHAR(20) | `INBOUND` / `OUTBOUND` |
| `destination` | VARCHAR(200) | |
| `laboratory_id` | INT FK → Laboratories NULL | |
| `site_id` | INT FK → Sites NULL | |
| `shipment_date` | DATE NULL | |
| `driver_name` | VARCHAR(200) | |
| `vehicle_number` | VARCHAR(50) | |
| `status` | VARCHAR(50) | расширен |
| `assembled_at` | TIMESTAMPTZ NULL | |
| `sent_at` | TIMESTAMPTZ NULL | |
| `received_at` | TIMESTAMPTZ NULL | |
| `cancelled_at` | TIMESTAMPTZ NULL | |
| `cancelled_by_id` | INT FK → User NULL | |
| `cancel_reason` | TEXT | |
| `sent_by_id` | INT FK → User NULL | |
| `note` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Статусы:**
`DRAFT / ASSEMBLED / SENT / RECEIVED / PARTIALLY_RECEIVED /
RETURNED / CANCELLED / LOST`.

**Направления:**
- `INBOUND` — лаборатория → мы. Порождает `Receipt` при приёмке.
- `OUTBOUND` — мы → лаборатория. Лаборатория подтверждает получение.

**Индексы:** `shipment_number`, `direction`, `status`,
`laboratory_id`, `-created_at`.

#### `ShipmentItems`

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

### Партии печати (v5)

#### `PrintBatches`

| Поле | Тип | Описание |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `batch_number` | VARCHAR(100) UNIQUE | `ПЕЧ-2026-001` |
| `print_type` | VARCHAR(20) | `LABELS` / `QR_ONLY` |
| `status` | VARCHAR(20) | `DRAFT / READY / PRINTED / CANCELLED` |
| `created_by_id` | INT FK → User NULL | |
| `printed_at` | TIMESTAMPTZ NULL | |
| `printed_by_id` | INT FK → User NULL | |
| `total_items` | INT DEFAULT 0 | снимок на момент печати |
| `total_pages` | INT DEFAULT 0 | снимок на момент печати |
| `comment` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Soft-delete:** отмена через `status = CANCELLED`.

#### `PrintBatchItems`

| Поле | Тип | Описание |
|---|---|---|
| `id` | BIGSERIAL PK | |
| `batch_id` | INT FK → PrintBatches (CASCADE) | |
| `container_id` | INT FK → Containers (PROTECT) | |
| `position` | INT DEFAULT 0 | порядок в партии |
| `created_at` | TIMESTAMPTZ | |

**Уникальность:** `(batch_id, container_id)`.

---

### Отложено (серия 2.x+)

#### `SampleDecryption`

Таблица соответствия шифрованных и нешифрованных проб
(решение 1.42). Пока не создаём — есть `Sample.legacy_data` (JSONB).

---

## Соглашения

- **Именование таблиц:** PascalCase во множественном числе.
- **Именование полей:** snake_case.
- **Timestamp:** `TIMESTAMPTZ` везде. Хранение в UTC.
- **JSONB:** `legacy_data`, `match_patterns`, `prefixes`,
  `scanned_barcodes`, `parse_errors`, `capacity_override`.
- **CHECK-constraints:** `condition=` (Django 5.2+).
- **CASCADE / PROTECT / SET_NULL:** явно указано у каждого FK.
- **Справочники:** `PROTECT` на FK из реальных данных.

## PDF-рендеры (не в БД)

- **Этикетка тары** — `apps/labels/services/label_service.py`.
- **QR топологии (Section, Cell)** — `apps/storage/services/qr_topology.py`.
  A4, сетка 2×3, QR 65×65, адрес под QR.
- **Акт приёмки** — `apps/labels/services/act_service.py`.
  A4 portrait, шапка/метаданные/сводка/таблица/подписи.

## Бэкапы

Без изменений.

## Что НЕ хранится

- Расшифровка проб (до появления ЛИМС-выгрузки).
- Сгенерированные PDF-этикетки (генерируются на лету).