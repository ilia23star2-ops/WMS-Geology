# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-09

---

## Где мы

**Активная серия:** `feature/1.3-backend-v2` (закрыта, ждёт merge в `main`)
**Следующая серия:** `feature/2.0-*` (обсуждается)

**Текущий заход:** закрытие серии 1.3, обновление документации.

**Что делаем:**
Серия 1.3 завершена. Все справочники, FK-миграции, модели приёмки
и рейсов реализованы. 400 тестов. Backend готов к серии 2.0.

**Ближайшая работа:**
Merge `feature/1.3-backend-v2` в `main`. Потом — обсуждение серии 2.0
(приёмка, портал лабораторий, mobile-разработка).

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- PostgreSQL: Docker (домашний ПК) / портативный (рабочий).
- JWT, OpenAPI, 10 приложений.

### Backend (400 тестов)

| Приложение | Что внутри |
|---|---|
| `storage` | Топология A–D, Pallet, ContainerType (+ laboratory), Container (+ comment, PENDING_PLACEMENT), ContainerComment |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (FK на тип и участок), SampleWorkOrder |
| `work_orders` | WorkOrder (self-ref + site) |
| `receiving` | Receipt, ReceiptItem, ImportSession |
| `picking` | PickList, PickListItem, Shipment (+ direction, статусы), ShipmentItem |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue |
| `users` | Role, UserProfile, AuditLog + JWT auth |
| `labels` | (задел на серию 2.x) |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE` (v4), `API`, `SCENARIOS` (v4),
  `UI` (v2), `TESTING`, `PLAN`, `PROGRESS`, `ISSUES` — актуальны.

---

## Известные грабли

### PostgreSQL
- **Домашний ПК:** Docker (`docker compose up -d`).
- **Рабочий ПК:** портативный `pg_ctl`, запуск вручную.
- **После `git pull` с миграциями — всегда `migrate`.**
- `wms_user` имеет право `CREATEDB`.

### Django
- Все команды — только через `poetry run python manage.py ...`.
- `CheckConstraint(condition=...)`, не `check=`.
- CHECK с NULL: `NULL = NULL` не TRUE.
- `ProtectedError` при удалении Container с пробами, ContainerType
  с контейнерами, Sample из PickListItem и ShipmentItem.
- **`poetry lock`** после изменения `pyproject.toml`.
- **Циклические импорты** — использовать строковые ссылки
  (`"samples.Site"`, `"samples.Laboratory"`).
- **Сортировка кириллицы в БД** — не полагаться на порядок `code`;
  использовать `sort_order`.
- **`poetry env remove --all && poetry install`** после переезда проекта.

### API
- Аутентификация — JWT (`Authorization: Bearer <access>`).
- Pagination — `PageNumberPagination`, `PAGE_SIZE=50`.
- **Ключевой фильтр** `?work_order=` — учитывает linked_order (1.7).
- Custom actions: `link`, `complete`, `resolve`, `activate`, `pick`,
  `add-from-pick-list`, `execute`, `confirm`, `cancel`, `assemble`.

### Домен
- Проба в системе = **навеска**. Не уникальна по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект (OneToOne с Cell, без QR).
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- `Shipment.direction` — `INBOUND` / `OUTBOUND`.
- `ContainerType.laboratory` — NULL = общий, иначе только этой лаборатории.
- Керн — поля есть, логика позже.

### Инструменты
- Git — только терминал.
- **Домашний ПК:** UCRT64 (MSYS2), SSH `github.com:22`.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через порт 443.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- Кириллица в пути ломает Dart-анализатор.

---

## Не трогать

- `RULES.md` — универсальные правила.
- `TEMPLATES.md` — базовые шаблоны.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).

---

## Правила текущей сессии

- Кодовая фаза.
- Каждый заход — 1–3 файла (пачки-исключения для boilerplate).
- Файлы выдаются единым блоком.
- Все Django-команды — через `poetry run`.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.