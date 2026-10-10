# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-10

---

## Где мы

**Активная серия:** нет. `feature/2.x-web` закрыта и влита в `main`.

**Следующая серия:** обсуждается. Кандидаты:
- `feature/2.x-mobile` — Flutter: приёмка, сканер, инвентаризация.
- `feature/2.x-lab-portal` — портал лабораторий (Уровень 2).
- `feature/2.x-lifecycle` — пересмотр статусов и жизненного цикла
  тары и проб (требует обсуждения с заказчиком).
- `feature/2.x-sorting` — помощник сортировки.

**Текущий заход:** docs-пачка после закрытия серии 2.x-web.

**Что готово:**
Backend — 552 теста. Web-приложение (React) — 9 заходов, все
разделы работают: логин, layout, главная, тара, пробы, печать,
справочники.

**Ближайшая работа:**
Обсуждение следующей серии. Web-интерфейс готов к использованию.

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- PostgreSQL: Docker (домашний ПК) / портативный (рабочий).
- JWT, OpenAPI, 10 приложений.
- Node 20+, Vite 8, React 19, MUI 9.

### Backend (552 теста)

| Приложение | Что внутри |
|---|---|
| `storage` | Топология A–D, Pallet, ContainerType, Container, ContainerComment, QR-этикетка (PDF) |
| `samples` | ResearchType, Site, Laboratory, Well, Sample, SampleWorkOrder |
| `work_orders` | WorkOrder (self-ref + site) |
| `receiving` | Receipt, ReceiptItem, ImportSession + Excel-парсер + сервис импорта |
| `picking` | PickList, PickListItem, Shipment (+ direction, статусы), ShipmentItem |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue |
| `users` | Role, UserProfile, AuditLog + JWT auth |
| `labels` | QR-сервис, PDF-этикетки, QR-сетка, `PrintBatch` + `PrintBatchItem`, API корзины и печати |

### Web (React)

| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login-форма, protected routes, JWT-интерцептор с авто-refresh |
| Layout | MUI sidebar + header, адаптив (drawer на мобильном) |
| Главная | 4 карточки со счётчиками (Тара / Пробы / Ожидает размещения / Партии печати) |
| Тара | DataGrid, фильтры (статус, тип), PDF-этикетка, выбор в партию печати |
| Пробы | DataGrid, фильтры (номер, тип, участок, статус), «Показать утилизированные» |
| Печать | Список партий, детали, add/remove тар, PDF (этикетки / QR-сетка) |
| Справочники | Типы исследования, участки, лаборатории (только просмотр) |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS` (57 решений), `DATABASE` (v5),
  `API`, `SCENARIOS`, `UI` (v2), `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

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
  `add-containers`, `remove-container`, `mark-ready`, `pdf`,
  `mark-printed`.
- **URL-схема:** `/api/v1/storage/...`, `/api/v1/labels/...`,
  остальные приложения — **без префикса** (`/api/v1/samples/...`,
  `/api/v1/research-types/...`, `/api/v1/work-orders/...`).

### Домен
- Проба в системе = **навеска**. Не уникальна по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект (OneToOne с Cell, без QR).
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- `Shipment.direction` — `INBOUND` / `OUTBOUND`.
- `ContainerType.laboratory` — NULL = общий.
- `PrintBatch.status` — soft через `CANCELLED`.
- `PrintBatchItem.container` — `PROTECT`.

### Генератор этикеток
- QR 25×25 мм в правом верхнем углу шапки.
- Ширина этикетки — из сетки `[110, 130, 150, 180, 210]` мм.
- Высота — из сетки `[37, 49, 74, 99, 148]` мм (делители A4).
- Авто-ширина колонок списка, шрифт 10 pt везде.
- Продолжения: вторая этикетка без шапки, только список.
- Лист A4: 1 в ряд, от левого верхнего угла, не разрывается.
- **QR-сетка:** 8 × 11 = 88 QR 25×25 на A4, общие линии реза.
- В QR — внутренний ID тары (`WMSG:CONTAINER:94`), не номер.
- **Печать партии: гибрид.** `GET /pdf/` при `READY` автоматически
  ставит `PRINTED`, `printed_at`, `printed_by`. Повторное скачивание
  не переписывает первую печать. Ручной override —
  `POST /mark-printed/`.
- Шрифт `DejaVuSans.ttf` — в `static/fonts/`, не в git.

### Web
- **Vite proxy:** `/api/*` → `http://localhost:8000`. Backend должен
  быть запущен отдельно.
- **MUI X v9:** `GridRowSelectionModel = { type, ids: Set<GridRowId> }`,
  не массив. Импорт `GridRowId`.
- **MUI X v9:** `DataGrid` с `paginationMode="server"` требует
  `rowCount` и `paginationModel`.
- **MUI 9:** `Grid size={{ xs, sm, md }}` — новый синтаксис (не
  `Grid item xs`).
- **MUI 9:** `Stack alignItems` через `sx`, не проп (TS ругается).
- **React Router v7:** API совместим с v6.
- **Zustand:** при F5 состояние сбрасывается — race condition
  закрыт флагом `isBootstrapping` (см. `authStore.ts`).
- **Vite build:** warning «chunks > 500 kB» — ожидаемо (MUI +
  DataGrid). Code-splitting отложен (ТД-21).
- **URL справочников:** `/research-types/`, `/sites/`,
  `/laboratories/` — **без префикса** `/samples/`.

### Инструменты
- Git — только терминал.
- **Домашний ПК:** UCRT64 (MSYS2), SSH `github.com:22`.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через порт 443.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- Кириллица в пути ломает Dart-анализатор.
- **UCRT64 (MSYS2)** ломает `manage.py shell -c "..."` — использовать
  временный скрипт или одной строкой.
- **`cat > file << 'EOF'`** — надёжный способ заменить файл в
  MSYS2-терминале (Ctrl+V в REPL ломается).

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
- Все web-команды — `cd web && npm ...`.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.