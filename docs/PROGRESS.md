# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/3.x-offline`

**Дата:** 2026-10-28 — активна.
**Ветка:** `fix/2.x-mobile-bundle-c-2` (долгоживущий offline-бранч).
**Контекст:** Офлайн-режим мобильного приложения. SQLite + SyncQueue + Deferred Offline Login + USB + auto-detect + scanWindow + инкрементальный Pull. Backend на старте серии — 779 тестов.

### Что закрыто (backend)

- ✅ **`c-6a-pre`** (2026-10-30) — починка pre-existing регрессов:
  - `log_audit(old_value=..., new_value=...)` — восстановлен параметр `old_value` (регресс, `DECISIONS 1.70`), передаётся в `AuditLog`.
  - `UserProfile.__str__` — fallback `"без роли"` при `role=None`.
  - `test_access_tokens.py` — 3 stale-теста: `len(raw_token) == 43` (было `== 64` после `token_urlsafe(32)`), `make_access_token_qr_svg(4 args)` (base64-JSON из `c-4.5`).
- ✅ **`c-6a`** (2026-10-30) — `GET /health/` (200 без авторизации, `{status, service, time}`) + денормализация `ContainerSerializer` (`container_type_name`, `floor_room_name`, `cell_full_address`) + `select_related("pallet__cell", ...)` в `ContainerViewSet.get_queryset` (без N+1).
  - `wms_geology/health.py` — новый.
  - `apps/storage/tests/test_serializers_denormalization.py` — 5 тестов.
  - `tests/test_health.py` — 2 теста.
- ✅ **`c-6b`** (2026-10-30) — `?updated_since=<ISO 8601>` на `/storage/containers/` и `/samples/`.
  - `apps/storage/filters.py::apply_updated_since` — DRY-хелпер.
  - ISO с таймзоной; naive / невалидный → 400.
  - Тесты: `test_updated_since.py` × 2 (4 storage + 3 samples).

### Что закрыто (mobile, сеть и сканер)

- ✅ **`c-1`** — SQLite: `containers`, `samples`, DAO, инициализация.
- ✅ **`c-2`** (2026-10-29) — `SyncService` (Pull), 50/стр, DI для тестов. 4 теста.
- ✅ **`c-3`** (2026-10-29) — `SyncQueue` (SQLite) + `SyncQueueDao` + `SyncPusher`. 3 теста.
- ✅ **`c-4`** (2026-10-29) — `SyncProvider` + `SyncScreen` + кнопка. 7 тестов.
- ✅ **`c-4.5`** (2026-10-30) — Deferred Offline Login + `DeviceIdService` + `ScanHistoryService` + `ApiException.isNetworkError`.
- ✅ **`c-4.6`** (2026-10-30) — USB-режим (`adb reverse`, `--dart-define=API_HOST=127.0.0.1`, SQLite v4).
- ✅ **`c-6c`** (2026-10-30) — auto-detect сети (`NetworkProbe`, `AppConfig.resolve`).
- ✅ **`c-6d-fix`** (2026-11-02) — scanWindow 220×220 (`_pickBarcodeInScanWindow`, `DetectionSpeed.normal`).
- ✅ **`c-6d-fix-3`** (2026-11-02) — landscape-фикс (`mapImageToWidgetFrame` swap).
- ✅ **`c-6g`** (2026-11-02) — `NetworkStatusProvider` (heartbeat 10 с) + `NetworkBadge`.
- ✅ **`c-6h`** (2026-11-02) — синхронизация запрещена при `!isOnline` / `pendingOffline`.
- ✅ **`c-6g-login`** (2026-11-02) — иконка `NetworkBadge` на `LoginScreen`.
- ⚠️ **`c-6f`** — откачен (`NetworkMonitor` конфликтовал с lifecycle).

### Что закрыто (mobile, карточка тары)

