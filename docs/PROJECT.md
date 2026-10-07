# PROJECT.md — карточка проекта

> Заполняется один раз при старте проекта. Меняется редко.
> Всё, что зависит от конкретного проекта, — здесь.

**Шаблон:** ai-development-template v1.0
**Дата заполнения:** 2026-10-07

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
- `feature/1.0-backend-init` (архив)
- `feature/1.0a-topology-v2` (архив)
- `feature/1.1-backend-api` (архив)

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

- **Язык (бэкенд):** Python 3.14
- **Фреймворк (бэкенд):** Django 5.2 + Django REST Framework
- **БД:** PostgreSQL 16+ (см. §БД)
- **Язык (мобильное):** Dart 3.13+ / Flutter 3.47+
- **Язык (веб):** TypeScript / React (позже)
- **Сборщик:** Poetry, pub, npm

### Зависимости (ключевые)

**Backend:**
- `psycopg[binary]` — драйвер PostgreSQL.
- `djangorestframework` — REST API.
- `djangorestframework-simplejwt` — JWT-аутентификация.
- `drf-spectacular` — OpenAPI 3.
- `django-environ` — чтение `.env`.
- `qrcode` + `pillow` — генерация QR.

**Mobile (план):**
- `dio` — HTTP-клиент (bundle-2).
- `flutter_secure_storage` — JWT (bundle-2).
- `provider` — state management (bundle-2).
- `mobile_scanner` — QR-сканер (bundle-4).
- `sqflite` — офлайн-кэш (позже).

### Окружение

- **IDE:** VS Code (backend, mobile, web, docs) + Android Studio (mobile).
- **ОС разработки:** Windows.
- **ОС сервера:** Linux (план).
- **CI:** GitHub Actions (условный).

---

## Команды

### Git

Все операции — только в терминале.

Создание ветки пачки:
git checkout feature/X.Y-xxx
git pull
git checkout -b fix/X.Y-bundle
git push -u origin fix/X.Y-bundle

text

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

text

### Backend

- Установка: `cd backend && poetry install`
- Тесты: `cd backend && poetry run pytest -q`
- Проверка миграций:
  `cd backend && poetry run python manage.py makemigrations --check --dry-run`
- Миграции: `cd backend && poetry run python manage.py migrate`
- Seeds: `cd backend && poetry run python manage.py seed_roles`
- Запуск: `cd backend && poetry run python manage.py runserver`

### Mobile

- Зависимости: `cd mobile && flutter pub get`
- Анализ: `cd mobile && flutter analyze`
- Тесты: `cd mobile && flutter test`
- Устройства: `cd mobile && flutter devices`
- Эмуляторы: `cd mobile && flutter emulators`
- Запуск: `cd mobile && flutter run -d <device_id>`
- Запуск на эмуляторе: `flutter run -d emulator-5554`
- Запуск на планшете: `flutter run -d 2312FPCA6G`

### База данных

Зависит от машины (см. §Многомашинность).

**Домашний ПК (Docker):**
docker compose up -d # Запустить PostgreSQL
docker compose ps # Статус
docker compose logs -f postgres # Логи
docker compose down # Стоп (данные сохраняются)
docker compose down -v # Стоп + удалить данные (ОСТОРОЖНО!)

text

**Рабочий ПК (портативный PG):**
pg_ctl.exe -D "D:/Dev/pgsql/pgdata" -l "D:/Dev/pgsql/pgdata/logfile.log" start
pg_ctl.exe -D "D:/Dev/pgsql/pgdata" status
pg_ctl.exe -D "D:/Dev/pgsql/pgdata" stop

