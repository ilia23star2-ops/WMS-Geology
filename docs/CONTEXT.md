# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-02

---

## Где мы

**Активная серия:** `feature/3.x-offline` — офлайн-режим мобильного приложения.
**Долгоживущий бранч:** `fix/2.x-mobile-bundle-c-2` (вся серия в нём).

**Текущий заход:** серия `c` (мобильный офлайн).

**Backend (`c-1`..`c-6b`):**
- `c-1` SQLite, `c-2` SyncService (Pull), `c-3` SyncQueue (Push), `c-4` SyncScreen, `c-4.5` Deferred Offline Login, `c-4.6` USB-режим — ✅ **закрыты**.
- `c-6a-pre` — починка pre-existing (`log_audit(old_value)`, `UserProfile.__str__`, stale-тесты AccessToken) — ✅ **закрыт 2026-10-30**.
- `c-6a` — `GET /health/` + денормализация `ContainerSerializer` — ✅ **закрыт 2026-10-30**.
- `c-6b` — `?updated_since=` (инкр. Pull) — ✅ **закрыт 2026-10-30**.

**Mobile (сеть, сканер):**
- `c-6c` — auto-detect сети (`NetworkProbe`, `AppConfig.resolve`) — ✅ **закрыт 2026-10-30**.
- `c-6d-fix` + `c-6d-fix-3` — scanWindow 220×220 + landscape-фикс (`mapImageToWidgetFrame` swap) — ✅ **закрыты 2026-11-02**.
- `c-6f` — `NetworkMonitor` — **откачен** (регресс, заменён на `c-6g`).

**Mobile (карточка тары, серия `c-7`):**
- `c-7a` — шапка + 3 вкладки + адаптив (портрет/ландшафт) — ✅ **закрыт 2026-11-02**.
- `c-7b` — форма шапки (`ContainerEditForm`, справочники) + `c-7b-fix` (дозакоммит) — ✅ **закрыт 2026-11-02**.
- `c-7f` — `FillContainerContent` (диапазоны проб, skip/selected, удаление) + `c-7f-fix` (`_sampleTile` без дублей ТИ/Н/З) — ✅ **закрыт 2026-11-02**.
- `c-7g` — вкладка «Пробы» как в вебе (поиск, чекбоксы, bulk-статус, цветные чипы, `SampleEditDialog`) — ✅ **закрыт 2026-11-02**.
- `c-7h` — история сканов `Н/З · ТИ · номер` (`ScanHistoryEntry`, миграция старого формата) + `c-7h-fix` (порядок) + `c-7h-fix-2` (дозакоммит) — ✅ **закрыт 2026-11-02**.
- `c-7d` — PDF предпросмотр (`ApiClient.download` + `open_filex`). ✅ **закрыт 2026-11-02**.
- `c-7f-1` — подготовка offline-рендера PDF (ассеты, `LabelData`). ✅ **закрыт 2026-11-02**.
- `c-7f-2` — offline-рендер PDF на Dart (`pw.Text`, `pw.BarcodeWidget`, галочка `CustomPaint`). ✅ **закрыт 2026-11-02**.

**Mobile (сеть, иконка):**
- `c-6g` — `NetworkStatusProvider` (heartbeat `/health/` 10 с, auto-switch host) + иконка сети на `HomeScreen` — ✅ **закрыт 2026-11-02**.
- `c-6h` — синхронизация запрещена при `!isOnline` / `pendingOffline` — ✅ **закрыт 2026-11-02**.
- `c-6g-login` — иконка сети на `LoginScreen` — ✅ **закрыт 2026-11-02**.

**Следующие заходы:**
- `c-7c` — кнопка «Разместить» (`PlaceContainerDialog` каскад). ⬜ **следующий**
- `c-7e` — кэш истории офлайн (SQLite `container_history`). ⬜
- `c-8a`..`c-8e` — изменения в офлайне (`sync_queue`, автотриггер). ⬜

**Отложено:** `c-5` (sneakernet через флешку).

**Предыдущая серия:** `2f` — закрыта полностью.