- ✅ **`c-7a`** (2026-11-02) — карточка тары: шапка + 3 вкладки + адаптив.
- ✅ **`c-7b`** + **`c-7b-fix`** (2026-11-02) — `ContainerEditForm` в bottom sheet + `CatalogService`.
- ✅ **`c-7f`** + **`c-7f-fix`** (2026-11-02) — `FillContainerContent` (диапазоны, skip/selected, удаление).
- ✅ **`c-7g`** (2026-11-02) — вкладка «Пробы» (поиск, чекбоксы, bulk, чипы, `SampleEditDialog`).
- ✅ **`c-7h`** + **`c-7h-fix`** + **`c-7h-fix-2`** (2026-11-02) — история сканов `Н/З · ТИ · номер`.

### Что закрыто (mobile, PDF-серия)

- ✅ **`c-7d`** (2026-11-02) — PDF предпросмотр (online, `ApiClient.download` + `open_filex`).
- ✅ **`c-7f-1`** (2026-11-02) — offline-рендер PDF (ассеты `pdf`, `qr`, `DejaVuSans.ttf`, `LabelData`).
- ✅ **`c-7f-2`** (2026-11-02) — offline-рендер PDF на Dart (`pw.Text`, `pw.BarcodeWidget`, галочка `CustomPaint`, 7 тестов).

### Что закрыто (mobile, размещение, c-7c)

- ✅ **`c-7c`** (2026-11-02) — Разместить / Местоположение:
  - `NamedCatalog {id, label}` — универсальный для каскада.
  - `CatalogService` — 5 методов каскада (`fetchRooms`/`Racks`/`Sections`/`Tiers`/`Cells`).
  - `PlaceContainerDialog` — каскад `Room → Rack → Section → Tier → Cell`, сегменты «В ячейку» / «На пол». Возвращает `PlaceOutcome?`.
  - `ContainerService.bulkPlace` — `POST /storage/containers/bulk-place/`, `PlaceOutcome.online` / `.queued`. При `isNetworkError` → `SyncQueueDao.enqueue`.
  - `ContainerLocationDialog` — показ адреса, статус не меняет.
  - `ContainerDetailScreen._buildActionButtons` — раздельные кнопки как в вебе:
    `[Предпросмотр]` + `[Разместить]` (`canPlace`) / `[Местоположение]` (`hasCell`).
  - `test/services/container_service_test.dart` — 7 тестов (онлайн / офлайн / валидация / `ArgumentError`).
  - **Синхронизация:** `SyncPusher` уже обрабатывает `POST`. `c-8d` закрыт здесь.

### Что закрыто (mobile, офлайн-справочники и история, c-7-offline-catalog + c-7e)

- ✅ **`c-7-offline-catalog`** (2026-11-02) — кэш справочников:
  - SQLite v5: +таблица `catalog` (`kind`, `id`, `parent_id`, `data`). `sync_queue` при миграции не трогается.
  - `CatalogDao`: `saveAll` / `getAll` / `getByParent` + `catalogParentId` (извлечение ID родителя из JSON по нескольким именам полей).
  - `CatalogService`: онлайн → API + save в кэш; `isNetworkError` → `getAll` / `getByParent`. DI для тестов. Все 5 методов каскада + 4 типизированных справочника.
  - `SyncService.pullAll`: +9 эндпоинтов (`sites`, `research-types`, `laboratories`, `storage/container-types`, `storage/rooms`, `storage/racks`, `storage/sections`, `storage/tiers`, `storage/cells`).
  - Тесты: `catalog_service_test.dart` (11: 5 `catalogParentId` + 6 `CatalogService`), `sync_service_test.dart` (+1), `catalog_test.dart` (DI `saveCatalog` в старых).
  - **Device-check:** онлайн Pull без ошибок, офлайн-каскад открывается из кэша, офлайн-форма шапки заполнена.
