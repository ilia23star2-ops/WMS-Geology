# API.md — контракты API

> Базовый URL: `/api/v1/`
> Формат: JSON, UTF-8.
> Аутентификация: JWT.
> Пагинация: `?page=1&per_page=50`, ответ — `{count, next, previous, results}`.

---

## Healthcheck

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/health/` | `200` без авторизации, `{status, service, time}` |

**`GET /health/`** — вне `/api/v1/`, без JWT. Используется Mobile (`c-6c`) для auto-detect сети. Не обращается к БД.

**Пример ответа:**

    {
      "status": "ok",
      "service": "wms-geology",
      "time": "2026-11-02T12:00:00.000000+00:00"
    }

---

## Аутентификация

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/auth/login` | Логин → access/refresh токены |
| `POST` | `/auth/refresh` | Обновление access-токена |
| `POST` | `/auth/logout` | Logout (blacklist refresh) |
| `GET` | `/auth/me` | Текущий пользователь |
| `POST` | `/auth/code-login/` | Одноразовый код → JWT |
| `POST` | `/auth/offline-login/` | Offline-токен → JWT (привязка к `device_id`) |
| `GET` | `/auth/access-tokens/` | Список токенов (свои + созданные) |
| `POST` | `/auth/access-tokens/` | Создать токен (QR) |
| `POST` | `/auth/access-tokens/{id}/revoke/` | Отозвать |

---

## Пробы (`Samples`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/samples` | Список с фильтрами |
| `GET` | `/samples/{id}` | Одна проба |
| `POST` | `/samples` | Создать пробу |
| `PATCH` | `/samples/{id}` | Обновить |
| `DELETE` | `/samples/{id}` | Удалить (hard; 409 при `ProtectedError`) |
| `POST` | `/samples/{id}/dispose/` | Утилизировать (soft) |
| `POST` | `/samples/{id}/restore/` | Вернуть из утилизации |
| `GET` | `/samples/grouped/` | Сгруппированный список |

**Фильтры `GET /samples`:**
- `q` — частичный поиск по номеру (`icontains`);
- `sample_number` — частичный поиск (`icontains`);
- `research_type` — ID типа исследования;
- `research_type_code` — код типа (ШЛ, ХА);
- `work_order` — номер Н/З (входящий **или** зашифрованный);
- `site`, `site_code` — участок;
- `well_id`, `container_id`, `status`;
- `no_work_order=true` — пробы без Н/З;
- `show_disposed=true` — показать утилизированные;
- **`updated_since=<ISO 8601>`** — только с `updated_at > момента` (c-6b);
- `page`, `per_page` — пагинация.

**`updated_since` (`c-6b`):**
- ISO 8601 с таймзоной (UTC, `Z` или `+00:00`).
- Naive datetime → 400 (`{"updated_since": ["updated_since должен содержать таймзону..."]}`).
- Невалидный ISO → 400.
- Пусто → без фильтра (полный Pull).

**Пример `GET /samples?q=34076001`:**

    {
      "count": 3,
      "next": null,
      "previous": null,
      "results": [
        {
          "id": 1,
          "sample_number": "TAA-A34076001-001",
          "research_type": 1,
          "research_type_name": "Шлифы",
          "container": 10,
          "container_number": "T-001",
          "current_work_order": 11,
          "current_work_order_number": "TST0001",
          "status": "IN_STORAGE",
          "current_location": "Комната 1 / Стеллаж A / Пролёт 1 / Ярус 2 / Ячейка 1",
          "updated_at": "2026-11-02T10:00:00Z"
        }
      ]
    }

**`current_location`** — вычисляемое поле:
- тара на поддоне в ячейке → `cell.full_address`;
- тара на полу в комнате → «На полу: <комната>»;
- тара без места → «Место не указано».

**Пример `POST /samples`:**

    {
      "sample_number": "TAA-A34076001-001",
      "research_type": 1,
      "container": 10,
      "well": 5,
      "depth_from": 120.5,
      "depth_to": 121.0,
      "site": 1,
      "current_work_order": 11
    }

### `POST /samples/{id}/dispose/`

Soft-утилизация. `status=DISPOSED`, `disposed_at=now`, `disposed_by=user`, `disposal_reason` (опционально).