**Что готово (mobile):**
- Логин (пароль + QR), logout, refresh токенов.
- Сканер QR, карточка тары, список проб внутри.
- SQLite (`c-1`), Pull (`c-2`), Push (`c-3`), `SyncScreen` (`c-4`).
- Deferred Offline Login (`c-4.5`), USB-режим (`c-4.6`).
- Auto-detect сети (`c-6c`), `NetworkStatusProvider` (`c-6g`).
- ScanWindow 220×220 + landscape-фикс (`c-6d-fix-3`).
- Карточка тары: 3 вкладки, адаптив, форма шапки, FillContainerContent, вкладка «Пробы» как в вебе, история сканов с `Н/З · ТИ · номер` (`c-7a`..`c-7h-fix-2`).
- PDF предпросмотр: online (`c-7d`) + offline-рендер на Dart (`c-7f-1`, `c-7f-2`).

**Сборка на рабочем ПК (прокси):**
- `work-pc-setup/setup.ps1` — **обязателен после `git reset --hard`**.
- `export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn` — в каждом новом окне.
- `flutter run --android-skip-build-dependency-validation`.
- `adb reverse tcp:8000 tcp:8000` — вручную (после USB-reconnect).

**Backend:** 842 теста.
**Web:** 24 юнит-теста.
**Mobile:** 111 юнит-тестов.

**Ближайшая работа:**
- Docs закрыты. Дальше — `c-7c` (Разместить) → `c-7e` (кэш истории) → `c-8a..c-8e` (офлайн-запись).

---

## Стратегия разработки

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.**
2. **Mobile — по требованию.**
3. **Роли и права — после.**
4. **`Receipt`** — только для Excel и акта приёмки.

---

## Что готово

### Инфраструктура
- Python 3.14 + Poetry + Django 5.2 + DRF.
- PostgreSQL: Docker (домашний ПК) / портативный (рабочий).
- JWT, OpenAPI, 10 приложений.
- Node 20+, Vite 8, React 19, MUI 9.
- Flutter 3.47 + Dart 3.13 + mobile_scanner 7.4.2.

### Backend (842 теста)
| Приложение | Что внутри |
|---|---|
| `storage` | Топология, Pallet, ContainerType, Container (+draft, nullable number, PENDING_FILLING), bulk-create, fill-samples, bulk-place, create-in-cell, history, print_batch_status, `filters.apply_updated_since` |
| `samples` | ResearchType, Site, Laboratory, Well, Sample (+PENDING_PLACEMENT, SELECTED, dispose/restore), SampleWorkOrder, sync-сервис, `?updated_since=` |
| `work_orders` | WorkOrder (self-ref + site, admin, samples_count) |
| `receiving` | Receipt, ReceiptItem (+container_type), ImportSession, conflicts, resolve-conflicts, check, complete, act |
| `picking` | PickList, PickListItem, Shipment (+direction, статусы), ShipmentItem |
| `movements` | MoveOperation, MoveOperationItem |
| `inventory` | InventorySession, InventoryScan, InventoryIssue, ActualizationTask, offline_import |
| `users` | Role, UserProfile, AuditLog, `log_audit` (+old_value), AccessToken (+qr_svg), JWT, offline-login, code-login |
| `labels` | QR-сервис, PDF-этикетки, QR-сетка, PrintBatch (+name), PrintBatchItem, act_service |

### Web (React, 24 юнит-теста)
| Раздел | Что внутри |
|---|---|
| Аутентификация | Zustand-стор, login, protected routes, JWT-интерцептор. |
| Layout | MUI sidebar + header. |
| Главная | 4 карточки. |
| Тара | DataGrid, фильтры, edit, delete (с force), PDF, bulk-print, создание, заполнение, предпросмотр, геометка, иконки печати. |
| Пробы | Дерево-таблица, `SampleEditDialog`, геометка. |
| Наряд-заказы | `WorkOrdersPage`, диалоги создания / связывания / сводки. |
| Печать | Партии, детали, PDF, переименование. |
| Справочники | CRUD. |
| Приёмка | Список, детали, сверка, акт. |
| Топология | Дерево, ячейки, поддоны, `CellContentsDialog`, `CreateInCellDialog`, force-удаление. |
| Карточка тары | `ContainerDetailDialog` (Пробы / Редактирование / История + Предпросмотр / Разместить / Местоположение). |
| Коды доступа | `AccessTokensPage` — создание, просмотр QR, отзыв. |

