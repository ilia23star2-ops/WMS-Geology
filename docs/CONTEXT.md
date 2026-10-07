# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-07

---

## Где мы

**Активная серия:** `feature/1.0a-topology-v2` (закрыта, ждёт merge в `main`)
**Следующая серия:** `feature/1.1-backend-api` (планируется)

**Текущий заход:** закрытие серии 1.0a, обновление документации.

**Что делаем:**
Серия 1.0a завершена. Топология v2 (4 яруса A–D, 1 поддон в ячейке,
ContainerType, Pallet OneToOne), soft-delete утилизации,
InventoryIssue, picking, movements — всё реализовано и покрыто тестами.
Готовы к API.

**Ближайшая работа:**
Серия 1.1 — реализация API-эндпоинтов из `docs/API.md`.

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- **PostgreSQL:**
  - рабочий ПК — портативный в `D:\Dev\pgsql\`;
  - домашний ПК — Docker-контейнер `wms-geology-postgres`.
- 8 приложений: `storage`, `samples`, `work_orders`, `inventory`,
  `labels`, `users`, `picking`, `movements`.
- Все миграции применены в БД `wms_geology`.

### Модели (15 моделей, 128 тестов)

| Приложение | Модели | Тестов |
|---|---|---|
| `storage` | Room, Rack, Section, Tier, Cell, Pallet, ContainerType, Container | 26 |
| `users` | Role, UserProfile, AuditLog | 14 |
| `work_orders` | WorkOrder (self-ref INCOMING↔CODED) | 12 |
| `samples` | Well, Sample (soft-delete), SampleWorkOrder | 18 |
| `inventory` | InventorySession, InventoryScan, InventoryIssue | 21 |
| `picking` | PickList, PickListItem, Shipment, ShipmentItem | 18 |
| `movements` | MoveOperation, MoveOperationItem | 14 |
| `users` (seeds) | management-команда `seed_roles` | 5 |

**Всего:** 128 тестов, все зелёные.

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE`, `API`, `SCENARIOS`,
  `TESTING`, `PLAN`, `PROGRESS`, `ISSUES` — актуальны.

---

## Известные грабли

### PostgreSQL
- **Рабочий ПК:** портативный, `D:\Dev\pgsql\`, запуск через `pg_ctl`.
- **Домашний ПК:** Docker, `docker compose up -d`.
- Оба — порт 5432. Не запускать оба одновременно на одной машине.
- `wms_user` имеет право `CREATEDB` (для тестов Django).

### Django
- Все команды — **только через** `poetry run python manage.py ...`.
- `CheckConstraint` — использовать `condition=`, не `check=`.
- CHECK с NULL в Postgres: `NULL = NULL` не TRUE → учитывать.
- `ProtectedError` при удалении `Container` с пробами / `ContainerType`
  с контейнерами / `Sample` из `PickListItem` и `ShipmentItem`.
- `on_delete=SET_NULL` для audit, dispose, move items.

### Домен
- Проба **не уникальна** по номеру.
- Одна тара = один тип исследования.
- `Pallet` — «тихий» объект (OneToOne с Cell, без QR).
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- `SampleWorkOrders` — M:N проба ↔ Н/З.
- Керн — поля есть, логика позже.

### Инструменты
- Git — только терминал.
- **Рабочий ПК:** Git Bash (MINGW64), SSH через `ssh.github.com:443`.
- **Домашний ПК:** UCRT64 (MSYS2), SSH напрямую `github.com:22`.
- VS Code может дописывать `.vscode/settings.json` — откатывать.

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