text

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
| Python | 3.14 (`D:\Dev\python`) | 3.14 (`AppData\Local\...\Python314`) |
| Poetry | 2.5.1 | 2.5.1 |
| **PostgreSQL** | **Портативный** (`D:\Dev\pgsql\`) | **Docker Compose** |
| SSH к GitHub | `ssh.github.com:443` | `github.com:22` |
| Права админа | ❌ нет | ✅ есть |
| Flutter | ❌ не установлен | ✅ 3.47.6 / Dart 3.13.5 |
| Android SDK | ❌ | `C:\Android\Sdk` |
| Android Studio | есть | есть |

**Параметры БД одинаковые на обеих машинах:**
- БД: `wms_geology`
- Пользователь: `wms_user` / `wms_password`
- Хост: `localhost`, порт: `5432`

**Режимы работы:**
- **Основной:** VS Code + терминал (Git Bash / UCRT64).
- **Fallback:** веб-редактор GitHub.

**Правила при переезде проекта (переносе папки):**
1. `docker compose down` (домашний) / `pg_ctl stop` (рабочий).
2. Закрыть VS Code полностью.
3. Убить процессы `dart.exe`, `flutter.exe`, `python.exe`, `Code.exe`.
4. Переместить папку.
5. Открыть в VS Code.
6. **Backend:** `poetry env remove --all && poetry install` — venv хранит старый путь.
7. **Mobile:** `flutter clean && flutter pub get` — Dart-кэш хранит старый путь.
8. `docker compose up -d`.
9. `poetry run pytest -q` — 268 должно быть зелёное.
10. `flutter analyze` — 0 issues.

**Вопросы при старте чата:**
1. На какой машине работаешь? (Рабочий / Домашний)
2. Ветка, заход — назови текущий.

---

## Особенности

### Фазы проекта

1. **Проектная фаза** — завершена.
2. **Кодовая фаза** — активна.

### Серии

| Серия | Статус | Что сделано |
|---|---|---|
| 0.1-foundation | ✅ | Проектные доки |
| 0.2-prep-code | ✅ | Структура, `.env.example`, CI |
| 1.0-backend-init | ✅ | Django, 15 моделей, 78 тестов |
| 1.0a-topology-v2 | ✅ | Модели v2, picking, movements, 128 тестов |
| 1.1-backend-api | ✅ | REST API, JWT, OpenAPI, 268 тестов |
| **1.2-mobile-init** | 🟡 текущая | Flutter: структура, сканер, поиск, инвентаризация |
| 1.3-web-init | ⬜ | React: дашборд, реестр |
| 2.0-label-generator | ⬜ | Генератор этикеток |
| 2.1-migration | ⬜ | Миграция старых этикеток (OCR) |
| 2.2-sorting-assistant | ⬜ | Помощник сортировки (bin packing) |

### Внешние интеграции

Лаборатории — источники данных. Формат обмена на первом
этапе — **Уровень 1 (наклейка поверх)**. Уровень 2 — серия 2.0.

### QR-стратегия

- Основной QR — на **таре**.
- QR на **секции** — виртуальный вид ярусов A–D.
- QR на **ячейке** — точечная работа.
- На поддонах и пробах — **нет**.
- Старый ID → `Sample.legacy_data` (JSONB).

### Домен (ключевое)

- **Проба** — физическая единица хранения (`Sample`).
- Одна тара = **один** тип исследования.
- Номер пробы может повторяться.
- Н/З: `INCOMING` ↔ `CODED` через `linked_order_id`.
- Проба ↔ Н/З: M:N через `SampleWorkOrder`.
- `Pallet` — «тихий» объект (OneToOne с `Cell`).
- Ярусы — A, B, C, D (снизу вверх).
- `Container` удаляется только если пуст (`PROTECT`).
- Утилизация — **soft-delete** (`status = DISPOSED`).

### БД — два окружения

**Домашний ПК — Docker:**
- Образ `postgres:16`, контейнер `wms-geology-postgres`.
- Volume `postgres_data`.
- `docker-compose.yml` в корне проекта.

**Рабочий ПК — портативный PostgreSQL:**
- Бинарники: `D:\Dev\pgsql\pgsql\bin\`.
- Данные: `D:\Dev\pgsql\pgdata\`.
- Локаль кластера — `Russian_Russia.1251` (ТД-8).

### Терминал

**Рабочий ПК:** Git Bash (MINGW64).
**Домашний ПК:** UCRT64 (MSYS2).

**Общее:** `~` = домашняя папка; кириллицу в путях оборачивать
в кавычки; **не хранить проекты в папках с кириллицей** (Dart-анализатор
падает с `FormatException`).

### Flutter (домашний ПК)

- **Flutter:** 3.47.6 / Dart 3.13.5.
- **Android SDK:** `C:\Android\Sdk`, API 35.
- **JDK:** 17 (Microsoft).
- **Эмулятор:** Pixel Tablet.
- **Реальное устройство:** `2312FPCA6G` (Samsung Galaxy Tab).

### Известные грабли

- **`mobile/test/widget_test.dart`** — обновлён под `WmsGeologyApp`.
- **`drf-spectacular`** — warning про `_UnionGenericAlias` при Python 3.17. Не наш код.

---

## Проектные доки

| Файл | Шаблон | Дата |
|---|---|---|
| `DATABASE.md` | Схема данных (v2) | 2026-10-07 |
| `API.md` | API-контракты | 2026-10-07 |
| `SCENARIOS.md` | Сценарии (v2) | 2026-10-07 |
| `TEMPLATES-PROJECT.md` | Дополнения к шаблонам | 2026-10-07 |
| `UI.md` | Дизайн-система | (серия 1.3) |
| `INTEGRATIONS.md` | Внешние интеграции | (серия 2.0) |

---

## Проектные правила (дополняют `RULES.md`)

1. **Все Django-команды** — через `poetry run python manage.py ...`.
2. **Тесты** — `poetry run pytest`. Новый код → новые тесты.
3. **Миграции** — после изменения моделей: `makemigrations` + `migrate`.
4. **Проверка миграций** перед коммитом:
   `makemigrations --check --dry-run` → `No changes detected`.
5. **Схема БД меняется** только через миграцию + обновление `DATABASE.md`.
6. **API меняется** только через обновление `API.md`.
7. **Файлы доков** выдаются единым блоком.
8. **Архивные feature-ветки не удаляются** после merge в `main`.
9. **`.vscode/settings.json`** при появлении в `git status` — откатывать.
10. **Docker/PostgreSQL** — на домашнем через Docker Compose,
    на рабочем портативный.
11. **Не хранить проекты в путях с кириллицей** — Dart-анализатор падает.
12. **После переноса проекта** — пересоздавать `.venv` (`poetry env remove --all && poetry install`) и `flutter clean && flutter pub get`.