### Mobile (Flutter, 111 юнит-тестов)
| Раздел | Что внутри |
|---|---|
| Аутентификация | `AuthProvider`, login (пароль + QR), `TokenStorage` на `flutter_secure_storage`. |
| API | `ApiClient` (Dio), JWT-интерцептор. |
| Сеть | `NetworkProbe` + `AppConfig.resolve` (auto-detect). `NetworkStatusProvider` (heartbeat `/health/` 10 с, auto-switch host). `NetworkBadge` (`cloud_done` / `cloud_off` / `vpn_key`). |
| Главная | Приветствие + «Сканировать», «Синхронизация», история тар (`Н/З · ТИ · номер`), плашки. |
| Сканер | `mobile_scanner 7.4.2`, payload `WMSG:<TYPE>:<ID>`. ScanWindow 220×220 (portrait + landscape). |
| Карточка тары | 3 вкладки (Пробы / Редактирование / История), адаптив (портрет — сворачиваемая шапка, ландшафт — панель слева + табы справа). Карандаш в `AppBar` — форма шапки (`ContainerEditForm`). |
| Пробы | Вкладка: поиск, чекбоксы, bulk-статус, `SampleEditDialog` (edit/dispose/restore/delete), цветные чипы. |
| Редактирование | `FillContainerContent` — диапазоны (`parseSampleInput`), skip/selected (`RangeEditDialog`), добавление, удаление. |
| История | Аудит тары (`AuditLog`). |
| PDF | Online предпросмотр (`ApiClient.download` + `open_filex`) + offline-рендер на Dart (`label_pdf_generator.dart`, `LabelData`). |
| Офлайн (SQLite) | `Database` v4, `ContainerDao`, `SampleDao`, `SyncQueueDao`. |
| Офлайн (Sync) | `SyncService.pullAll()`, `SyncPusher.pushAll()`. Блокировка синхронизации при `!isOnline`. |

### Документация
- `PROJECT`, `CONTEXT`, `DECISIONS` (91), `DATABASE` (v7), `API`, `SCENARIOS`, `UI` (v2), `TESTING`, `PLAN`, `PROGRESS`, `ISSUES`.

---

## Известные грабли

### PostgreSQL
- **Домашний ПК:** Docker (`docker compose up -d`).
- **Рабочий ПК:** портативный `pg_ctl`.
- **После `git pull` с миграциями — всегда `migrate`.**

### Django
- Все команды — только через `poetry run python manage.py ...`.
- `CheckConstraint(condition=...)`, не `check=`.
- **`log_audit(old_value=..., new_value=...)` — оба параметра обязательны** (`c-6a-pre`, 1.70). Сигнатура `(user, action, entity_type, entity_id, old_value=None, new_value=None)`.
- **`UserProfile.__str__`** — fallback `"без роли"` при `role=None`.
- **`AccessToken.token_hash`** — `secrets.token_urlsafe(32)` (43 символа, не 64 hex).
- **`make_access_token_qr_svg(purpose, raw, expires_at, user)`** — 4 аргумента, payload base64-JSON.
- `ProtectedError` → 409 (есть `?force=true`).
- **stale-тесты** — копятся, если гонять только `apps/<app>/`. Перед закрытием — `pytest -q` целиком.
- **`prefetch_related` с `Prefetch(to_attr=...)`** — `getattr(obj, "<to_attr>", None)`.
- **Django signals не используем** (1.58, 1.70).
- **`apps/storage/services/`, `apps/receiving/parsers/`, `apps/receiving/services/` — пакеты**.

### API
- JWT (`Authorization: Bearer <access>`), `PageNumberPagination`, `PAGE_SIZE=50`.
- **`?updated_since=<ISO 8601>`** — с таймзоной; naive / невалидный → 400 (`c-6b`).
- **`GET /health/`** — вне `/api/v1/`, без авторизации (`c-6a`).
- **Денормализация `ContainerSerializer`** — `container_type_name`, `floor_room_name`, `cell_full_address`, `draft_site_name`, `draft_research_type_name` (`c-6a`).
- **`?work_order=`** — учитывает `linked_order`.

### Домен
- Проба = **навеска**. Не уникальна по номеру.
- Одна тара = один тип исследования.
- **`Container.container_number` — НЕ уникален глобально** (1.61).
- **`Container.STATUS_PENDING_FILLING`** — начальный статус (1.62).
- **`Sample.STATUS_SELECTED`** — защищён от перезаписи (1.66).
- **`fill-samples` обновляет draft-поля из запроса** (1.69).
- **`AuditLog` для Container**: 6 действий, snapshot 6 полей (1.70).
- **`print_batch_status`**: последняя не-CANCELLED партия, 4 значения (1.71).

