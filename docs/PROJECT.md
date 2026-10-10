# PROJECT.md — карточка проекта

> Заполняется один раз при старте проекта. Меняется редко.
> Всё, что зависит от конкретного проекта, — здесь.

**Шаблон:** ai-development-template v1.0
**Дата заполнения:** 2026-10-07
**Дата обновления:** 2026-10-10

---

## Что за проект

**Название:** WMS Geology

**Зачем:** Управление складским хранением геологических материалов
(проб, керна). Закрывает: отсутствие БД, поиск, наряд-задания,
QR-идентификацию, адресное хранение, отчётность, миграцию
существующих запасов.

**Для кого:**
- Менеджеры (создание Н/З, аналитика, отчёты).
- Рабочие / кладовщики (приёмка, выдача, инвентаризация, перемещения).
- Администраторы (пользователи, топология склада, БД).

**Что делает:** Единая база данных + веб-приложение (Windows/браузер) +
Android-приложение для планшетов. QR-коды как основной идентификатор
тары и ячеек. Адресное хранение: комната → стеллаж → секция → ярус (A–D)
→ ячейка (1–3) → поддон → тара → проба.

---

## Репозиторий

**URL:** https://github.com/ilia23star2-ops/WMS-Geology

**Основная ветка:** `main`

**Архивные ветки (не удаляем, `RULES.md` §7):**
- `feature/1.0-backend-init` (архив, 2026-10-07)
- `feature/1.0a-topology-v2` (архив, 2026-10-07)
- `feature/1.1-backend-api` (архив, 2026-10-07)
- `feature/1.2-mobile-init` (на паузе, 2026-10-08)
- `feature/1.3-backend-v2` (архив, 2026-10-09)
- `feature/2.0-excel-parser` (архив, 2026-10-09)
- `feature/2.1-label-generator` (архив, 2026-10-10)

**Активные имена веток:**
- `feature/X.Y-<имя>` — долгоживущая серия
- `fix/X.Y-bundle-N` — короткая ветка пачки
- `docs/<тема>` — только документация

---

## Язык общения

**Язык комментариев и UI:** русский
**Язык документации:** русский
**Язык коммитов:** русский

---

## Стек

### Основное

- **Язык (бэкенд):** Python 3.14 (целевой 3.12+)
- **Фреймворк (бэкенд):** Django 5.2 + Django REST Framework
- **БД:** PostgreSQL 16+ (см. §БД — два окружения)
- **Язык (мобильное):** Dart (Flutter)
- **Язык (веб):** TypeScript / React 18+
- **Сборщик:** Poetry (backend), npm (web), pub (mobile)

### Backend (ключевые зависимости)

- `psycopg[binary]` — драйвер PostgreSQL.
- `djangorestframework` — REST API.
- `drf-spectacular` — OpenAPI 3.
- `djangorestframework-simplejwt` — JWT.
- `django-environ` — чтение `.env`.
- `qrcode` — генерация QR.
- `pillow` — работа с изображениями для QR.
- `openpyxl` — парсинг Excel-приёмки.
- `fpdf2` — генерация PDF-этикеток.

### Web (ключевые зависимости)

- **Vite** — сборщик, dev-сервер.
- **React 18+** — UI.
- **TypeScript** — язык.
- **React Router v6** — навигация.
- **TanStack Query** — серверное состояние.
- **MUI (Material UI)** — компоненты, тема от `#1E3A5F`.
- **Zustand** — клиентское состояние (auth).
- **axios** — HTTP-клиент, JWT-интерцептор.
- **Vitest** — тесты.
- **ESLint + Prettier** — код-стайл.

### Mobile (ключевые зависимости)

- `mobile_scanner` — сканирование QR.
- `google_ml_kit` — OCR старых этикеток.
- `dio` / `http` — HTTP-клиент.
- `provider` / `riverpod` — управление состоянием.

### Окружение

- **IDE:** VS Code (бэкенд, веб, доки) + Android Studio (мобильное).
- **ОС разработки:** Windows (две машины — см. §Многомашинность).
- **ОС сервера:** Linux (план).
- **CI:** GitHub Actions (условный, включается по мере появления кода).

---

## Команды

### Git

Все операции — только в терминале. Создание ветки пачки:

    git checkout feature/X.Y-xxx
    git pull
    git checkout -b fix/X.Y-bundle
    git push -u origin fix/X.Y-bundle

