# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-07

---

## Где мы

**Активная серия:** `feature/1.1-backend-api` (закрыта, ждёт merge в `main`)
**Следующая серия:** `feature/1.2-mobile-init` (планируется)

**Текущий заход:** закрытие серии 1.1, обновление документации.

**Что делаем:**
Серия 1.1 завершена. REST API реализован полностью: 8 приложений,
~60 эндпоинтов, JWT-аутентификация, OpenAPI-схема, 268 тестов.
Бэкенд готов к подключению мобильного и веб-клиентов.

**Ближайшая работа:**
Серия 1.2 — Flutter-приложение: сканер QR, поиск, инвентаризация.

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- PostgreSQL: Docker (домашний ПК) / портативный (рабочий).
- JWT-аутентификация (`djangorestframework-simplejwt`).
- OpenAPI 3 (`drf-spectacular`), Swagger UI на `/api/docs/`.

### API (v1)
- **storage** — 8 ViewSets (Room, Rack, Section, Tier, Cell, Pallet, ContainerType, Container).
- **work_orders** — WorkOrder + custom action `link`.
- **samples** — Well, Sample, SampleWorkOrder + **фильтр `?work_order=`** с учётом linked_order.
- **inventory** — сессии, сканы, расхождения + custom `complete`, `resolve`.
- **picking** — PickList, PickListItem, Shipment + custom `activate`, `complete`, `pick`, `add-from-pick-list`.
- **movements** — MoveOperation + custom `execute`.
- **users** — JWT auth: `login`, `refresh`, `logout`, `me`.

### Модели (15 моделей, 268 тестов)

| Приложение | Модели | Тестов |
|---|---|---|
| storage | Room, Rack, Section, Tier, Cell, Pallet, ContainerType, Container | 26 + 19 + 17 |
| users | Role, UserProfile, AuditLog | 14 + 5 + 12 (auth) |
| work_orders | WorkOrder | 12 + 15 |
| samples | Well, Sample, SampleWorkOrder | 18 + 20 |
| inventory | InventorySession, InventoryScan, InventoryIssue | 21 + 16 |
| picking | PickList, PickListItem, Shipment, ShipmentItem | 18 + 18 |
| movements | MoveOperation, MoveOperationItem | 14 + 15 |
| openapi | — | 7 |

**Всего:** 268 тестов, все зелёные.

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE`, `API`, `SCENARIOS`,
  `TESTING`, `PLAN`, `PROGRESS`, `ISSUES` — актуальны.
- OpenAPI-схема автогенерируется.

---

## Известные грабли

### PostgreSQL
- **Домашний ПК:** Docker (`docker compose up -d`).
- **Рабочий ПК:** портативный `pg_ctl`.
- Порт 5432 на обеих машинах.
- `wms_user` имеет право `CREATEDB` (для тестов Django).

### Django
- Все команды — только через `poetry run python manage.py ...`.
- `CheckConstraint(condition=...)`, не `check=`.
- CHECK с NULL: `NULL = NULL` не TRUE.
- `ProtectedError` при удалении Container с пробами, ContainerType
  с контейнерами, Sample из PickListItem и ShipmentItem.
- **`poetry lock`** после изменения `pyproject.toml`.

### API
- Аутентификация — JWT (`Authorization: Bearer <access>`).
- Pagination — `PageNumberPagination`, `PAGE_SIZE=50`.
- Формат ошибок DRF — стандартный (`{"field": ["..."]}` и
  `{"non_field_errors": ["..."]}` для XOR-валидаций).
- **Ключевой фильтр** `?work_order=` — учитывает linked_order
  (см. DECISIONS 1.7).

### Домен
- Проба не уникальна по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект (OneToOne с Cell, без QR).
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- Керн — поля есть, логика позже.

### Инструменты
- Git — только терминал.
- **Домашний ПК:** UCRT64 (MSYS2), SSH `github.com:22`.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через порт 443.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- Кириллица в пути (`Програмирование`) — оборачивать в кавычки.

---

## Не трогать

- `RULES.md` — универсальные правила.
- `TEMPLATES.md` — базовые шаблоны.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).

---

## Правила текущей сессии

- Кодовая фаза.
- Каждый заход — 1–3 файла кода + тесты (пачки-исключения).
- Файлы выдаются единым блоком.
- Все Django-команды — через `poetry run`.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.