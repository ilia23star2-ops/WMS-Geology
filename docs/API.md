# API.md — контракты API

> Базовый URL: `/api/v1/`
> Формат: JSON, UTF-8.
> Аутентификация: JWT.
> Пагинация: `?page=1&per_page=50`, ответ — `{count, next, previous, results}`.

---

## Аутентификация

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/auth/login` | Логин → access/refresh токены |
| `POST` | `/auth/refresh` | Обновление access-токена |
| `POST` | `/auth/logout` | Logout (blacklist refresh) |
| `GET` | `/auth/me` | Текущий пользователь |

---

## Пробы (`Samples`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/samples` | Список с фильтрами |
| `GET` | `/samples/{id}` | Одна проба |
| `POST` | `/samples` | Создать пробу |
| `PATCH` | `/samples/{id}` | Обновить |
| `DELETE` | `/samples/{id}` | Удалить (hard; 409 при `ProtectedError`) |
| `POST` | `/samples/{id}/dispose/` | Утилизировать (soft, с аудитом) |
| `POST` | `/samples/{id}/restore/` | Вернуть из утилизации |
| `GET` | `/samples/grouped/` | Сгруппированный список (Н/З + тип → тара) |

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
- `page`, `per_page` — пагинация.

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
          "current_location": "Комната 1 / Стеллаж A / Пролёт 1 / Ярус 2 / Ячейка 1"
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

Soft-утилизация пробы. Устанавливает `status=DISPOSED`,
`disposed_at=now`, `disposed_by=request.user`,
`disposal_reason` (опционально).

**Тело запроса:**

    {
      "disposal_reason": "Разбита"
    }

`disposal_reason` — опционально. Пустая строка допустима.

**Ответ 200:** `SampleSerializer` с новыми значениями.

**Ошибки:**
- 404 — проба не найдена;
- 400 — проба уже утилизирована.

### `POST /samples/{id}/restore/`

Возврат из утилизации. Сбрасывает `disposed_at`, `disposed_by`,
`disposal_reason`, ставит `status=IN_STORAGE`.

**Тело:** пустое (`{}`).

**Ответ 200:** `SampleSerializer`.

**Ошибки:**
- 404 — проба не найдена;
- 400 — проба не в статусе `DISPOSED`.

### `DELETE /samples/{id}/`

Hard-delete пробы. Если проба фигурирует в `PickListItem` или
`ShipmentItem` — 409.

**Ошибки:**
- 404 — проба не найдена;
- 409 — `{"error": "Нельзя удалить пробу: на неё ссылаются связанные объекты (N)."}`.

### `GET /samples/grouped/`

Сгруппированный список проб. Группа = `(Н/З, тип исследования)`.
Внутри — тары с пробами. Пагинация — **по группам** (20 на страницу).

**Порядок групп:** по алфавиту `work_order.order_number`; пробы
без Н/З — **в конце**; внутри одного Н/З — по коду типа.