**Тело:** `{"disposal_reason": "Разбита"}` (опционально).

**Ответ 200:** `SampleSerializer`.

**Ошибки:** 404 — не найдена; 400 — уже утилизирована.

### `POST /samples/{id}/restore/`

Возврат. Сбрасывает `disposed_*`, `status=IN_STORAGE`.

**Тело:** `{}`.

**Ответ 200:** `SampleSerializer`.

**Ошибки:** 404 — не найдена; 400 — не в `DISPOSED`.

### `DELETE /samples/{id}/`

Hard-delete. `ProtectedError` (`PickListItem`, `ShipmentItem`) → 409.

### `GET /samples/grouped/`

Сгруппированный список. Группа = `(Н/З, ТИ)`. Пагинация по группам (20).

**Формат ответа:**

    {
      "count": 120,
      "next": null,
      "previous": null,
      "page_size": 20,
      "results": [
        {
          "work_order": {"id": 5, "number": "TST0001", "type": "CODED"},
          "research_type": {"id": 1, "code": "ШЛ", "name": "Шлифы"},
          "total_samples": 31,
          "containers": [
            {
              "container": {
                "id": 10,
                "number": "T-001",
                "status": "ACTIVE",
                "cell_id": 15,
                "pallet_id": 3
              },
              "location": "Комната 1 / A / S1 / A / 5",
              "samples": [
                {
                  "id": 1,
                  "sample_number": "TAA-A34076001-001",
                  "status": "IN_STORAGE",
                  "updated_at": "2026-11-02T10:00:00Z"
                }
              ]
            }
          ]
        }
      ]
    }

Все фильтры `GET /samples` работают и для `grouped`.

---

## Наряд-заказы (`WorkOrders`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/work-orders` | Список |
| `GET` | `/work-orders/{id}` | Один Н/З со связанными |
| `POST` | `/work-orders` | Создать |
| `PATCH` | `/work-orders/{id}` | Обновить |
| `POST` | `/work-orders/{id}/link` | Связать INCOMING ↔ CODED |

**Фильтры:** `order_number`, `order_type`, `status`.

---

## Топология склада

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/storage/rooms` | Список комнат |
| `GET` | `/storage/racks?room_id=` | Стеллажи |
| `GET` | `/storage/sections?rack_id=` | Пролёты |
| `GET` | `/storage/tiers?section_id=` | Ярусы |
| `GET` | `/storage/cells?tier_id=` | Ячейки |
| `GET` | `/storage/cells/{id}` | Одна ячейка |
| `POST` | `/storage/cells` | Создать |
| `GET` | `/storage/sections/{id}/qr.pdf/` | PDF с QR секции |
| `GET` | `/storage/cells/{id}/qr.pdf/` | PDF с QR ячейки |
| `POST` | `/storage/sections/qr-batch/` | PDF с партией QR |

**QR топологии:** `Section.qr_code` / `Cell.qr_code` автогенерируются (`WMSG:SECTION:<id>` / `WMSG:CELL:<id>`). PDF: A4, QR 65×65, адрес под QR.

**`POST /storage/sections/qr-batch/`** — тело `{"items": [{"type": "SECTION"|"CELL", "id": int}, ...]}`.

---

## Тара и поддоны

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/storage/containers` | Список |
| `GET` | `/storage/containers/{id}` | Одна тара + пробы внутри |
| `POST` | `/storage/containers` | Создать одну |
| `PATCH` | `/storage/containers/{id}` | Обновить |
| `DELETE` | `/storage/containers/{id}` | Удалить (409 / `?force=true`) |
| `GET` | `/storage/containers/{id}/label.pdf/` | PDF-этикетка |
| `POST` | `/storage/containers/bulk-create/` | N тар-заготовок |
| `POST` | `/storage/containers/{id}/fill-samples/` | Заполнить пробами |
| `POST` | `/storage/containers/bulk-place/` | Разместить (ячейка / пол) |
| `POST` | `/storage/containers/create-in-cell/` | Создать тару в ячейке |
| `GET` | `/storage/pallets` | Список поддонов |
| `POST` | `/storage/pallets` | Создать поддон |
| `GET` | `/storage/containers/{id}/history/` | Аудит тары |

