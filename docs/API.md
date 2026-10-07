# API.md — контракты API

> Базовый URL: `/api/v1/`
> Формат: JSON, UTF-8.
> Аутентификация: JWT (фаза 1.0).
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
```json
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
Пример POST /samples:

json
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
Наряд-заказы (WorkOrders)
Метод	Путь	Что делает
GET	/work-orders	Список
GET	/work-orders/{id}	Один Н/З со связанными
POST	/work-orders	Создать
PATCH	/work-orders/{id}	Обновить
POST	/work-orders/{id}/link	Связать INCOMING ↔ CODED
Фильтры: order_number, order_type, status.

Топология склада
Метод	Путь	Что делает
GET	/rooms	Список комнат
GET	/racks?room_id=	Стеллажи комнаты
GET	/sections?rack_id=	Пролёты
GET	/tiers?section_id=	Ярусы
GET	/cells?tier_id=	Ячейки
GET	/cells/{id}	Одна ячейка
POST	/cells	Создать (admin)
Тара и поддоны
Метод	Путь	Что делает
GET	/containers	Список
GET	/containers/{id}	Одна тара + пробы внутри
POST	/containers	Создать
PATCH	/containers/{id}	Переместить / обновить
GET	/pallets	Список
POST	/pallets	Создать
Сканирование и перемещения
Метод	Путь	Что делает
POST	/scan	Обработать сканирование
POST	/move	Переместить тару/поддон
Пример POST /scan:

json
{
  "qr_code": "WMSG:CONTAINER:10",
  "context": "receiving"
}
Ответ:

json
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
Инвентаризация
Метод	Путь	Что делает
POST	/inventory/sessions	Старт сессии
GET	/inventory/sessions/{id}	Статус
POST	/inventory/sessions/{id}/scan	Скан в сессии
POST	/inventory/sessions/{id}/complete	Завершить
GET	/inventory/sessions/{id}/report	Отчёт по расхождениям
Поиск (общий)
Метод	Путь	Что делает
GET	/search?q=	Универсальный поиск
GET	/search?sample_number=&work_order=&research_type=&site=	Точный фильтр
Отчёты
Метод	Путь	Что делает
GET	/reports/movements?from=&to=	Движение
GET	/reports/storage-load	Загрузка склада
GET	/reports/lifecycle/{sample_id}	Жизненный цикл
GET	/reports/export?type=csv	Экспорт
Пользователи и роли
Метод	Путь	Что делает
GET	/users	Список (admin)
POST	/users	Создать (admin)
PATCH	/users/{id}	Обновить (admin)
GET	/roles	Роли
Формат ошибок
Единый формат для всех 4xx/5xx:

json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Номер пробы обязателен",
    "details": {"sample_number": "required"}
  }
}
Коды: VALIDATION_ERROR, NOT_FOUND, PERMISSION_DENIED,
CONFLICT, INTERNAL_ERROR.

Открытые вопросы
JWT или session-based auth? → решить в серии 0.3.

Версионирование API в URL или заголовке? → сейчас в URL.

Лимит per_page? → предложить 200.