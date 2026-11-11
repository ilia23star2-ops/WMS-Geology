# PROJECT.md — карточка проекта

> Заполняется один раз при старте проекта. Меняется редко.
> Всё, что зависит от конкретного проекта, — здесь.

**Шаблон:** ai-development-template v1.0
**Дата заполнения:** 2026-10-07
**Дата обновления:** 2026-11-05

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
- `feature/1.0-backend-init` (2026-10-07)
- `feature/1.0a-topology-v2` (2026-10-07)
- `feature/1.1-backend-api` (2026-10-07)
- `feature/1.2-mobile-init` (влита в `2.x-mobile`)
- `feature/1.3-backend-v2` (2026-10-09)
- `feature/2.0-excel-parser` (2026-10-09)
- `feature/2.1-label-generator` (2026-10-10)
- `feature/2.x-web` (2026-10-10)
- `feature/2.x-mobile` (2026-10-12)
- `feature/2.x-web-v2` (2026-10-27)

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
- **Язык (мобильное):** Dart 3.13+ / Flutter 3.47+
- **Язык (веб):** TypeScript / React 19
- **Сборщик:** Poetry (backend), npm (web), pub (mobile)

### Backend (ключевые зависимости)

- `psycopg[binary]` — драйвер PostgreSQL.
- `djangorestframework` — REST API.
- `drf-spectacular` — OpenAPI 3.
- `djangorestframework-simplejwt` — JWT.
- `django-environ` — чтение `.env`.
- `qrcode` — генерация QR.
- `pillow` — изображения для QR.
- `openpyxl` — парсинг Excel-приёмки.
- `fpdf2` — генерация PDF-этикеток и акта приёмки.

### Web (ключевые зависимости)

- **Vite 8** — сборщик, dev-сервер.
- **React 19** — UI.
- **TypeScript** — язык.
- **React Router 7** — навигация.
- **TanStack Query 5** — серверное состояние.
- **MUI 9** — компоненты, тема от `#1E3A5F`.
- **Zustand 5** — клиентское состояние (auth).
- **axios** — HTTP-клиент, JWT-интерцептор.
- **Vitest** — тесты.
- **ESLint + Prettier** — код-стайл.

### Mobile (ключевые зависимости)

- `mobile_scanner` — сканирование QR.
- `google_ml_kit` — OCR старых этикеток (позже).
- `dio` — HTTP-клиент.
- `provider` — управление состоянием.
- `flutter_secure_storage` — хранение JWT.
- `sqflite` — локальная БД (офлайн).
- `shared_preferences` — история сканов, device_id.

### Окружение

- **IDE:** VS Code (бэкенд, веб, доки) + Android Studio (мобильное).
- **ОС разработки:** Windows (две машины — см. §Многомашинность).
- **ОС сервера:** Linux (план).
- **CI:** GitHub Actions (условный, включается по мере появления кода).

---

## Команды

> **Полный справочник команд, алиасов, диагностики, USB↔WiFi, логов — `docs/COMMANDS.md`.**
> Здесь — только основное: git flow, базовый запуск сервера, тесты. Диагностика, переключение USB↔WiFi, мониторинг загрузок, готовые алиасы, частые проблемы — там.

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

**На рабочем ПК — НЕ `git add .`** (см. §Проектные правила, п.15).

### Backend

**Установка и запуск:**

    cd backend
    poetry install
    poetry run python manage.py migrate
    poetry run python manage.py runserver            # http://127.0.0.1:8000/
    poetry run python manage.py runserver 0.0.0.0:8000  # доступ по IP (mobile)

**Тесты:**

    cd backend
    poetry run pytest -v
    poetry run pytest -q
    poetry run pytest apps/<app>/tests/test_<file>.py -v

**Проверки:**

    poetry run python manage.py check
    poetry run python manage.py makemigrations --check --dry-run

**Seeds:**

    poetry run python manage.py seed_roles
    poetry run python manage.py seed_catalogs
    poetry run python manage.py seed_container_comments

**Shell (осторожно в MSYS2 — использовать одной строкой или временный скрипт):**

    poetry run python manage.py shell

### Web

**Установка и запуск:**

    cd web
    npm install
    npm run dev            # http://localhost:5173/, proxy /api → :8000
    npm run build          # production-сборка
    npm run preview        # просмотр production

