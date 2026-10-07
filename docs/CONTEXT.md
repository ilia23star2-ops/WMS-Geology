# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-07

---

## Где мы

**Активная серия:** `feature/1.0-backend-init` (закрыта, ждёт merge в `main`)
**Следующая серия:** `feature/1.1-backend-api` (планируется)

**Текущий заход:** закрытие серии 1.0, обновление документации.

**Что делаем:**
Серия 1.0 завершена. Django-проект инициализирован, все 6 приложений
созданы, модели написаны и покрыты тестами, миграции применены, seeds
ролей работают. Готовы к API.

**Ближайшая работа:**
Серия 1.1 — реализация API-эндпоинтов из `docs/API.md`.

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + PostgreSQL (портативный) + Django 5.2 + DRF.
- 6 приложений: `storage`, `samples`, `work_orders`, `inventory`, `labels`, `users`.
- Все миграции применены в БД `wms_geology`.

### Модели (всего 13 моделей)

| Приложение | Модели | Тестов |
|---|---|---|
| `storage` | Room, Rack, Section, Tier, Cell, Pallet, Container | 19 |
| `users` | Role, UserProfile, AuditLog | 14 |
| `work_orders` | WorkOrder (self-ref INCOMING↔CODED) | 12 |
| `samples` | Well, Sample, SampleWorkOrder | 15 |
| `inventory` | InventorySession, InventoryScan | 13 |
| `users` (seeds) | management-команда `seed_roles` | 5 |

**Всего тестов:** 78. Все зелёные.

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS`, `DATABASE`, `API`, `SCENARIOS`,
  `TESTING`, `PLAN`, `PROGRESS`, `ISSUES` — актуальны.

---

## Известные грабли

### PostgreSQL (портативный)
- Путь к бинарникам: `D:\Dev\pgsql\pgsql\bin\`.
- Путь к данным: `D:\Dev\pgsql\pgdata\`.
- Запуск: `pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l ... start`.
- Стоп: `pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop`.
- Пользователь `wms_user` имеет право `CREATEDB` (для тестов Django).
- Пароль суперпользователя `postgres` — `postgres`.
- `wms_user` / `wms_password`, БД `wms_geology`.

### Django
- **Все команды — только через** `poetry run python manage.py ...`.
- `manage.py check` и `pytest` запускаются из `backend/`.
- **`CheckConstraint(check=...)` устарел** в Django 5.2 → использовать `condition=...`.
- CHECK с NULL в Postgres: `NULL = NULL` не TRUE → учитывать в constraints.
- **`ProtectedError`** при удалении `Container` с пробами (PROTECT).
- **`on_delete=SET_NULL`** для `AuditLog.user`, `InventoryScan.sample`,
  `WorkOrder.linked_order` → запись остаётся.

### Домен
- Проба **не уникальна** по номеру. Уникальна по `sample_id`.
- `SampleParts` **не нужна** — проба и есть единица хранения.
- Одна тара = **один** тип исследования.
- `WorkOrders.linked_order_id` — self-ref INCOMING ↔ CODED.
- Проба связана с Н/З через `SampleWorkOrders` (M:N).
- `Pallet` может быть: в ячейке, на полу, или «в пути» (все NULL).

### Инструменты
- Git — только терминал. Терминал VS Code — **Git Bash**.
- VS Code может дописывать `.vscode/settings.json` — откатывать.
- SSH через `ssh.github.com:443`.

---

## Не трогать

- `RULES.md` — универсальные правила.
- `TEMPLATES.md` — базовые шаблоны.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).

---

## Правила текущей сессии

- Кодовая фаза.
- Каждый заход — 1–3 файла кода + тесты (пачки-исключения — boilerplate).
- Файлы выдаются единым блоком.
- Все Django-команды — через `poetry run`.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.