**Фильтры контейнеров:**
- `pallet_id`, `floor_room_id`, `container_type_id`, `status`, `comment_template_id`;
- `draft_work_order_coded` (icontains), `draft_research_type_id`;
- **`updated_since=<ISO 8601>`** — только с `updated_at > момента` (c-6b).

**c-2.x-lifecycle-1:** `ContainerType.is_disposable` (boolean). `Container.status` + `DISPOSED` (утилизирована). `GET /storage/containers/?show_disposed=true` — показать утилизированные (по умолчанию скрыты, как Sample).

**Статусы контейнера:**
- `PENDING_FILLING` — «Ожидает заполнения» (создана, проб нет);
- `PENDING_PLACEMENT` — «Ожидает размещения» (пробы есть, места нет);
- `ACTIVE` — «Размещена»;
- `IN_TRANSIT` — «В пути»;
- `ISSUED` — «Выдана».

**`ContainerSerializer` (c-6a, денормализация):**
- `container_type` (ID) + `container_type_name` (строка);
- `floor_room` (ID) + `floor_room_name` (строка);
- `pallet` (ID) + `cell_id` (ID) + `cell_full_address` (строка);
- `comment_template` (ID) + `comment_template_text` (строка);
- `draft_site` (ID) + `draft_site_name` (строка);
- `draft_research_type` (ID) + `draft_research_type_name` (строка);
- `print_batch_status` — статус последней не-CANCELLED партии (`null` / `DRAFT` / `READY` / `PRINTED`).

**`?updated_since=` (c-6b):** ISO с таймзоной; naive / невалидный → 400; пусто — полный Pull.

**`DELETE /storage/containers/{id}/`:** `ProtectedError` (`PrintBatchItem`, пробы) → 409. `?force=true` — сначала удалить пробы, потом тару, одной транзакцией.

### `POST /storage/containers/bulk-create/`

Создать N тар-заготовок. Пробы добавляются отдельно (`fill-samples`).

**Тело:**

    {
      "containers": [
        {"container_number": "T-BULK-001", "container_type_id": 1},
        {"container_type_id": 1}
      ],
      "draft_site_id": 1,
      "draft_research_type_id": 1,
      "draft_work_order_coded": "TST0001",
      "draft_work_order_incoming": "02-Тест001"
    }

**Логика:**
- Каждая тара — `PENDING_FILLING`.
- `container_number` опционален (`NULL` — заготовка).
- Draft-поля сохраняются.
- `status` в теле не принимается.

**Ответ 201:** `{created_containers: [...], total_containers: N}`.

**Ошибки:** 400 — номер уже есть, `container_type_id` не найден, номера не уникальны в запросе, пустой `containers`.

### `POST /storage/containers/{id}/fill-samples/`

Заполнить тару пробами.

**Тело:**

    {
      "container_number": "T-FILL-001",
      "work_order_coded": "TST0001",
      "work_order_incoming": "02-Тест001",
      "research_type_id": 1,
      "site_id": 1,
      "sample_groups": [
        {
          "prefix": "TAA-A",
          "middle": "34076",
          "sequence_from": 1,
          "sequence_to": 5,
          "sequence_digits": 3,
          "well_name": null,
          "status": "NORMAL"
        },
        {
          "prefix": "TST",
          "middle": "124",
          "sequence_from": 1,
          "sequence_to": 3,
          "well_name": "124",
          "status": "SELECTED"
        }
      ]
    }

**Логика:**
- Найти/создать `WorkOrder` (CODED). Если `work_order_incoming` — связать INCOMING ↔ CODED.
- Одна тара = один ТИ. Пробы другого ТИ — 400.
- `container_number` опционален; если задан и пуст — присвоить; если уже есть — не перезаписывать.
- Статус: `PENDING_FILLING → PENDING_PLACEMENT`.
- Статусы проб синхронизируются (кроме `SELECTED`, `DISPOSED`).
- Draft-поля обновляются из запроса (1.69).

**Ответ 201:**

    {
      "container_id": 10,
      "container_number": "T-FILL-001",
      "created_samples": [
        {"id": 1, "sample_number": "TAA-A34076001", "status": "PENDING_PLACEMENT"},
        {"id": 2, "sample_number": "TAA-A34076002", "status": "PENDING_PLACEMENT"}
      ],
      "total_samples": 2
    }