- ✅ **`c-7e-1`** (2026-11-02) — `SampleService.fetchByContainerId`: при `isNetworkError` возвращает кэш **включая пустой**, не `rethrow`. Пустая тара офлайн — нормальный ответ. DI `saveSamples` / `getCached`. +5 тестов (`sample_service_test.dart`).
- ✅ **`c-7e-2`** (2026-11-02) — кэш истории тары:
  - SQLite v6: +таблица `container_history` (`container_id`, `id`, `created_at`, `data`). `sync_queue` не трогается.
  - `ContainerHistoryDao`: `saveAll` (полная замена для `container_id`), `getByContainerId` (сортировка `created_at DESC, id DESC`).
  - `ContainerService.fetchHistory`: онлайн → API + save в кэш; `isNetworkError` → кэш. DI `saveHistory` / `getCachedHistory`. +4 теста (`container_service_test.dart`).
- ✅ **`c-7e-3`** (2026-11-02) — pre-fetch истории всех тар при Pull:
  - `SyncService.pullAll` после `_pullContainers` проходит по ID тар и вызывает `GET /storage/containers/{id}/history/`. Ошибка по одной таре не валит Pull.
  - `_pullContainers` теперь возвращает `List<int>` (ID тар).
  - `saveHistory` DI в `SyncService`. +1 тест (`sync_service_test.dart`: pre-fetch для всех 3 тар + «ошибка одной тары не валит Pull»).
  - **Device-check:** Pull → офлайн → история **любой** тары доступна, включая неоткрытые онлайн. ТД-59 (batch-эндпоинт) — на будущее, когда тар станет много.

### Инфраструктура (рабочий ПК, прокси)

- **`setup.ps1` обязателен после `git reset --hard`** — восстанавливает сертификаты, `maven-local`, `local.properties`, `~/.gradle/gradle.properties`, aapt2-путь, NDK.
- **`aapt2FromMavenOverride`**, **`kotlin.incremental=false`**, **`kotlin.compiler.execution.strategy=in-process`**, **`org.gradle.parallel=false`**, **`org.gradle.workers.max=2`** в `mobile/android/gradle.properties`.
- **NDK `source.properties`** — `setup.ps1` пишет с BOM, CMake не парсит. Фикс: `printf` без BOM.
- **`flutter run --android-skip-build-dependency-validation`** — флаг обязателен на рабочем ПК.
- **`export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`** — в каждом новом окне Git Bash.

### Что осталось

- ⬜ **`c-8-catalog-create`** — создание справочников с мобилки через `sync_queue`. **Следующий.**
- ⬜ **`c-8a`..`c-8c`** — PATCH статусов тары и пробы через `sync_queue`.
- ⬜ **`c-8e`** — auto-sync USB (Push → Pull, автотриггер).
- ⏸ **`c-5`** — sneakernet через флешку (отложено).
- ✅ **`c-8d`** — размещение тары через `sync_queue` — закрыто в `c-7c`.

### Метрики

- **Backend: 842 теста** (без изменений).
- **Web: 24 юнит-теста** (без изменений).
- **Mobile: 139 юнит-тестов** (было 32 в серии `2.x-mobile`; +107 за `3.x-offline`: sync_service 2, sync_pusher 3, sync_provider 7, network_probe 6, network_status_provider 3, scan_window 10+4, sample_range_parser 13, int_ranges 4, catalog 6, container 5, container_history_entry 2, sample 7, scan_history_entry 5, label_pdf_generator 7, container_service 11, catalog_service 11, sample_service 5, user 4, widget_test 1, api_client, token_storage, parse_qr — исторически).

---

## Серия `feature/2.x-web-v2`

**Дата:** 2026-10-12 — 2026-10-27.
**Ветка:** `feature/2.x-web-v2` (влита в `main`, архив).
**Контекст:** Web: приёмка, ручной ввод тары, полный CRUD, полировка. Backend на старте — 552 теста.

### Что закрыто (backend)