Закрытие захода:

    git add .
    git commit -m "X.Y-bundle — <краткое>"
    git push
    git checkout feature/X.Y-xxx
    git pull
    git merge --no-ff fix/X.Y-bundle -m "Merge fix/X.Y-bundle"
    git push
    git branch -d fix/X.Y-bundle
    git push origin --delete fix/X.Y-bundle

### Сборка

- Backend: `cd backend && poetry install`
- Web: `cd web && npm install`
- Mobile: `cd mobile && flutter pub get`

### Тесты

- Backend: `cd backend && poetry run pytest -v`
- Проверка миграций: `cd backend && poetry run python manage.py makemigrations --check --dry-run`
- Web: `cd web && npm test`
- Mobile: `cd mobile && flutter test`

### Запуск

- Backend: `cd backend && poetry run python manage.py runserver`
- Web: `cd web && npm run dev` (порт 5173, proxy `/api` → `:8000`)
- Mobile: `cd mobile && flutter run`

### База данных

Зависит от машины (см. §БД).

**Домашний ПК (Docker):**

    docker compose up -d            # Запустить PostgreSQL
    docker compose ps               # Статус
    docker compose logs -f postgres # Логи
    docker compose down             # Стоп (данные сохраняются)
    docker compose down -v          # Стоп + удалить данные (ОСТОРОЖНО!)

**Рабочий ПК (портативный PG):**

    pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start
    pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status
    pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop

**Миграции и seeds (любая машина):**

    cd backend
    poetry run python manage.py migrate
    poetry run python manage.py seed_roles

---

## Пороги

- **Файлов в заходе:** 1–3
- **Файлов в пачке:** 3–7
- **Строк в файле:** до 500
- **Время теста:** до 500 мс
- **Стоп-сигнал по файлам:** больше 7

---

## Многомашинность

**Машины:**