**Тесты и линт:**

    npm test               # Vitest (single run)
    npm run test:watch     # Vitest (watch)
    npm run lint           # ESLint
    npm run format         # Prettier

### Mobile

**Установка и запуск:**

    cd mobile
    flutter pub get
    flutter run            # дома (дефолт API_HOST=192.168.0.77)
    flutter devices        # список устройств

**На рабочем ПК (USB):**

    # 1. Проброс порта через USB
    adb reverse tcp:8000 tcp:8000

    export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn

    # 2. Запуск с API_HOST=127.0.0.1
    flutter run --dart-define=API_HOST=127.0.0.1 --android-skip-build-dependency-validation

**Проверки:**

    flutter analyze
    flutter test
    flutter clean          # очистка сборки

**Backend для mobile** должен слушать `0.0.0.0:8000` (WiFi) или
`127.0.0.1:8000` + `adb reverse` (USB).

**`flutter analyze` / `flutter test` НЕ пересобирают APK.** После правки
кода — `flutter run` (правило 21).

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

### Алиасы (`~/.bashrc`)

> **Полный список алиасов (30+) — `docs/COMMANDS.md` §13.** Старые 4
> (`wmsroot`, `wmsbe`, `wmstest`, `wmsmig`) — устарели, не хватает
> мастер-команд (`wms-start-be`, `wms-check`, `wms-reset`,
> `wms-stop`, `adbreset`, `wmslogs`, ...).