- ✅ **`bundle-1`** — `current_location` в `SampleSerializer`, фильтры `?q=`, `?no_work_order=`.
- ✅ **`bundle-2`** — `GET /samples/grouped/`.
- ✅ **`bundle-5`** — `POST /storage/containers/bulk-create/` (переработан в 7a-1/7a-2).
- ✅ **`bundle-6a`** — фильтр по дате в Excel, `expected_date`.
- ✅ **`bundle-6b`** — `target_date`, `duplicate_action`, 409.
- ✅ **`bundle-7a-1`** — `Sample.STATUS_PENDING_PLACEMENT` + `sync_sample_status_for_container`.
- ✅ **`bundle-7a-2`** — разделение bulk-create на два эндпоинта (1.59).
- ✅ **`bundle-7a-2b`** — Container draft-поля + nullable number (1.60).
- ✅ **`receiving-1a` / `1a-2`** — парсер Excel.
- ✅ **`receiving-1b`** — `apply_shipment_import`.
- ✅ **`receiving-1c`** — `POST /import-sessions/import-shipment/`.
- ✅ **`receiving-3a`** — `multi_date_match` только вопрос.
- ✅ **`receiving-3b-1`** — `conflicts` + `resolve-conflicts`.
- ✅ **`receiving-3b-1-2a`** — `ReceiptItem.container_type`.
- ✅ **`receiving-3b-2`** — `POST /receipts/{id}/check/`.
- ✅ **`receiving-3c`** — `POST /receipts/{id}/complete/`.
- ✅ **`receiving-3d-3-fix-2`** — снять `unique=True` с `container_number`.
- ✅ **`3f-1`** — PDF «Акт приёмки».
- ✅ **`3f-1b`** — stale-тесты `container_number`.
- ✅ **`2f-1`** — фильтры draft, 409 + `?force=true`.
- ✅ **`2f-2b`** — dispose/restore.
- ✅ **`2f-4c-1`** — QR топологии.
- ✅ **`2f-5a-1`** — каскадное удаление `ReceiptItem`.
- ✅ **`2f-5c-1`** — `PENDING_FILLING`.
- ✅ **`2f-10`** — `bulk-place`.
- ✅ **`2f-11c`** — `cell_id`/`pallet_id` в сериализаторах.
- ✅ **`2f-12a`** — `create-in-cell`.
- ✅ **`2f-8` / `2f-8-fix` / `2f-8-fix-2`** — WorkOrder + stale-тесты.
- ✅ **`2f-14a`** — аудит.
- ✅ **`2f-17b`** — `print_batch_status`.

### Что закрыто (web)