| Параметр | Рабочий ПК | Домашний ПК |
|---|---|---|
| Путь проекта | `D:\Dev\projects\WMS-Geology` | `C:\Projert\WMS-Geology` |
| Терминал | Git Bash (MINGW64) | UCRT64 (MSYS2) |
| Python | 3.14 (`D:\Dev\python`) | 3.14 (user install) |
| Poetry | 2.5.1 | 2.5.1 |
| **PostgreSQL** | **Портативный** (`D:\Dev\pgsql\`) | **Docker Compose** |
| SSH к GitHub | `ssh.github.com:443` | `github.com:22` |
| Права админа | ❌ нет | ✅ есть |

**Параметры БД одинаковые на обеих машинах:**
- БД: `wms_geology`
- Пользователь: `wms_user` / `wms_password`
- Хост: `localhost`, порт: `5432`

**Режимы работы:**
- **Основной:** VS Code + терминал (Git Bash / UCRT64).
- **Fallback:** веб-редактор GitHub.

**При переключении машин:**
1. `git pull` — обновить локальную ветку.
2. `poetry install` — если изменился `pyproject.toml`.
3. `docker compose up -d` или `pg_ctl start` — поднять БД.
4. `poetry run python manage.py migrate` — применить новые миграции.
5. `poetry run pytest` — убедиться, что всё зелёное.

**Вопросы при старте чата:**
1. На какой машине работаешь? (Рабочий / Домашний)
2. Ветка, заход — назови текущий.

---

## Особенности

### Фазы проекта

1. **Проектная фаза** — завершена (серии 0.1, 0.2).
2. **Кодовая фаза** — активна.

**Текущая фаза:** кодовая.

### Серии

| Серия | Статус | Что сделано |
|---|---|---|
| 0.1-foundation | ✅ | Проектные доки |
| 0.2-prep-code | ✅ | Структура, `.env.example`, CI |
| 1.0-backend-init | ✅ | Django, 15 моделей, 78 тестов |
| 1.0a-topology-v2 | ✅ | Модели v2, picking, movements, 128 тестов |
| 1.1-backend-api | ✅ | API-эндпоинты, JWT, OpenAPI, 268 тестов |
| 1.2-mobile-init | ⏸ | Flutter init + API-клиент (на паузе) |
| 1.3-backend-v2 | ✅ | Справочники, приёмка, рейсы, 400 тестов |
| 2.0-excel-parser | ✅ | Парсер Excel-приёмки, 433 теста |
| 2.1-label-generator | ✅ | QR, PDF-этикетки, партии печати, 552 теста |
| **2.x-web** | 🟡 **текущая** | React: дашборд, реестры, печать |
| 2.x-mobile | ⬜ | Flutter: приёмка, сканер |
| 2.x-lab-portal | ⬜ | Портал лабораторий |
| 2.x-sorting | ⬜ | Помощник сортировки |
| 3.x-migration | ⬜ | Миграция старых этикеток (OCR) |

### Внешние интеграции

Лаборатории — источники данных. Формат обмена на первом
этапе — **Уровень 1 (наклейка поверх)**. Уровень 2 (портал
лабораторий) — серия 2.x-lab-portal.

### QR-стратегия

- Основной QR — на **таре**.
- QR на **секции** — виртуальный вид ярусов A–D.
- QR на **ячейке** — точечная работа.
- На поддонах и пробах — **нет**.
- Существующие этикетки не переклеиваются.
- Старый ID → `Sample.legacy_data` (JSONB).
- Payload: `WMSG:<TYPE>:<id>` (внутренний ID, не номер).

### Домен (ключевое)

- **Проба** — физическая единица хранения (`Sample`).
- Разделение по типам — **вне WMS**.
- Одна тара = **один** тип исследования.
- Номер пробы может повторяться.
- Н/З: `INCOMING` ↔ `CODED` через `linked_order_id`.
- Проба ↔ Н/З: M:N через `SampleWorkOrder`.
- **User** — стандартный Django + `UserProfile` (OneToOne).
- `Pallet` — «тихий» объект (OneToOne с `Cell`).
- `Cell` вмещает **1 поддон** (не 3).
- Ярусы — A, B, C, D (снизу вверх).
- `Container` удаляется только если пуст (`PROTECT` от `Sample`).
- Утилизация — **soft-delete** (`status = DISPOSED`).
- `PrintBatch.status` — soft через `CANCELLED`.
- `PrintBatchItem.container` — `PROTECT`.

### БД — два окружения

**Домашний ПК — Docker:**
- Образ `postgres:16`, контейнер `wms-geology-postgres`.
- Volume `postgres_data` — данные переживают рестарт.
- `docker-compose.yml` в корне проекта.
- Снести всё: `docker compose down -v`.

**Рабочий ПК — портативный PostgreSQL:**
- Бинарники: `D:\Dev\pgsql\pgsql\bin\`.
- Данные: `D:\Dev\pgsql\pgdata\`.
- Запуск вручную (не служба Windows).
- Локаль кластера — `Russian_Russia.1251` (техдолг ТД-8).

### Терминал

**Рабочий ПК:** Git Bash (MINGW64).
**Домашний ПК:** UCRT64 (MSYS2).

**На обеих машинах:** `~` = домашняя папка; кириллицу в путях
оборачивать в кавычки.

**Особенность MSYS2:** `manage.py shell -c "..."` ломается —
использовать временный скрипт или одной строкой в REPL.

---

## Проектные доки

| Файл | Версия / дата | Примечание |
|---|---|---|
| `DATABASE.md` | v5 (2026-10-10) | + PrintBatch, PrintBatchItem |
| `API.md` | 2026-10-10 | + labels/print-batches |
| `SCENARIOS.md` | v4 | |
| `UI.md` | v2 (2026-10-10) | Дизайн-система, MUI |
| `TEMPLATES-PROJECT.md` | 2026-10-07 | Дополнения к шаблонам |
| `INTEGRATIONS.md` | (серия 2.x-lab-portal) | Внешние интеграции |

---

## Проектные правила (дополняют `RULES.md`)

1. **Все Django-команды** — через `poetry run python manage.py ...`.
2. **Тесты** — `poetry run pytest`. Новый код → новые тесты.
3. **Миграции** — после изменения моделей: `makemigrations` + `migrate`.
4. **Проверка миграций** перед коммитом:
   `poetry run python manage.py makemigrations --check --dry-run`
   должен говорить `No changes detected`.
5. **Схема БД меняется** только через миграцию + обновление `DATABASE.md`.
6. **API меняется** только через обновление `API.md`.
7. **Файлы доков** выдаются единым блоком.
8. **Архивные feature-ветки не удаляются** после merge в `main`.
9. **`.vscode/settings.json`** при появлении в `git status` — откатывать.
10. **Docker/PostgreSQL** — на домашнем через Docker Compose, на рабочем
    портативный. Не запускать оба на одной машине одновременно.
11. **Web-команды** — `cd web && npm ...`. Не смешивать с backend.
12. **Web: файлы** — компоненты, страницы, хуки. Не копировать логику
    из backend, использовать API.