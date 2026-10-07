# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/1.0-backend-init`

**Дата:** 2026-10-07 — 2026-10-07
**Ветка:** влита в `main`, архив.
**Контекст:** Инициализация Django-проекта. Приложения, модели,
миграции, тесты, seeds ролей.

### Что закрыто

- ✅ **`bundle-1`** — Poetry init, `.python-version`, зависимости.
- ✅ **`bundle-2`** — Django skeleton: `manage.py`, settings, urls, wsgi, asgi.
- ✅ **`bundle-3`** — приложения `storage`, `samples`, `work_orders`.
- ✅ **`bundle-4`** — приложения `inventory`, `labels`, `users`.
- ✅ **`bundle-5`** — модели `storage` (7 моделей) + миграция + 19 тестов.
- ✅ **`bundle-6`** — модели `users` (Role, UserProfile, AuditLog) + 14 тестов.
- ✅ **`bundle-7`** — модель `work_orders` (WorkOrder) + 12 тестов.
- ✅ **`bundle-8`** — модели `samples` (Well, Sample, SampleWorkOrder) + 15 тестов.
- ✅ **`bundle-9`** — модели `inventory` (InventorySession, InventoryScan) + 13 тестов.
- ✅ **`bundle-10`** — seeds ролей (`seed_roles`) + 5 тестов.

### Промежуточные docs-заходы

- ✅ **`Docs: портативный PostgreSQL`** — фиксация решения 1.14, 1.15.

### Метрики

- Заходов: 11.
- «Не норм» на первом прогоне: 2 (bundle-5: CHECK Pallet; bundle-5: pytest args).
- Откатов: 0.
- Правил нарушено: 0.
- Идей отложено в `PLAN.md`: 4.
- **Итог: 78 тестов, все зелёные.**

---

## Серия `feature/0.2-prep-code`

**Дата:** 2026-10-07 — 2026-10-07
**Ветка:** docs → `main` (commit `0a72c9f`)
**Контекст:** Подготовка структуры под кодовую фазу.

### Что закрыто

- ✅ **`Структура папок`** — `backend/`, `mobile/`, `web/`, `label-generator/`.
- ✅ **`.env.example`** — переменные окружения backend.
- ✅ **`.github/workflows/ci.yml`** — условный CI.
- ✅ **`TEMPLATES-PROJECT.md`** — дополнения к шаблонам.

### Метрики

- Заходов: 3. Откатов: 0. Правил нарушено: 0.

---

## Серия `feature/0.1-foundation`

**Дата:** 2026-10-07 — 2026-10-07
**Ветка:** docs → `main` (commit `2e7ea42`)
**Контекст:** Фундамент репозитория. Проектные доки.

### Что закрыто

- ✅ **`Стартовые доки`** — README, LICENSE, .gitignore, PROJECT, CONTEXT, DECISIONS.
- ✅ **`DATABASE.md`** — схема БД.
- ✅ **`API.md`** — контракты MVP.
- ✅ **`SCENARIOS.md`** — приёмка, поиск, инвентаризация, перемещение, выдача.
- ✅ **`TESTING.md`** — расширенная версия.

### Метрики

- Заходов: 1. Откатов: 0.