- ✅ **`bundle-7a-3`** — форма «Создать тару».
- ✅ **`bundle-7a-4ab`** — `parseSampleInput` + `useFillSamples` (18 тестов).
- ✅ **`bundle-7a-4c-1`** — форма «Заполнить тару».
- ✅ **`bundle-7a-4c-2a`** — `useContainer`, `container_id` в фильтре проб.
- ✅ **`bundle-7a-4c-2b`** — `ContainerPreviewDialog`.
- ✅ **`bundle-7a-4c-2c`** — preview после save.
- ✅ **`receiving-3d-1`** — API-хуки приёмки.
- ✅ **`receiving-3d-2`** — `ReceiptCheckPage`.
- ✅ **`receiving-3d-3`** — интеграция, `/questions` удалён.
- ✅ **`3f-2`** — кнопка «Акт приёмки».
- ✅ **`2f-1`** — реестр тары.
- ✅ **`2f-2a`** — `SamplesGroupedList`.
- ✅ **`2f-2b`** — `SampleEditDialog`.
- ✅ **`2f-2c`** — dev-логирование API.
- ✅ **`2f-3a`** — справочники CRUD.
- ✅ **`2f-4a`** — `/topology`.
- ✅ **`2f-4b`** — `PalletDialog`.
- ✅ **`2f-4c-2`** — QR топологии в UI.
- ✅ **`2f-5a-2`** — `ReceiptItemEditDialog`.
- ✅ **`2f-5b-fix`** — переход при `PARSED + questions_count > 0`.
- ✅ **`2f-5c-2`** — `PENDING_FILLING` в UI.
- ✅ **`2f-5c-3`** — draft-поля в `ContainerEditDialog`.
- ✅ **`2f-7h`** — компактный реестр.
- ✅ **`2f-8a`** — `SamplesTreeTable`.
- ✅ **`2f-9a`** — пропуски и `RangeEditDialog`.
- ✅ **`2f-9b`** — выбранные пробы.
- ✅ **`2f-9c`** — `FillContainerDialog`.
- ✅ **`2f-10`** — `PlaceContainerDialog`.
- ✅ **`2f-11a`** — `CellContentsDialog`.
- ✅ **`2f-11b`** — `ContainerPreviewDialog`.
- ✅ **`2f-11c`** — переходы в Топологию.
- ✅ **`2f-12b`** — `CreateInCellDialog`.
- ✅ **`2f-8`** — `/work-orders`.
- ✅ **`2f-8-fix (tsconfig)`** — убран `baseUrl`.
- ✅ **`2f-15`** — предпросмотр этикетки.
- ✅ **`2f-14b`** — вкладка «История».
- ✅ **`2f-17a`** — `FillContainerDialog` → `FillContainerContent`.
- ✅ **`2f-17c`** — `ContainerDetailDialog`.
- ✅ **`3.x-offline-auth`** — `AccessTokensPage`.

### Метрики

- Заходов закрыто: 75.
- Backend: 779 тестов (к концу серии).
- Web: 24 юнит-теста.
- Mobile: 32 (в `2.x-mobile`) → 43 (на старте `3.x-offline`).

---

## Серия `feature/2.x-mobile`

**Дата:** 2026-10-10 — 2026-10-12
**Ветка:** `feature/2.x-mobile` (влита в `main`, архив).
**Контекст:** Flutter-приложение для Android-планшетов. Flutter 3.47 + Dio 5 + Provider 6 + `flutter_secure_storage` + `mobile_scanner`.

### Что закрыто

- ✅ **`bundle-1a` / `1b`** — Flutter init.
- ✅ **`bundle-2`** — API-клиент Dio + JWT.
- ✅ **`bundle-3a`** — `TokenStorage`, `AuthService`, модель `User`.
- ✅ **`bundle-3b`** — `AuthProvider`, экран логина, `AuthGate`.
- ✅ **`bundle-4a`** — `parseQrPayload`, модель `Container`, `ContainerService`.
- ✅ **`bundle-4b-1`** — камера.
- ✅ **`bundle-4b-2`** — сканер QR, `ContainerDetailScreen`.
- ✅ **`bundle-5`** — список проб, `SampleService`.
- ✅ **`docs/2.x-mobile-update`** — CONTEXT, PLAN, PROGRESS.

### Метрики

- Заходов: 8.
- «Не норм» на первом прогоне: 5.
- **Итог: 32 юнит-теста.**

---

## Серия `feature/2.x-web`

**Дата:** 2026-10-10
**Ветка:** `feature/2.x-web` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1a`..`bundle-9`** — инициализация, ESLint, MUI-тема, `axios` + JWT, `authStore`, `ProtectedRoute`, sidebar/header, 4 карточки, DataGrid тары, DataGrid проб, партии печати, bulk, справочники.

### Метрики

- Заходов: 10.
- «Не норм» на первом прогоне: 4.
- Backend: 552 теста (без изменений).
- Web: 6 юнит-тестов.

---

## Серия `feature/2.1-label-generator`

**Дата:** 2026-10-09 — 2026-10-10
**Ветка:** `feature/2.1-label-generator` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1`** — QR-сервис.
- ✅ **`bundle-2`** — PDF-этикетка (fpdf2, DejaVuSans).
- ✅ **`bundle-3`** — `GET .../label.pdf/`.
- ✅ **`bundle-4a`** — `PrintBatch` + `PrintBatchItem`.
- ✅ **`bundle-4b`** — API партии печати.
- ✅ **`bundle-4d-1`** — раскладка A4.
- ✅ **`bundle-4d-3`** — QR-сетка 8×11.
- ✅ **`bundle-4d-4`** — API печати партии.