**Ошибки:** 404 — тара не найдена; 400 — `research_type_id`/`site_id` не найдены, `sequence_from > sequence_to`, диапазон > 1000, пробы другого ТИ.

### `POST /storage/containers/bulk-place/`

Разместить тары в ячейку (через поддон) или на пол.

**Тело:**

    {"container_ids": [10, 11, 12], "cell_id": 5}

или

    {"container_ids": [10], "floor_room_id": 2}

**Логика:** `cell_id` — поддон создаётся, если нет; `floor_room_id` — на пол. Статус → `ACTIVE`.

**Ответ 200:** `{"message": "..."}`.

### `POST /storage/containers/create-in-cell/`

Атомарно: создать тару + заполнить + привязать к ячейке.

**Тело:**

    {
      "cell_id": 5,
      "container_type_id": 1,
      "container_number": "T-123",
      "work_order_coded": "Sev00544",
      "research_type_id": 1,
      "site_id": 1,
      "sample_groups": [...]
    }

**Ответ 201:** `{container_id, container_number, total_samples}`.

### `GET /storage/containers/{id}/history/`

Аудит тары. Возвращает `AuditLog` по `entity_type="Container"`, `entity_id=id`, `-created_at`.

**Формат:**

    [
      {
        "id": 1,
        "user": 1,
        "username": "admin",
        "action": "CREATE",
        "action_display": "Создана",
        "entity_type": "Container",
        "entity_id": 42,
        "old_value": null,
        "new_value": {"status": "PENDING_FILLING", "container_number": "T-001", "container_type_id": 3, "pallet_id": null, "floor_room_id": null, "sample_count": 0},
        "created_at": "2026-11-02T10:00:00Z"
      }
    ]

**Действия:** `CREATE`, `UPDATE`, `DELETE`, `FILL_SAMPLES`, `PLACE`, `CREATE_IN_CELL`.

---

## Партии печати (`PrintBatch`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/labels/print-batches` | Список партий |
| `GET` | `/labels/print-batches/{id}` | Одна партия с items |
| `POST` | `/labels/print-batches` | Создать черновик |
| `PATCH` | `/labels/print-batches/{id}` | Изменить (`name`, `comment` — в любом статусе) |
| `DELETE` | `/labels/print-batches/{id}` | Hard-delete (только `DRAFT` / `CANCELLED`) |
| `POST` | `/labels/print-batches/{id}/add-containers/` | Добавить тары |
| `POST` | `/labels/print-batches/{id}/remove-container/` | Убрать тару |
| `POST` | `/labels/print-batches/{id}/mark-ready/` | `DRAFT → READY` |
| `POST` | `/labels/print-batches/{id}/cancel/` | Отмена (soft) |
| `GET` | `/labels/print-batches/{id}/pdf/` | PDF (`READY → PRINTED` авто) |
| `GET` | `/labels/print-batches/{id}/companion.pdf/` | Сопроводительный лист |
| `POST` | `/labels/print-batches/{id}/mark-printed/` | Ручная пометка `PRINTED` |

**Ограничения:**
- `PUT` — запрещён (405).
- Изменять/наполнять — только `DRAFT`.
- Отменить — `DRAFT` и `READY`, нельзя `PRINTED` и `CANCELLED`.

**Фильтры:** `?status=`, `?print_type=`.

---

## Приёмка рейсов (`Receiving`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/receipts` | Список партий |
| `GET` | `/receipts/{id}` | Одна партия |
| `POST` | `/receipts/{id}/confirm` | Подтвердить (ручной override) |
| `POST` | `/receipts/{id}/cancel` | Отменить |
| `GET` | `/receipts/{id}/conflicts/` | Неразобранные `NEEDS_CONFIRMATION` |
| `POST` | `/receipts/{id}/resolve-conflicts/` | Разобрать конфликты |
| `POST` | `/receipts/{id}/check/` | Сверка тары (batch) |
| `POST` | `/receipts/{id}/complete/` | Завершить приёмку |
| `GET` | `/receipts/{id}/act/` | PDF «Акт приёмки» (только `CONFIRMED`) |
| `GET` | `/receipt-items` | Строки партии |
| `DELETE` | `/receipt-items/{id}` | Удалить строку (каскад) |
| `GET` | `/import-sessions` | Сессии импорта |
| `POST` | `/import-sessions/upload/` | Excel → Receipt + ReceiptItem |
| `POST` | `/import-sessions/import-shipment/` | Excel → Shipment + Receipt + Container |