**Формат ответа:**

    {
      "count": 120,
      "next": "http://.../api/v1/samples/grouped/?page=2",
      "previous": null,
      "page_size": 20,
      "results": [
        {
          "work_order": {"id": 5, "number": "TST0001", "type": "CODED"},
          "research_type": {"id": 1, "code": "ШЛ", "name": "Шлифы"},
          "total_samples": 31,
          "containers": [
            {
              "container": {"id": 10, "number": "T-001", "status": "ACTIVE"},
              "location": "Комната 1 / A / S1 / A / 5",
              "samples": [
                {
                  "id": 1,
                  "sample_number": "TAA-A34076001-001",
                  "status": "IN_STORAGE",
                  "updated_at": "2026-10-12T10:00:00Z"
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
| `GET` | `/storage/racks?room_id=` | Стеллажи комнаты |
| `GET` | `/storage/sections?rack_id=` | Пролёты |
| `GET` | `/storage/tiers?section_id=` | Ярусы |
| `GET` | `/storage/cells?tier_id=` | Ячейки |
| `GET` | `/storage/cells/{id}` | Одна ячейка |
| `POST` | `/storage/cells` | Создать (admin) |
| `GET` | `/storage/sections/{id}/qr.pdf/` | PDF с QR секции (2f-4c-1) |
| `GET` | `/storage/cells/{id}/qr.pdf/` | PDF с QR ячейки (2f-4c-1) |
| `POST` | `/storage/sections/qr-batch/` | PDF с партией QR (2f-4c-1) |

### QR топологии

`Section.qr_code` и `Cell.qr_code` **автогенерируются** при
создании, если не заданы явно. Payload:
`WMSG:SECTION:<id>` / `WMSG:CELL:<id>`.

### `GET /storage/sections/{id}/qr.pdf/`

PDF с QR одной секции. Формат: A4, QR 65×65 мм, под ним
адрес `Room / Rack / Section`.

**Ответ 200:** `application/pdf`.

### `GET /storage/cells/{id}/qr.pdf/`

PDF с QR одной ячейки. Под QR — `full_address`.

**Ответ 200:** `application/pdf`.

### `POST /storage/sections/qr-batch/`

PDF с партией QR (Section + Cell). Раскладка 2 × 3 = 6 QR на
лист A4. Адреса собираются на сервере.

**Тело запроса:**

    {
      "items": [
        {"type": "SECTION", "id": 12},
        {"type": "CELL", "id": 45},
        {"type": "CELL", "id": 46}
      ]
    }

**Логика:**
- `type` — `SECTION` или `CELL`;
- для `SECTION` адрес собирается из `Room / Rack / Section`;
- для `CELL` — `full_address`.

**Ответ 200:** `application/pdf`.

**Ошибки:**
- 400 — `items` пустой или не список;
- 404 — объект по id не найден;
- 400 — неизвестный `type`.

---

## Тара и поддоны

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/storage/containers` | Список |
| `GET` | `/storage/containers/{id}` | Одна тара + пробы внутри |
| `POST` | `/storage/containers` | Создать одну |
| `PATCH` | `/storage/containers/{id}` | Обновить |
| `DELETE` | `/storage/containers/{id}` | Удалить (409 при `ProtectedError`) |
| `GET` | `/storage/containers/{id}/label.pdf/` | PDF-этикетка тары |
| `POST` | `/storage/containers/bulk-create/` | Создать N тар-заготовок (без проб) |
| `POST` | `/storage/containers/{id}/fill-samples/` | Заполнить тару пробами |
| `GET` | `/storage/pallets` | Список поддонов |
| `POST` | `/storage/pallets` | Создать поддон |

**Фильтры контейнеров:** `pallet_id`, `floor_room_id`,
`container_type_id`, `status`, `comment_template_id`,
`draft_work_order_coded` (icontains), `draft_research_type_id`.

**Статусы контейнера (2f-5c-1):**
- `PENDING_FILLING` — «Ожидает заполнения» (создана, проб нет);
- `PENDING_PLACEMENT` — «Ожидает размещения» (пробы есть, места нет);
- `ACTIVE` — «Размещена»;
- `IN_TRANSIT` — «В пути»;
- `ISSUED` — «Выдана».

**`DELETE /storage/containers/{id}/`** (2f-1):

Hard-delete тары. `ProtectedError` (тара в `PrintBatchItem`, на
ней есть пробы) → 409.

**Ошибки:**
- 404 — тара не найдена;
- 409 — `{"error": "Нельзя удалить тару: на неё ссылаются связанные объекты (N)."}`.

**Draft-фильтры** (2f-1):
- `?draft_work_order_coded=TST0001` — частичный поиск по
  draft-номеру (`icontains`);
- `?draft_research_type_id=3` — точное совпадение по ID.

### `POST /storage/containers/bulk-create/`

Создать партию тары-заготовок **без проб**. Пробы добавляются
отдельным запросом — `fill-samples` (см. ниже).

Draft-поля (участок, ТИ, Н/З) — общие для всей партии, сохраняются
на каждой таре. Обнуляются после успешного заполнения.

**Тело запроса:**

    {
      "containers": [
        {
          "container_number": "T-BULK-001",
          "container_type_id": 1
        },
        {
          "container_type_id": 1
        }
      ],
      "draft_site_id": 1,
      "draft_research_type_id": 1,
      "draft_work_order_coded": "TST0001",
      "draft_work_order_incoming": "02-Тест001"
    }

**Логика (обновлено в 2f-5c-1):**
- Каждая тара создаётся со статусом **`PENDING_FILLING`**.
- `container_number` **опционален**: если не указан — тара без
  номера (заготовка). Номер присваивается на шаге `fill-samples`.
- Draft-поля сохраняются на каждой таре.
- `status` в теле запроса **не принимается**.

**Ответ (201 Created):**

    {
      "created_containers": [ {...ContainerSerializer...} ],
      "total_containers": 2
    }

**Ошибки:**
- 400 — номер тары уже существует;
- 400 — `container_type_id` не найден;
- 400 — `draft_site_id` / `draft_research_type_id` не найдены;
- 400 — номера тар в запросе не уникальны;
- 400 — список `containers` пуст.

### `POST /storage/containers/{id}/fill-samples/`

Заполнить существующую тару пробами.

**Тело запроса:**

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
          "well_name": null
        },
        {
          "prefix": "TST",
          "middle": "124",
          "sequence_from": 1,
          "sequence_to": 3,
          "well_name": "124"
        }
      ]
    }

**Логика:**
- Найти или создать `WorkOrder` (CODED) по `work_order_coded`.
- Если задан `work_order_incoming` — найти/создать INCOMING
  и связать `linked_order` в обе стороны.
- **Одна тара = один тип исследования.** Пробы другого ТИ — 400.
- Повторное заполнение тем же ТИ — разрешено.
- **`container_number`** — опционален. Если задан и у тары номер
  пуст — присваивается. Если уже есть — не перезаписывается.
- **Draft-поля обнуляются** после успешного заполнения.
- **Статус тары (2f-5c-1):** `PENDING_FILLING` → `PENDING_PLACEMENT`.
- Статус проб синхронизируется со статусом тары.

**Ответ (201 Created):**

    {
      "container_id": 10,
      "container_number": "T-FILL-001",
      "created_samples": [
        {"id": 1, "sample_number": "TAA-A34076001", "status": "PENDING_PLACEMENT"},
        {"id": 2, "sample_number": "TAA-A34076002", "status": "PENDING_PLACEMENT"}
      ],
      "total_samples": 2
    }

**Ошибки:**
- 404 — тара не найдена;
- 400 — `research_type_id` / `site_id` не найдены;
- 400 — `sequence_from > sequence_to`;
- 400 — диапазон > 1000 проб в одной группе;
- 400 — в таре уже есть пробы другого типа исследования;
- 400 — присваиваемый `container_number` уже занят.

---

## Партии печати (`PrintBatch`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/labels/print-batches` | Список партий |
| `GET` | `/labels/print-batches/{id}` | Одна партия с items |
| `POST` | `/labels/print-batches` | Создать черновик |
| `PATCH` | `/labels/print-batches/{id}` | Изменить (только DRAFT) |
| `POST` | `/labels/print-batches/{id}/add-containers/` | Добавить тары |
| `POST` | `/labels/print-batches/{id}/remove-container/` | Убрать тару |
| `POST` | `/labels/print-batches/{id}/mark-ready/` | DRAFT → READY |
| `POST` | `/labels/print-batches/{id}/cancel/` | Отмена (soft) |
| `GET` | `/labels/print-batches/{id}/pdf/` | PDF (READY → PRINTED авто) |
| `POST` | `/labels/print-batches/{id}/mark-printed/` | Ручная пометка PRINTED |

**Ограничения:**
- `PUT`, `DELETE` — запрещены (405).
- Изменять/наполнять можно только `DRAFT`.
- Отменить можно `DRAFT` и `READY`, нельзя `PRINTED` и `CANCELLED`.

**Фильтры:** `?status=`, `?print_type=`.

---

## Сканирование и перемещения

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/scan` | Обработать сканирование |
| `POST` | `/move` | Переместить тару/поддон |

**Пример `POST /scan`:**

    {
      "qr_code": "WMSG:CONTAINER:10",
      "context": "receiving"
    }

**Ответ:**

    {
      "entity_type": "Container",
      "entity_id": 10,
      "container_number": "T-001",
      "location": {"cell": "A-01-03-05", "pallet": "P-001"},
      "samples": [
        {"sample_id": 1, "sample_number": "12345", "research_type": "Шлифы"}
      ],
      "suggested_action": "confirm_placement"
    }

---

## Инвентаризация

| Метод | Путь | Что делает |
|---|---|---|
| `POST` | `/inventory/sessions` | Старт сессии |
| `GET` | `/inventory/sessions/{id}` | Статус |
| `POST` | `/inventory/sessions/{id}/scan` | Скан в сессии |
| `POST` | `/inventory/sessions/{id}/complete` | Завершить |
| `GET` | `/inventory/sessions/{id}/report` | Отчёт по расхождениям |

---

## Отчёты

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/reports/movements?from=&to=` | Движение |
| `GET` | `/reports/storage-load` | Загрузка склада |
| `GET` | `/reports/lifecycle/{sample_id}` | Жизненный цикл |
| `GET` | `/reports/export?type=csv` | Экспорт |

---

## Приёмка рейсов (`Receiving`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/receipts` | Список партий |
| `GET` | `/receipts/{id}` | Одна партия |
| `POST` | `/receipts/{id}/confirm` | Подтвердить приёмку (ручной override) |
| `POST` | `/receipts/{id}/cancel` | Отменить |
| `GET` | `/receipts/{id}/conflicts/` | Неразобранные `NEEDS_CONFIRMATION` |
| `POST` | `/receipts/{id}/resolve-conflicts/` | Разобрать конфликты |
| `POST` | `/receipts/{id}/check/` | Сверка тары (batch) |
| `POST` | `/receipts/{id}/complete/` | Завершить приёмку |
| `GET` | `/receipts/{id}/act/` | PDF «Акт приёмки» (только `CONFIRMED`) |
| `GET` | `/receipt-items` | Строки партии |
| `DELETE` | `/receipt-items/{id}` | Удалить строку (каскад, 2f-5a-1) |
| `GET` | `/import-sessions` | Сессии импорта |
| `POST` | `/import-sessions/upload/` | Excel → Receipt + ReceiptItem |
| `POST` | `/import-sessions/import-shipment/` | Excel → Shipment + Receipt + Container |

**Фильтры `GET /receipts`:** `status`, `laboratory_id`, `site_id`,
`shipment_id`.
**Фильтры `GET /receipt-items`:** `receipt_id`, `status`,
`container_id`.

### `GET /receipts/{id}/conflicts/`

Неразобранные конфликты партии (`code=NEEDS_CONFIRMATION`,
`resolved != true`). Каждый элемент содержит поля вопроса +
`question_index` + `suggested_count`.

**Ответ 200:**

    {
      "receipt_id": 8,
      "conflicts": [
        {
          "question_index": 3,
          "code": "NEEDS_CONFIRMATION",
          "title": "Требует уточнения",
          "reason": "multi_date_match",
          "sheet": "Тестовый",
          "work_order": "TST0001",
          "research_type": "ШЛ",
          "container_type": "Коробка",
          "containers_count": 4,
          "raw_dates": ["2026-10-13", "2026-10-14"],
          "target_date": "2026-10-14",
          "message": "В ячейке несколько дат, включая 14.10.2026.",
          "suggested_count": 2
        }
      ],
      "total_conflicts_count": 3,
      "resolved_conflicts_count": 2
    }

### `POST /receipts/{id}/resolve-conflicts/`

Разобрать конфликты партии. Создаёт N `ReceiptItem` (без
`Container`), помечает вопрос `resolved`.

**Тело запроса:**

    {
      "conflicts": [
        {"question_index": 3, "containers_count": 2}
      ]
    }

**Ответ 200:**

    {
      "receipt_id": 8,
      "created_items_count": 2,
      "resolved_conflicts_count": 3,
      "total_conflicts_count": 3,
      "errors": []
    }

**Ошибки 400:** невалидный индекс, вопрос уже разобран,
`containers_count > declared_count`, дубликат `question_index`.

### `POST /receipts/{id}/check/`

Сверка тары по партии (batch).

**Тело запроса:**

    {
      "items": [
        {"item_id": 101, "matched": true, "container_number": "1"},
        {"item_id": 102, "matched": false}
      ]
    }

**Логика (обновлено в 2f-5c-1):**
- `matched=true` → создать/обновить `Container`
  со статусом **`PENDING_FILLING`** («Ожидает заполнения» —
  тара есть, проб нет), присвоить номер,
  `ReceiptItem.status=MATCHED`.
- `matched=false` → удалить `Container` (если нет проб),
  `ReceiptItem.status=MISSING`.
- `Receipt.status=IN_PROGRESS`, если была `EXPECTED`.

**Ответ 200:**

    {
      "receipt_id": 8,
      "total_items_count": 10,
      "matched_count": 8,
      "missing_count": 2,
      "errors": []
    }

**Ошибки 400:**
- строка не принадлежит партии;
- `container_type` не заполнен у `matched`-строки;
- номер тары дублируется в запросе.

### `POST /receipts/{id}/complete/`

Завершить приёмку партии.

**Проверки:**
- нет неразобранных `NEEDS_CONFIRMATION`;
- нет `ReceiptItem.status=EXPECTED`.

**Действия:**
- `Receipt.status=CONFIRMED`, `received_at=now`,
  `received_by=request.user`;
- `Shipment.status=RECEIVED` (все `MATCHED`) или
  `PARTIALLY_RECEIVED` (есть `MISSING`).

**Ответ 200:**

    {
      "receipt_id": 8,
      "status": "CONFIRMED",
      "total_items_count": 10,
      "matched_count": 8,
      "missing_count": 2,
      "other_count": 0,
      "shipment_id": 5,
      "shipment_status": "PARTIALLY_RECEIVED",
      "errors": []
    }

**Ошибки 400:** остались конфликты; остались `EXPECTED`;
партия пуста; партия уже `CONFIRMED` / `CANCELLED`.

### `GET /receipts/{id}/act/`

PDF «Акт приёмки» (решение 1.50). Доступен только для
`Receipt.status=CONFIRMED`.

**Ответ 200:** `application/pdf`, `Content-Disposition: inline;
filename="act_<receipt_number>.pdf"`.

Содержимое PDF:
- шапка: «АКТ ПРИЁМКИ № <receipt_number>»;
- метаданные: дата рейса, рейс, лаборатория, участок;
- сводка: всего / принято / не пришло / прочее;
- таблица «Не приехало»;
- подписи.

**Ошибки 400:** статус не `CONFIRMED`.

### `DELETE /receipt-items/{id}/` (2f-5a-1)

Каскадное удаление строки приёмки. Одна транзакция:
1. Если у строки есть `Container`:
   - удалить все её пробы (по одной, чтобы поймать
     `ProtectedError` на конкретной пробе);
   - удалить `Container`.
2. Удалить саму строку.

**Ответ 204:** пустое тело.

**Ошибки:**
- 404 — строки нет;
- 409 — `{"error": "Нельзя удалить тару: проба «...» уже используется (…)."}`
  или
  `{"error": "Нельзя удалить тару: на неё ссылаются связанные объекты (N)."}`.

### `POST /import-sessions/upload/`

Старый импорт: создаёт `Receipt` + `ReceiptItem`, **без** `Shipment`
и `Container`.

**Form-data:**
- `file` — обязателен (`.xlsx` / `.xlsm`);
- `target_date` — обязателен (ISO `2026-10-12` или рус. `12.10.2026`);
- `duplicate_action` — `cancel` (default) / `overwrite` / `create`.

**Ответ 200:** `{import_session_id, status, file_format, sheets_count,
rows_count, containers_count, parse_errors, receipts}`.
**Ответ 409:** `DUPLICATE_DATE` — партия за эту дату уже есть.

### `POST /import-sessions/import-shipment/`

Новый импорт: создаёт **рейс целиком**.
- `Shipment` (direction=INBOUND, status=SENT, site=NULL);
- один `Receipt` на рейс (`site=NULL`, `shipment=shipment`);
- по одному `ReceiptItem` на каждую тару (`expected_samples_count=1`);
- по одному `Container` (`status=IN_TRANSIT`,
  `container_number=NULL`, draft-поля).

**Form-data:**
- `file` — обязателен (`.xlsx` / `.xlsm`);
- `target_date` — обязателен (ISO или рус.);
- `shipment_number` — опционален; если нет — генерируется
  `Р-{year}-NNN`;
- `laboratory_id` — опционален (откуда).

**Спорные ячейки** — пишутся в `parse_errors` с
`code=NEEDS_CONFIRMATION` и `reason`:
- `no_dates` — в ячейке нет ни одной даты;
- `multi_date_match` — несколько дат, `target_date` входит;
- `target_date_not_matched` — даты есть, `target_date` не входит.

Такие ячейки **пропускаются**, `status=PARSED` (не `APPLIED`).

**Ответ 200:**

    {
      "import_session_id": 12,
      "status": "APPLIED",
      "shipment_id": 5,
      "shipment_number": "Р-2026-001",
      "receipt_id": 8,
      "receipt_number": "ПР-5",
      "containers_count": 5,
      "questions_count": 0,
      "parse_errors": []
    }

**Ошибки:**
- 400 — нет файла / плохая дата / неподдерживаемый формат;
- 200 + `status=ERROR`, `shipment_id=null` — нечего создавать.

**Формат Excel:**
- Файл может содержать 1–2 строки «шапки» до заголовков
  (`MAX_HEADER_SEARCH=20`).
- Строка заголовков: `№ Наряд-заказа` / `Н/З` / `Наряд` + блоки
  типов + `Дата`.
- **Сразу после заголовков** — строка **типа тары** (`Ящики`,
  `Биг-бэг`). Обязательна для каждой колонки типа.
- Каждый блок «типы + Дата» — своя дата. В ячейке «Дата» —
  список через запятую (`13.08,02.09,25.05`).
- Количество тары: число или `1+1` (сумма).
- Дата без года (`13.08`) — текущий год.

---

## Пользователи и роли

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/users` | Список (admin) |
| `POST` | `/users` | Создать (admin) |
| `PATCH` | `/users/{id}` | Обновить (admin) |
| `GET` | `/roles` | Роли |

---

## Формат ошибок

Единый формат для всех 4xx/5xx:

    {
      "error": {
        "code": "VALIDATION_ERROR",
        "message": "Номер пробы обязателен",
        "details": {"sample_number": "required"}
      }
    }

Коды: `VALIDATION_ERROR`, `NOT_FOUND`, `PERMISSION_DENIED`,
`CONFLICT`, `INTERNAL_ERROR`.

**Исключение** — custom actions, возвращающие простую форму:

    {"error": "<строка>"}

Так делают: `check`, `complete`, `act`, `dispose`, `restore`,
`destroy` (409), `delete receipt-item` (409), `qr-batch` (400/404).

---

## Открытые вопросы

- Версионирование API в URL или заголовке? → сейчас в URL.
- Лимит `per_page`? → предложить 200.
- Глобальный `/search` — пока не реализован. Используются фильтры
  `GET /samples?q=` и `?work_order=`.
- `POST /receiving/items/{id}/fill/` — заполнение заготовки приёмки
  (для Excel-сценария) — в разработке.