### Web
- **Vite proxy:** `/api/*` → `http://localhost:8000`.
- **MUI X v9:** `GridRowSelectionModel = { type, ids: Set<GridRowId> }`.
- **MUI 9:** `Grid size={{...}}`, `Stack` — `sx`.
- **MUI icons:** `DeleteOutline` / `AddCircleOutline` **не существуют**.
- **URL справочников:** `/research-types/`, `/sites/`, `/laboratories/` — без префикса.
- **React Query Devtools не ставим** (ТД-36).
- **`parseSampleInput`:** префикс — точно в `Laboratory.prefixes` + `Site.match_patterns`.

### Mobile
- **URL API:** `config.dart` — `AppConfig.resolve()`: `--dart-define=API_HOST` → probe → fallback `192.168.0.77`.
- **`export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`** — в каждом новом окне Git Bash.
- **`adb reverse` сбрасывается** при reconnect USB / перезагрузке. Повторять вручную.
- **`mobile_scanner 7.4.2`**: `BarcodeCapture.rotation` **не существует**; `capture.size` не swap при повороте, `corners` — swap. Фикс в `mapImageToWidgetFrame`.
- **`Barcode.scaleCorners`** не учитывает landscape — не используем.
- **`hide Container`** — только в файлах с моделью `Container` (`container_detail_screen.dart`, `fill_container_content.dart`). В `home_screen.dart` — без `hide` (нужен Flutter-виджет `Container`).
- **`Container(...)`** в файле с `hide Container` — резолвится в **модель** (28 required параметров). Для Flutter-виджета использовать `Material` / `DecoratedBox` / `Padding`.
- **`context.read<...>` после `await`** → `use_build_context_synchronously`. Сервис брать **до** первого `await`.
- **`context.read<...>`** — нужен `import 'package:provider/provider.dart';`.
- **Перед `git add` — `git status --short | grep "mobile/lib"`** и включить все `M` + `??` из `mobile/lib/*` (правило из 1.90, после `c-7b-fix` и `c-7h-fix-2`).
- **Перед выдачей кода нового захода — `git status --short | grep "mobile/lib"` должно быть пусто** (правило 1.91).
- **`mobile/android/*`** (gradle.properties, wrapper, settings) — машинные, **не коммитить** (правило 15).
- **`tools/`** — машинное, не коммитить.
- **`flutter pub get`** после `pubspec.yaml`.
- **`mobile_scanner: ^7.4.2`** — минимум.
- **`shared_preferences`** — `scan_history_entries` (JSON) + миграция со старого `scan_history_ids`. Ключ `device_id`.
- **`flutter_secure_storage`** — JWT + `cached_user_json` + `pending_offline_*`.

### Рабочий ПК (прокси)
- **После `git reset --hard`**: `setup.ps1` → `export FLUTTER_STORAGE_BASE_URL=...` → `flutter run --android-skip-build-dependency-validation`.
- **`aapt2FromMavenOverride`**, **`kotlin.incremental=false`**, **`kotlin.compiler.execution.strategy=in-process`**, **`org.gradle.parallel=false`**, **`org.gradle.workers.max=2`** в `mobile/android/gradle.properties`.
- **NDK `source.properties`** — `setup.ps1` пишет с BOM; CMake не парсит. Фикс: `printf` без BOM.
- **Не делать `git add .`** — правило 15.

### Инструменты
- Git — только терминал.
- **`cd` — первой строкой блока** (иначе двойной `cd`).
- **`cat >> file`** без `\n` в конце — склеивает строки. Проверять `tail`.
- **`pkill`** — нет в Git Bash, только `taskkill //F //IM <name>`.

---

## Не трогать

- `RULES.md`, `TEMPLATES.md`.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).
- Ветка `fix/2.x-web-v2-bundle-7` (WIP).
- `work-pc-setup/`, `wms-bundle/`, `D:\Dev\maven-local`, `D:\Dev\android-sdk\ndk\28.2.13676358` — машинные настройки.

---

## Правила текущей сессии

- Кодовая фаза.
- Каждый заход — 1–3 файла (пачки-исключения для boilerplate).
- Файлы — единым блоком.
- Все Django-команды — через `poetry run`.
- Все web-команды — `cd web && npm ...`.
- Все mobile-команды — `cd mobile && flutter ...`.
- Docs — отдельной пачкой.
- **Перед `git add` — `git status --short | grep "mobile/lib"`** (правило 1.90).
- **Перед выдачей кода нового захода — `git status --short | grep "mobile/lib"` должно быть пусто** (правило 1.91).

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`

Остальное — по запросу.