**Фильтры `GET /receipts`:** `status`, `laboratory_id`, `site_id`, `shipment_id`.
**Фильтры `GET /receipt-items`:** `receipt_id`, `status`, `container_id`.

### `GET /receipts/{id}/conflicts/`

Неразобранные (`code=NEEDS_CONFIRMATION`, `resolved != true`). С полями вопроса, `question_index`, `suggested_count`.

### `POST /receipts/{id}/resolve-conflicts/`

**Тело:** `{"conflicts": [{"question_index": 3, "containers_count": 2}]}`.

Создаёт N `ReceiptItem` (без `Container`), помечает вопрос `resolved`.

**Ответ 200:** `{receipt_id, created_items_count, resolved_conflicts_count, total_conflicts_count, errors: []}`.

**Ошибки 400:** невалидный индекс, уже разобран, `containers_count > declared_count`, дубликат `question_index`.

### `POST /receipts/{id}/check/`

**Тело:**

    {"items": [{"item_id": 101, "matched": true, "container_number": "1"}, {"item_id": 102, "matched": false}]}

**Логика:**
- `matched=true` → `Container` со статусом **`PENDING_FILLING`**, присвоить номер, `ReceiptItem.status=MATCHED`.
- `matched=false` → удалить `Container` (если нет проб), `ReceiptItem.status=MISSING`.
- `Receipt.status=IN_PROGRESS`.

**Ответ 200:** `{receipt_id, total_items_count, matched_count, missing_count, errors: []}`.

**Ошибки 400:** строка не из партии, `container_type` не заполнен, дубликат номера.

### `POST /receipts/{id}/complete/`

**Проверки:** нет неразобранных `NEEDS_CONFIRMATION`; нет `ReceiptItem.status=EXPECTED`.

**Действия:** `Receipt.status=CONFIRMED`, `received_at=now`; `Shipment.status=RECEIVED` или `PARTIALLY_RECEIVED`.

**Ответ 200:** `{receipt_id, status, total_items_count, matched_count, missing_count, other_count, shipment_id, shipment_status, errors: []}`.

**Ошибки 400:** остались конфликты; `EXPECTED`; партия пуста; уже `CONFIRMED`/`CANCELLED`.

### `GET /receipts/{id}/act/`

PDF «Акт приёмки». Только `Receipt.status=CONFIRMED`.

**Ответ 200:** `application/pdf`, `Content-Disposition: inline; filename="act_<receipt_number>.pdf"`.

**Ошибки 400:** статус не `CONFIRMED`.

### `DELETE /receipt-items/{id}/`

Каскад: пробы → тара → строка. Одна транзакция.

**Ошибки:** 404 — нет; 409 — проба защищена (`PickListItem` / `ShipmentItem`) или тара защищена (`PrintBatchItem`).

### `POST /import-sessions/upload/`

Старый импорт: `Receipt` + `ReceiptItem`, **без** `Shipment` и `Container`.

**Form-data:**
- `file` — обязателен (`.xlsx` / `.xlsm`);
- `target_date` — обязателен (ISO `2026-10-12` или рус. `12.10.2026`);
- `duplicate_action` — `cancel` / `overwrite` / `create` (default `cancel`).

**Ответ 200:** `{import_session_id, status, file_format, sheets_count, rows_count, containers_count, parse_errors, receipts}`.
**Ответ 409:** `DUPLICATE_DATE`.

### `POST /import-sessions/import-shipment/`

Новый импорт: создаёт рейс целиком.
- `Shipment` (INBOUND, SENT, site=NULL);
- один `Receipt` (`site=NULL`, `shipment=shipment`);
- `ReceiptItem` на каждую тару (`expected_samples_count=1`);
- `Container` (`status=IN_TRANSIT`, `container_number=NULL`, draft-поля).

**Form-data:**
- `file` — обязателен (`.xlsx` / `.xlsm`);
- `target_date` — обязателен;
- `shipment_number` — опционален (`Р-{year}-NNN` по умолчанию);
- `laboratory_id` — опционален.