### Метрики

- Заходов: 7.
- Итог: 552 теста (было 433).

---

## Серия `feature/2.0-excel-parser`

**Дата:** 2026-10-09
**Ветка:** `feature/2.0-excel-parser` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1`** — парсер `.xlsx`.
- ✅ **`bundle-2`** — сервис импорта.
- ✅ **`bundle-3`** — `POST /receiving/import-sessions/upload/`.

### Метрики

- Заходов: 3.
- Итог: 433 теста (было 400).

---

## Серия `feature/1.3-backend-v2`

**Дата:** 2026-10-08 — 2026-10-09
**Ветка:** `feature/1.3-backend-v2` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1`..`3a`** — справочники.
- ✅ **`bundle-4`** — seeds.
- ✅ **`bundle-5`..`5a`** — Sample FK.
- ✅ **`bundle-6a`** — Container: comment, comment_template, PENDING_PLACEMENT.
- ✅ **`bundle-6b`** — WorkOrder: site FK.
- ✅ **`bundle-7a`..`7b`** — модели + API приёмки.
- ✅ **`bundle-8a`** — Shipment.
- ✅ **`bundle-8b`** — ContainerType: laboratory.

### Метрики

- Заходов: 13.
- Итог: 400 тестов (было 268).

---

## Серия `feature/1.2-mobile-init`

**Дата:** 2026-10-08
**Ветка:** `feature/1.2-mobile-init` (влита в `2.x-mobile`).

### Что закрыто

- ✅ **`bundle-1`** — Flutter init.
- ✅ **`bundle-1b`** — `widget_test`.
- ✅ **`bundle-2`** — API-клиент с JWT.

### Метрики

- Заходов: 3.
- Итог: 12 тестов mobile.

---

## Серия `feature/1.1-backend-api`

**Дата:** 2026-10-07 — 2026-10-08
**Ветка:** влита в `main`, архив.

### Что закрыто

- ✅ **`bundle-1`..`bundle-9`** — сериализаторы, ViewSets, JWT, OpenAPI.

### Метрики

- Заходов: 9.
- Итог: 268 тестов (было 128).

---

## Серия `feature/1.0a-topology-v2`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.

### Что закрыто

- ✅ **`bundle-1`** — storage v2.
- ✅ **`bundle-2`** — samples (soft-delete) + inventory.
- ✅ **`bundle-3`** — picking + movements.

### Метрики

- Заходов: 3 код + 4 docs.
- Итог: 128 тестов (было 78).

---

## Серия `feature/1.0-backend-init`

**Дата:** 2026-10-07
**Ветка:** влита в `main`, архив.

### Что закрыто

- ✅ **`bundle-1`** — Poetry init.
- ✅ **`bundle-2`..`bundle-10`** — Django skeleton, 6 приложений, модели, seeds.

### Метрики

- Заходов: 11.
- Итог: 78 тестов.

---

## Серия `feature/0.2-prep-code`

**Дата:** 2026-10-07
**Ветка:** docs → `main` (commit `0a72c9f`).

### Что закрыто

- ✅ **`Структура папок`**, `.env.example`, CI, `TEMPLATES-PROJECT.md`.

### Метрики

- Заходов: 3.

---

## Серия `feature/0.1-foundation`

**Дата:** 2026-10-07
**Ветка:** docs → `main` (commit `2e7ea42`).

### Что закрыто

- ✅ Стартовые доки (README, LICENSE, .gitignore, PROJECT, CONTEXT, DECISIONS), DATABASE, API, SCENARIOS, TESTING.

### Метрики

- Заходов: 1.