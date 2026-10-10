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
| `POST` | `/auth/logout` | Logout |

---

## Пробы (`Samples`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/samples` | Список с фильтрами |
| `GET` | `/samples/{id}` | Одна проба |
| `POST` | `/samples` | Создать пробу (при приёмке) |
| `PATCH` | `/samples/{id}` | Обновить |
| `DELETE` | `/samples/{id}` | Удалить (только admin) |

**Фильтры `GET /samples`:**
- `sample_number` — номер пробы
- `research_type` — тип исследования
- `work_order` — номер Н/З (входящий **или** зашифрованный)
- `work_order_id` — ID Н/З
- `site` — участок
- `well_id` — скважина
- `container_id` — тара
- `status` — статус
- `page`, `per_page` — пагинация

**Пример `GET /samples?sample_number=12345`:**

    {
      "count": 3,
      "results": [
        {
          "sample_id": 1,
          "sample_number": "12345",
          "research_type": "Шлифы",
          "container": {"container_id": 10, "container_number": "T-001"},
          "current_location": "Комната 1 / Стеллаж A / Пролёт 1 / Ярус 2 / Ячейка 1",
          "current_work_order": {"work_order_id": 11, "order_number": "Х-456", "order_type": "CODED"}
        }
      ]
    }

**Пример `POST /samples`:**

    {
      "sample_number": "12345",
      "research_type": "Шлифы",
      "container_id": 10,
      "well_id": 5,
      "depth_from": 120.5,
      "depth_to": 121.0,
      "site": "Участок-1",
      "current_work_order_id": 11
    }

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
| `POST` | `/storage/containers` | Создать |
| `PATCH` | `/storage/containers/{id}` | Переместить / обновить |
| `GET` | `/storage/containers/{id}/label.pdf/` | PDF-этикетка тары |
| `GET` | `/storage/pallets` | Список |
| `POST` | `/storage/pallets` | Создать |

**Фильтры контейнеров:** `pallet_id`, `floor_room_id`,
`container_type_id`, `status`, `comment_template_id`.

---

## Партии печати (`PrintBatch`)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/labels/print-batches` | Список партий |
| `GET` | `/labels/print-batches/{id}` | Одна партия с items |
| `POST` | `/labels/print-batches` | Создать черновик |
| `PATCH` | `/labels/print-batches/{id}` | Изменить (только DRAFT) |
| `POST` | `/labels/print-batches/{id}/add-containers/` | Добавить тары в корзину |
| `POST` | `/labels/print-batches/{id}/remove-container/` | Убрать тару |
| `POST` | `/labels/print-batches/{id}/mark-ready/` | DRAFT → READY |
| `POST` | `/labels/print-batches/{id}/cancel/` | Отмена (soft) |

**Ограничения:**
- `PUT`, `DELETE` — запрещены (405).
- Изменять/наполнять можно только `DRAFT`.
- Отменить можно `DRAFT` и `READY`, нельзя `PRINTED` и `CANCELLED`.

**Фильтры:** `?status=`, `?print_type=`.

**Пример `POST /print-batches/{id}/add-containers/`:**

    {
      "container_ids": [10, 11, 12]
    }

Ответ — та же партия с обновлёнными `items` и `total_items`.

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

## Поиск (общий)

| Метод | Путь | Что делает |
|---|---|---|
| `GET` | `/search?q=` | Универсальный поиск |
| `GET` | `/search?sample_number=&work_order=&research_type=&site=` | Точный фильтр |

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
- PDF партии печати — эндпоинт `GET /print-batches/{id}/pdf/`
  (серия 2.1, bundle-4d-4).