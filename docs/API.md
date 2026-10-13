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
| `DELETE` | `/samples/{id}` | Удалить (только admin) |
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
- тара на полу в комнате → `На полу: <комната>`;
- тара без места → `Место не указано`.

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

---

## Тара и поддоны

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/storage/containers` | Список |
| `GET` | `/storage/containers/{id}` | Одна тара + пробы внутри |
| `POST` | `/storage/containers` | Создать одну |
| `PATCH` | `/storage/containers/{id}` | Переместить / обновить |
| `GET` | `/storage/containers/{id}/label.pdf/` | PDF-этикетка тары |
| `POST` | `/storage/containers/bulk-create/` | Создать N тар-заготовок (без проб) |
| `POST` | `/storage/containers/{id}/fill-samples/` | Заполнить тару пробами |
| `GET` | `/storage/pallets` | Список поддонов |
| `POST` | `/storage/pallets` | Создать поддон |

**Фильтры контейнеров:** `pallet_id`, `floor_room_id`,
`container_type_id`, `status`, `comment_template_id`.

### `POST /storage/containers/bulk-create/`

Создать партию тары-заготовок **без проб**. Пробы добавляются
отдельным запросом — `fill-samples` (см. ниже).

Draft-поля (участок, ТИ, Н/З) — общие для всей партии, сохраняются
на каждой таре. Используются для предзаполнения формы fill-samples,
обнуляются после успешного заполнения.

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

**Логика:**
- Каждая тара создаётся со статусом `PENDING_PLACEMENT`.
- `container_number` **опционален**: если не указан (или пустая
  строка) — тара создаётся без номера (заготовка). Номер
  присваивается на шаге `fill-samples`.
- Draft-поля сохраняются на каждой таре.
- `status` в теле запроса **не принимается**.

**Ответ (201 Created):**

    {
      "created_containers": [ {...ContainerSerializer...} ],
      "total_containers": 2
    }

`ContainerSerializer` дополнительно возвращает:
`draft_site`, `draft_site_name`, `draft_research_type`,
`draft_research_type_name`, `draft_work_order_coded`,
`draft_work_order_incoming`.

**Ошибки:**
- 400 — номер тары уже существует в системе;
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
- **Одна тара = один тип исследования.** При попытке добавить
  пробы другого ТИ в тару, где уже есть пробы — 400.
- Повторное заполнение **тем же** ТИ — разрешено.
- Для каждой группы проб: если задан `well_name` — найти/создать
  `Well`; сгенерировать полные номера и создать `Sample`.
- **`container_number`** — опционален. Если задан и у тары номер
  ещё не присвоен — присваивается (с проверкой уникальности).
  Если у тары уже есть номер — не перезаписывается.
- **Draft-поля тары обнуляются** после успешного заполнения.
- Статус проб синхронизируется со статусом тары
  (`ACTIVE → IN_STORAGE`, `PENDING_PLACEMENT → PENDING_PLACEMENT`,
  `IN_TRANSIT → IN_TRANSIT`, `ISSUED → ISSUED`).

**Формат полного номера:**
- шифрованная: `TAA-A` + `34076` + `001` = `TAA-A34076001`;
- нешифрованная: `TST` + `124` + `001` = `TST124001`.

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
- 400 — присваиваемый `container_number` уже занят другой тарой.

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

---

## Открытые вопросы

- Версионирование API в URL или заголовке? → сейчас в URL.
- Лимит `per_page`? → предложить 200.
- Глобальный `/search` — пока не реализован. Используются фильтры
  `GET /samples?q=` и `?work_order=`.
- `POST /receiving/items/{id}/fill/` — заполнение заготовки приёмки
  (для Excel-сценария) — в разработке.