**Спорные ячейки** — в `parse_errors` с `code=NEEDS_CONFIRMATION` и `reason`: `no_dates`, `multi_date_match`, `target_date_not_matched`. Такие ячейки **пропускаются**, `status=PARSED` (не `APPLIED`).

**Ответ 200:** `{import_session_id, status, shipment_id, shipment_number, receipt_id, receipt_number, containers_count, questions_count, parse_errors}`.

**Ошибки:** 400 — нет файла / плохая дата / неподдерживаемый формат; 200 + `status=ERROR`, `shipment_id=null` — нечего создавать.

**Формат Excel:**
- 1–2 строки «шапки» до заголовков (`MAX_HEADER_SEARCH=20`).
- Строка заголовков: `№ Наряд-заказа` / `Н/З` / `Наряд` + блоки типов + `Дата`.
- **Сразу после заголовков** — строка **типа тары** (`Ящики`, `Биг-бэг`). Обязательна для каждой колонки типа.
- Каждый блок «типы + Дата» — своя дата. В ячейке «Дата» — список через запятую.
- Количество тары: число или `1+1` (сумма).
- Дата без года (`13.08`) — текущий год.

---

## Формат ошибок
## Отправка (Shipments, c-2.x-shipments-1)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/shipments` | Список рейсов (фильтры: direction, status, laboratory_id, site_id) |
| `GET` | `/shipments/{id}` | Один рейс с `container_items` |
| `POST` | `/shipments` | Создать рейс (DRAFT) |
| `PATCH` | `/shipments/{id}` | Обновить (`name`, `shipment_date`, `laboratory`…) |
| `DELETE` | `/shipments/{id}` | Удалить рейс |
| `POST` | `/shipments/{id}/add-containers/` | Добавить тары (OUTBOUND, DRAFT/ASSEMBLED) |
| `POST` | `/shipments/{id}/remove-container/` | Убрать тару (OUTBOUND, DRAFT/ASSEMBLED) |
| `POST` | `/shipments/{id}/add-from-pick-list/` | Добавить пробы из выборки (пробы, не тары) |
| `POST` | `/shipments/{id}/assemble/` | DRAFT → ASSEMBLED |
| `POST` | `/shipments/{id}/send/` | DRAFT/ASSEMBLED → SENT (тары и пробы → IN_TRANSIT) |
| `POST` | `/shipments/{id}/cancel/` | Отмена (до RECEIVED) |

**Статусы:** `DRAFT` / `ASSEMBLED` / `SENT` / `RECEIVED` / `PARTIALLY_RECEIVED` / `RETURNED` / `CANCELLED` / `LOST`.

**Направления:** `OUTBOUND` (мы → лаборатория), `INBOUND` (лаборатория → мы).

**Модель:** `Shipment` содержит `name` (опционально), `container_items` (список тар через `ShipmentContainerItem` — только для OUTBOUND).

**Поведение `send`:** для каждой тары в рейсе: `Container.status = IN_TRANSIT`; все пробы внутри синхронизируются (`Sample.status = IN_TRANSIT`, см. решение 1.110).


Единый для всех 4xx/5xx:

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Номер пробы обязателен",
        "details": {"sample_number": "required"}
      }
    }

Коды: `VALIDATION_ERROR`, `NOT_FOUND`, `PERMISSION_DENIED`, `CONFLICT`, `INTERNAL_ERROR`.

**Исключение** — custom actions, возвращающие простую форму:

    {"error": "<строка>"}

Так делают: `check`, `complete`, `act`, `dispose`, `restore`, `destroy` (409), `delete receipt-item` (409), `qr-batch` (400/404), `bulk-place`, `create-in-cell`.

**`?updated_since=` (c-6b) — DRF ValidationError:**

    {"updated_since": ["updated_since должен содержать таймзону (UTC, суффикс Z)."]}

---

## Открытые вопросы

- Версионирование API в URL или заголовке? → сейчас в URL.
- Лимит `per_page`? → предложить 200.
- Глобальный `/search` — пока не реализован. Используются фильтры `GET /samples?q=` и `?work_order=`.
- `POST /receiving/items/{id}/fill/` — заполнение заготовки приёмки — в разработке.