Установка:
1. Открыть `~/.bashrc` (`code ~/.bashrc` или `notepad ~/.bashrc`).
2. Вставить блок §13.2 (🏢) или §13.3 (🏠) из `COMMANDS.md`.
3. `source ~/.bashrc`.
4. Проверить: `type wms-start-be` → `wms-start-be is aliased to ...`.

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
| Node.js | 24.x (`D:\Dev\nodejs\node`) | 24.x |
| **PostgreSQL** | **Портативный** (`D:\Dev\pgsql\`) | **Docker Compose** |
| SSH к GitHub | `ssh.github.com:443` | `github.com:22` |
| Права админа | ❌ нет | ✅ есть |
| Интернет | Прокси `Polymetal.ru` | Прямой |
| **Планшет ↔ backend** | **USB** (`adb reverse` + `127.0.0.1`) | **WiFi** (`0.0.0.0` + `192.168.x.x`) |

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
| 1.2-mobile-init | ✅ | Flutter init + API-клиент (влита в `2.x-mobile`) |
| 1.3-backend-v2 | ✅ | Справочники, приёмка, рейсы, 400 тестов |
| 2.0-excel-parser | ✅ | Парсер Excel-приёмки, 433 теста |
| 2.1-label-generator | ✅ | QR, PDF-этикетки, партии печати, 552 теста |
| 2.x-web | ✅ | React: логин, реестры, печать, справочники |
| 2.x-mobile | ✅ | Flutter: auth, сканер QR, карточка тары, 32 теста |
| 2.x-web-v2 | ✅ | Приёмка, топология, полный CRUD, QR топологии, 779 тестов |
| **3.x-offline** | 🟡 **текущая** | Мобильный офлайн: SQLite, SyncService, SyncQueue, Deferred Login, USB |
| 2.x-lab-portal | ⬜ | Портал лабораторий |
| 2.x-lifecycle | ⬜ | Пересмотр статусов Container / Sample |
| 2.x-sorting | ⬜ | Помощник сортировки |
| 2.x-rbac | ⬜ | Роли и права |
| 3.x-migration | ⬜ | Миграция старых этикеток (OCR) |
| 3.x-deploy | ⬜ | Сборка web + backend в installer |

### Внешние интеграции

Лаборатории — источники данных. Формат обмена на первом
этапе — **Уровень 1 (наклейка поверх)**. Уровень 2 (портал
лабораторий) — серия 2.x-lab-portal.

### QR-стратегия

- Основной QR — на **таре**.
- QR на **секции** — виртуальный вид ярусов A–D. Автогенерация
  при создании (`WMSG:SECTION:<id>`); PDF-печать через
  `GET /storage/sections/{id}/qr.pdf/` и batch `qr-batch`.
- QR на **ячейке** — точечная работа. Автогенерация
  (`WMSG:CELL:<id>`); PDF через `GET /storage/cells/{id}/qr.pdf/`.
- На поддонах и пробах — **нет**.
- Существующие этикетки не переклеиваются.
- Старый ID → `Sample.legacy_data` (JSONB).
- Payload: `WMSG:<TYPE>:<id>` (внутренний ID, не номер).
- **QR offline-токена** — base64-JSON `{token, purpose, expires_at, user}`.

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
- `Container.container_number` — **не уникален** глобально
  (см. DECISIONS 1.61).
- `Container.status` — начальный статус `PENDING_FILLING`
  («Ожидает заполнения», см. DECISIONS 1.62).
- `PrintBatch.status` — soft через `CANCELLED`.
- `PrintBatchItem.container` — `PROTECT`.

### Стратегия разработки

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.** Всё, что можно проверить в
   браузере, делается на web.
2. **Mobile — по требованию.** Если web-фича требует проверки на
   устройстве (сканирование QR, камера, физические манипуляции) —
   web ставится на паузу, mobile доводится до минимума, проверяется,
   возвращаемся к web.
3. **Роли и права — после.** Пока всё тестируется всеми.
4. **`Receipt`** — только для Excel и акта приёмки. Оцифровка и ручной
   ввод идут через `Container` + `Sample` напрямую.

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

**Особенности MSYS2:**
- `manage.py shell -c "..."` ломается — использовать одной строкой
  или временный скрипт.
- `ipconfig` ломается на кодировке — использовать `powershell` или
  `ipconfig | iconv -f CP866 -t UTF-8 | grep -a "IPv4"`.
- `cat > file << 'EOF'` — надёжный способ заменить файл.

---

## Проектные доки

| Файл | Версия / дата | Примечание |
|---|---|---|
| `DATABASE.md` | v7 (2026-10-16) | + PENDING_FILLING, QR topology, unique снят, каскад |
| `API.md` | 2026-10-16 | + qr.pdf, qr-batch, delete receipt-items, PENDING_FILLING, offline-login |
| `SCENARIOS.md` | v4 | Сценарии приёмки, выборки, портала |
| `UI.md` | v2 (2026-10-10) | Дизайн-система, MUI |
| `TEMPLATES-PROJECT.md` | 2026-10-07 | Дополнения к шаблонам |
| `INTEGRATIONS.md` | (серия 2.x-lab-portal) | Внешние интеграции |
| `COMMANDS.md` | 2026-11-05 | Команды, алиасы, диагностика, USB↔WiFi, мониторинг, бэкапы, частые проблемы |

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
13. **Mobile-команды** — `cd mobile && flutter ...`. Backend для mobile
    должен слушать `0.0.0.0:8000` (WiFi) или `127.0.0.1:8000` + `adb reverse` (USB).
14. **Долгие загрузки — только с видимым прогрессом.** Если заход
    включает скачивание объёмного файла (SDK, дистрибутив Gradle,
    Maven-артефакт > 50 МБ) через прокси или медленный канал,
    ИИ обязан дать пользователю скрипт онлайн-мониторинга
    (Python/`while`-цикл) в том же заходе, до старта загрузки.
    Минимум: текущий размер, скорость роста, признак «застряло»
    (нет роста 2–3 мин). Без монитора долгие загрузки не запускаются.
15. **На рабочем ПК — не делать `git add .`.** Явные имена файлов.
    Иначе попадут машинные `mobile/android/*` (maven-local, `file:///`,
    `checkRevocation`) и сломают сборку дома.
16. **`adb reverse` сбрасывается** при переподключении USB, после
    `adb kill-server`/`start-server`, после перезагрузки планшета/ПК.
    Повторять `adb reverse tcp:8000 tcp:8000` каждый раз.
17. **`--dart-define=API_HOST`** — на работе `127.0.0.1` (USB), дома
    дефолт `192.168.0.77` (WiFi). Не хардкодить IP в `config.dart`.
18. **Не использовать `hide Container`** в файлах без модели `Container`
    (например, в `home_screen.dart` нужен Flutter-виджет `Container`).
19. **NDK r28c**, **Platform 36**, **Build-tools 36.0.0** — лежат в
    `D:\Dev\android-sdk`. Не перекачивать на рабочем ПК (медленно).
    Источник: `wms-bundle/install_bundle.ps1` (распаковка с флешки).
20. **`D:\Dev\maven-local`** и **`work-pc-setup/`** — нужны для каждой
    сборки на рабочем ПК. Не удалять.
21. **`flutter analyze` / `flutter test` НЕ пересобирают APK.** После
    правки кода — `flutter run` (или `flutter clean && flutter run`).
    Иначе на планшете останется старая сборка, и device-check врёт.

22. **Новые команды и алиасы — в `docs/COMMANDS.md`, не в `PROJECT.md`.**
    `PROJECT.md §Команды` не пухнет. Каждая новая команда (диагностика,
    USB↔WiFi, мониторинг) — туда, с пояснением.

23. **Device-check — после юнит-тестов, не раньше.** В каждом заходе
    раздел «Что проверить» состоит из **двух шагов**:

    **Шаг 1 — юнит-тесты** (без планшета/браузера):
    - Mobile: `cd mobile && flutter analyze && flutter test`.
    - Backend: `cd backend && poetry run pytest -q`.
    - Web: `cd web && npm test`.
    Для каждой — команда + что ожидать (`No issues found!`,
    `842 passed`, `24 passed`).
    Конец шага 1: **«✋ СТОП. Пришли вывод трёх команд. Если хоть
    одна красная — чиним в этом же заходе, device-check не начинаем.»**

    **Шаг 2 — device-check по стадиям** (только после того, как
    пользователь написал «тесты зелёные» / прислал вывод).
    Каждая стадия — копипаст-команда (code-блок без языка) +
    `Что ожидать` + `Что прислать` + `Если не работает`.
    Минимум 4 стадии: подготовка → основной сценарий → синхронизация
    → проверка результата.

24. **Device-check — понятным языком и копипаст-готовым.** В каждом
    device-check обязательно:

    **Для мобилки (планшет):**
    - `adb devices` — проверить, что планшет виден.
    - `adb reverse tcp:8000 tcp:8000` / `adb reverse --remove-all` —
      включить / выключить туннель.
    - `flutter clean && flutter run ...` — пересборка APK (если менял
      код).
    - `adb shell pm clear com.example.wms_geology_mobile` — стереть
      данные (если нужно «с нуля»).
    - `adb logcat -c && adb logcat | grep -iE "flutter|push|..."` —
      логи.
    - **Симуляция офлайна** (важно!): на рабочем ПК — **`adb reverse
      --remove-all`** (WiFi-отключение не помогает — `reverse` идёт
      по USB). На домашнем ПК — `adb shell svc wifi disable` +
      `adb shell svc data disable`.
    - **Возврат онлайна:** `adb reverse tcp:8000 tcp:8000` (работа) /
      `adb shell svc wifi enable` + `adb shell svc data enable` (дом).

    **Для веба (браузер):**
    - Какой URL открыть (`http://localhost:5173/...`).
    - Что нажать / куда посмотреть (F12 → Console / Network).
    - Что должно быть видно на экране (не «проверь», а «должно быть
      поле X со значением Y»).

    Для каждой команды — `Что ожидать` (конкретный вывод) и
    `Если не работает — смотри §… COMMANDS.md`.
25. **Формат правок от ИИ — по объёму/сложности.** ИИ сам выбирает:

    | Объём | Формат |
    |---|---|
    | Новый файл / правок > 30% | Полный файл целиком |
    | Добавить раздел в конец | `cat >> file << 'EOF'` + `grep -q` guard |
    | Заменить абзац / строку | `sed -i` с точным regex |
    | Несколько мелких правок | **Один bash-блок** с несколькими `sed`/`cat >>`, `# ---` между ними |
    | Средний объём (10–30%) | ИИ выбирает: `cat >` или 2–3 `sed` |

    **Всегда:** бэкап (`cp file file.bak`), guard (`grep -q` — от дублирования),
    проверка (`grep -n` / `tail -20`), откат (`cp file.bak file`).
    **Причина:** пользователь копирует один блок → вставляет в bash → всё
    применяется. Не переписывать 600-строчный файл из-за 5 строк.

26. **Вывод команд — однозначный.**

    После каждого блока команд (bash-правки, тесты, диагностика) —
    короткий итог, чтобы сразу было видно: "всё ок" или "где сломалось".

    Формат:
    - успех → `===== ИТОГ =====` + `✅ ВСЁ ОК — <что сделано>`
    - ошибка → `===== ИТОГ =====` + `❌ ПРОБЛЕМА: <что>` + `Подсказка: <что сделать>`

    Где применять:
    - мои bash-блоки — `grep`/`tail` + `===== ИТОГ =====`;
    - тесты — `📊 Mobile: ✅ 222 passed` / `❌ 2 failed: test_xxx`;
    - диагностика — `✅ Планшет виден, туннель есть` / `❌ нет туннеля`.

    Причина: пользователь копирует вывод → вставляет в чат →
    ИИ сразу видит "всё ок" или "что чинить", без чтения 50 строк.
    Экономит 3–5 минут на итерации.

27. **Вывод bash-блоков — автокопирование в буфер.**

    Все мои bash-блоки, которые требуют отчёта пользователя, в конце
    копируют сводку в буфер обмена. Пользователь просто Ctrl+V в чат.

    Способ: `base64 -w0` → `powershell.exe` → `[Convert]::FromBase64String`
    → `[Text.Encoding]::UTF8.GetString` → `Set-Clipboard`.

    Почему не `clip.exe`: на русской Windows он читает stdin как CP866,
    UTF-8 превращается в ╨в╨╡╤Б╤В. Base64 обходит кодировку — PowerShell
    декодирует байты как UTF-8 сам.

    Формат (обязательные шаги):
    1. Сводка в `/tmp/wms_summary.txt`.
    2. Показать на экране (cat/tee).
    3. `B64=$(base64 -w0 /tmp/wms_summary.txt)`.
    4. `powershell.exe ...FromBase64String('$B64')... | Set-Clipboard`.
    5. Подсказка "📋 Скопировано — Ctrl+V в чат".

    Причина: экономит копирование вручную и исключает опечатки. Один
    Ctrl+V вместо выделения и копирования.

25. Формат правок от ИИ — по объёму и сложности. ИИ выбирает: полный файл или точечные sed.
26. Вывод команд — однозначный. Итог: ===== ИТОГ ===== и OK или ПРОБЛЕМА.
27. Автокопирование в буфер через base64 и PowerShell.
28. Итог-блоки. Теги: [Файл], [Дописать], [Правка], [Тесты], [Проверка], [Git]. Все кроме [Файл] заканчиваются wms_report.
29. Git Итог-блок захода: checkout android -> add -> commit -> push -> wms_report.
30. Тег [Git] в шапке блока для всех Git-команд.
31. Максимальный bash-блок — 30 строк. НИКАКИХ символов доллара и heredoc в чате. Для правок использовать [Файл] в VS Code или printf.

32. **Передача контекста (Handoff) при переполнении чата.** При приближении к лимиту контекста ИИ обязан сформировать HANDOFF-блок (по RULES.md 13.6) и дать пользователю четкую инструкцию, какие файлы прикрепить в новый чат (RULES.md, PROJECT.md, CONTEXT.md).

33. **Памятка для нового ИИ в HANDOFF.** В HANDOFF обязательно включать пункт "Важное напутствие" с напоминанием о правилах 21-31 (запрет символа доллара и cat << EOF в чате, использование Итог-блоков и wms_report), чтобы новый ИИ не сломал форматирование.


35. **Умные блоки с логированием (Smart Blocks v2).**
    Любой блок (Правка, Тесты, Линтер), который может упасть, ОБЯЗАН выводить ошибку в буфер.
    **ВАЖНО:** В Git Bash на Windows нельзя использовать `exit 1` (закрывает терминал). Использовать `if/else`.
    
    **Если ошибка возникает в Python-скрипте:**
    Не полагаться на `2>&1` (кириллица превратится в кракозябры). Вместо этого ловить ошибку внутри Python и писать лог-файл в UTF-8:
    ```python
    import traceback
    try:
        # код
    except Exception as e:
        with open('/tmp/err.log', 'w', encoding='utf-8') as f:
            traceback.print_exc(file=f)
        sys.exit(1)
    ```
    
    **Для Pytest / Линтера:**
    ```bash
    poetry run pytest ... > /tmp/pytest.log 2>&1
    if grep -q "failed" /tmp/pytest.log; then
        echo "❌ ТЕСТЫ УПАЛИ. Логи:" > /tmp/wms_summary.txt
        cat /tmp/pytest.log >> /tmp/wms_summary.txt
        wms_report "❌ ТЕСТЫ УПАЛИ"
    fi
    ```
