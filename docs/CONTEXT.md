# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-10-07

---

## Где мы

**Активная серия:** `feature/1.0-backend-init` (в работе)

**Текущий заход:** подготовка к bundle-5 (модели storage)

**Что делаем:**
Django-проект инициализирован, все 6 приложений созданы,
PostgreSQL развёрнут, служебные миграции применены. Переходим
к написанию моделей.

**Ближайшая работа:**
`fix/1.0-bundle-5` — модели приложения `storage` (Room, Rack,
Section, Tier, Cell, Pallet, Container) + первая миграция.

---

## Что готово

### Инфраструктура

- Poetry + Python 3.14 + виртуальное окружение (`backend/.venv/`).
- Django 5.2 + DRF + psycopg.
- **Портативный PostgreSQL** в `D:\Dev\pgsql\` (порт 5432).
- База `wms_geology`, пользователь `wms_user`.
- `.env` в `backend/` (не коммитится).

### Код

- `manage.py`, `wms_geology/` (settings, urls, wsgi, asgi).
- 6 приложений в `apps/`: `storage`, `samples`, `work_orders`,
  `inventory`, `labels`, `users`.
- Служебные миграции Django применены (auth, admin, sessions).

### Документация

- Все проектные доки: `PROJECT`, `DECISIONS`, `DATABASE`, `API`,
  `SCENARIOS`, `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

---

## Известные грабли

### PostgreSQL (портативный)

- **Путь к бинарникам:** `D:\Dev\pgsql\pgsql\bin\`.
- **Путь к данным:** `D:\Dev\pgsql\pgdata\`.
- **Запуск:** `pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start`.
- **Стоп:** `pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop`.
- **Статус:** `pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status`.
- **Пароль `postgres`** при initdb передаётся через `--pwfile`,
  а не интерактивно (Git Bash не умеет TTY).
- **Кодировка кластера:** UTF8, но локаль — `Russian_Russia.1251`
  (может дать проблемы с сортировкой позже).
- **Подключение:** `PGPASSWORD=wms_password psql.exe -U wms_user -h localhost -d wms_geology`.

### Домен

- Проба **не уникальна** по номеру. Уникальна по `sample_id`.
- `SampleParts` **не нужна** — проба и есть единица хранения.
- Одна тара = **один** тип исследования.
- `WorkOrders.linked_order_id` — связь INCOMING ↔ CODED.
- Проба связана с Н/З через `SampleWorkOrders` (M:N).

### Инструменты

- Все Django-команды — **только** через `poetry run` из терминала.
- VS Code может сам дописывать `.vscode/settings.json` — при
  появлении в `git status` откатывать: `git restore .vscode/settings.json`.
- Git — только терминал. Терминал VS Code — **Git Bash**.
- SSH через `ssh.github.com:443`.

---

## Не трогать

- `RULES.md` — универсальные правила.
- `TEMPLATES.md` — базовые шаблоны.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` в Git (только `.env.example`).

---

## Правила текущей сессии

- Кодовая фаза: заход = код + тесты.
- Каждый заход — 1–3 файла кода (пачки — исключение для boilerplate).
- Файлы выдаются единым блоком.
- Все Django-команды — через `poetry run`.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.