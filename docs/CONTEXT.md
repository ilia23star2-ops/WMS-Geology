# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-10

---

## Где мы

**Активная серия:** `feature/2.1-label-generator`.
**Следующая серия:** `feature/2.x-web` или `feature/2.x-mobile` (обсуждается).

**Текущий заход:** раскладка этикеток v4d завершена (bundle-4d-1).
Что осталось в 2.1: QR-сетка (`4d-3`), API печати (`4d-4`).

**Что делаем:**
Генератор этикеток работает: QR 25 мм, сетка размеров (ширина ×
высота), авто-ширина колонок, упаковка на A4, пунктир реза,
продолжения на второй этикетке. 531 тест зелёный.

**Ближайшая работа:**
- `4d-3` — раскладка для режима `QR_ONLY` (сетка 25×25 мм).
- `4d-4` — API `GET /print-batches/{id}/pdf/` + `mark-printed`
  (гибрид: авто при скачивании + ручной override).
- Docs-пачка: актуализация `DECISIONS`, `DATABASE`, `API`, `ISSUES`.

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- PostgreSQL: Docker (домашний ПК) / портативный (рабочий).
- JWT, OpenAPI, 11 приложений.

### Backend (531 тест)

| Приложение | Что внутри |
|---|---|
| `storage` | Топология A–D, Pallet, ContainerType, Container, ContainerComment |
| `samples` | ResearchType, Site, Laboratory, Well, Sample, SampleWorkOrder |
| `work_orders` | WorkOrder (self-ref + site) |
| `receiving` | Receipt, ReceiptItem, ImportSession + Excel-парсер |
| `picking` | PickList, PickListItem, Shipment (+ direction, статусы), ShipmentItem |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue |
| `users` | Role, UserProfile, AuditLog + JWT auth |
| `labels` | QR-сервис, PDF-этикетки, `PrintBatch`, `PrintBatchItem` |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE` (v4 → v5), `API`,
  `SCENARIOS`, `UI`, `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

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
- **Циклические импорты** — использовать строковые ссылки.
- **Сортировка кириллицы в БД** — использовать `sort_order`.
- **`poetry env remove --all && poetry install`** после переезда проекта.

### API
- Аутентификация — JWT (`Authorization: Bearer <access>`).
- Pagination — `PageNumberPagination`, `PAGE_SIZE=50`.
- **Ключевой фильтр** `?work_order=` — учитывает linked_order.
- Custom actions: `link`, `complete`, `resolve`, `activate`, `pick`,
  `add-from-pick-list`, `execute`, `confirm`, `cancel`, `assemble`,
  `add-containers`, `remove-container`, `mark-ready`.

### Домен
- Проба в системе = **навеска**. Не уникальна по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект (OneToOne с Cell, без QR).
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- `Shipment.direction` — `INBOUND` / `OUTBOUND`.
- `ContainerType.laboratory` — NULL = общий.
- `PrintBatch.status` — soft через `CANCELLED`.

### Генератор этикеток
- QR 25×25 мм в правом верхнем углу шапки.
- Ширина этикетки — из сетки `[110, 130, 150, 180, 210]` мм.
- Высота — из сетки `[37, 49, 74, 99, 148]` мм (делители A4).
- Авто-ширина колонок списка, шрифт 10 pt везде.
- Продолжения: вторая этикетка без шапки, только список.
- Лист A4: 1 в ряд, от левого верхнего угла, не разрывается.
- Шрифт `DejaVuSans.ttf` — в `static/fonts/`, не в git.

### Инструменты
- Git — только терминал.
- **Домашний ПК:** UCRT64 (MSYS2), SSH `github.com:22`.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через порт 443.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- Кириллица в пути ломает Dart-анализатор.
- **UCRT64 (MSYS2)** ломает `manage.py shell -c "..."` — использовать
  временный скрипт.

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