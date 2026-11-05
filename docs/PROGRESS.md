# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/3.x-offline`

**Дата:** 2026-10-28 — активна.
**Ветка:** `fix/2.x-mobile-bundle-c-2` (долгоживущий offline-бранч).
**Контекст:** Офлайн-режим мобильного приложения. SQLite + SyncQueue + Deferred Offline Login + USB + auto-detect + scanWindow + инкрементальный Pull. Backend на старте серии — 779 тестов.

### Что закрыто (backend)

- ✅ **`c-6a-pre`** (2026-10-30) — починка pre-existing: `log_audit(old_value=..., new_value=...)` — восстановлен параметр `old_value`; `UserProfile.__str__` — fallback `"без роли"`; `test_access_tokens.py` — 3 stale-теста.
- ✅ **`c-6a`** (2026-10-30) — `GET /health/` + денормализация `ContainerSerializer` + `select_related`.
- ✅ **`c-6b`** (2026-10-30) — `?updated_since=<ISO 8601>` на `/storage/containers/` и `/samples/`.

### Что закрыто (mobile, сеть и сканер)

- ✅ **`c-1`** — SQLite: `containers`, `samples`, DAO.
- ✅ **`c-2`** — `SyncService` (Pull), 50/стр.
- ✅ **`c-3`** — `SyncQueue` + `SyncPusher`.
- ✅ **`c-4`** — `SyncProvider` + `SyncScreen`.
- ✅ **`c-4.5`** — Deferred Offline Login.
- ✅ **`c-4.6`** — USB-режим.
- ✅ **`c-6c`** — auto-detect сети.
- ✅ **`c-6d-fix`** — scanWindow 220×220.
- ✅ **`c-6d-fix-3`** — landscape-фикс.
- ✅ **`c-6g`** — `NetworkStatusProvider` (heartbeat 10 с) + `NetworkBadge`.
- ✅ **`c-6g-tap-ping`** (2026-11-02) — тап на иконке → `pingNow()`, публичный, спиннер.
- ✅ **`c-6h`** — синхронизация disabled при офлайне.
- ✅ **`c-6g-login`** — иконка на `LoginScreen`.

### Что закрыто (mobile, карточка тары)

- ✅ **`c-7a`** — шапка + 3 вкладки + адаптив.
- ✅ **`c-7b`** + **`c-7b-fix`** — `ContainerEditForm` + `CatalogService`.
- ✅ **`c-7f`** + **`c-7f-fix`** — `FillContainerContent`.
- ✅ **`c-7g`** — вкладка «Пробы».
- ✅ **`c-7h`** + **`c-7h-fix`** + **`c-7h-fix-2`** — история сканов.

### Что закрыто (mobile, PDF, размещение, офлайн-справочники)

- ✅ **`c-7d`**, **`c-7f-1`**, **`c-7f-2`** — PDF online + offline.
- ✅ **`c-7c`** — Разместить / Местоположение (`PlaceContainerDialog` offline через `sync_queue`).
- ✅ **`c-7-offline-catalog`** — SQLite v5, `CatalogDao`, `CatalogService` fallback.
- ✅ **`c-7e-1`**, **`c-7e-2`**, **`c-7e-3`** — офлайн-кэш истории + pre-fetch.

### Что закрыто (mobile, Drawer, реестр, офлайн-пробы, `c-9`)

- ✅ **`c-9-drawer`**, **`c-9-container-list`**, **`c-9-container-list-order`**, **`c-9-overflow-fix`**, **`c-9-overflow-fix-2`**, **`c-9-container-create`**, **`c-9-container-list-actions`** (2026-11-02).
- ✅ **`c-9-fill-offline-2a`**, **`2a-fix`**, **`2b`**, **`2c-1`**, **`2c-2`**, **`2c-3`**, **`2c-3-fix-1/2/3a/3b`**, **`2c-4`** — офлайн-редактирование проб.
- ✅ **`c-9-auto-sync`**, **`c-9-natural-sort`**, **`c-6b-updated-since-pull`** (2026-11-02).

### Что закрыто (mobile, офлайн-создание тары и справочников, `c-8-catalog-create` + `c-2d-2a`)

- ✅ **`c-8-catalog-create`** (2026-11-03) — офлайн-создание справочников: `CatalogCreateDialog`, `CatalogService.create` через `sync_queue`, интеграция в `CreateContainersDialog`.
- ✅ **`c-2d-2a`** (2026-11-03) — SQLite v8 (`local_ref`), маппинг negative→server после `bulk-create` (`remapAllLocalRefs`, `ContainerDao.remapId`, `SampleDao.remapContainerId`), офлайн-создание тары (`BulkCreateResult`).
- ✅ **`c-2d-2a-fix-3`** (2026-11-03) — `Container.fromJson` fallback на `*_id`, серверный формат JSON (`container_type` / `draft_site` / `draft_research_type`), история для negative-ID не зовёт сервер, SnackBar по `BulkCreateResult.queued`.

### Что закрыто (mobile, офлайн-операции на офлайн-тарах, `c-2d-2c`)

- ✅ **`c-2d-2c`** (2026-11-05) — офлайн-`fill-samples` / `bulk-place` на офлайн-тарах: `fillSamples` при `containerId < 0` → сразу очередь (`localRef = containerId`), `bulkPlace` при negatives → очередь атомарно (`localRef = JSON negatives`), `remapEndpoint` (fill-samples URL `/containers/-N/...` → `/containers/M/...`), `SyncPusher.pushAll` перезагружает очередь после `bulk-create` + `processedIds` (защита от зацикливания).
- ✅ **`c-2d-2c-fix-1`** (2026-11-05) — при офлайн-`bulkPlace` локально обновлять `containers` (`ContainerDao.updateLocationLocal`: `status=ACTIVE`, `cell_id`, `cell_full_address`, `floor_room`, `floor_room_name`, `pallet=null`, `updated_at`) → UI сразу видит новое место.
- ✅ **`c-2d-2c-fix-2`** (2026-11-05) — `NamedCatalog.fullAddress` (из `json['full_address']`), `PlaceContainerDialog._selectedCellAddress` → `fullAddress ?? label` (полный путь `В4/1/1/B/2` вместо короткого кода `2`).

### Что закрыто (mobile, офлайн-редактирование шапки тары, `c-8b`)

- ✅ **`c-8b`** (2026-11-05) — офлайн-редактирование шапки тары: `ContainerService.update` при `isNetworkError` → `sync_queue` (PATCH) + `ContainerDao.updateFieldsLocal` + `pending_sync`; `UpdateOutcome {online, queued}`; `SyncPusher._defaultOnSuccess` regex `^/storage/containers/(\d+)/$` → `clearPendingSync`; `_onSaveEdit` при `queued` перечитывает кэш + SnackBar «Сохранено офлайн».
- ✅ **`c-8b-fix-1`** (2026-11-05) — UI: `useSafeArea: true` в bottom sheet, sticky кнопка «Сохранить» вне `ListView` (не уезжает под системный бар Android), высота = экран − клавиатура − safe area.

### Что закрыто (web, комментарий тары, `c-2f-comment-web`)

- ✅ **`c-2f-comment-web`** (2026-11-05) — `ContainerDetailDialog.tsx`: в шапке блок `Комментарий` (свободный `comment`) + `Шаблон` (`comment_template_text`), если заданы; `ContainersPage.tsx`: колонка «Комментарий» — `valueGetter` читает `comment` с fallback на `comment_template_text` (раньше показывала только шаблон, у большинства тар пустой).

### Инфраструктура (рабочий ПК, прокси)

- **`setup.ps1` обязателен после `git reset --hard`**.
- **`checkRevocation=false`** + **`aapt2FromMavenOverride`** + **`kotlin.incremental=false`** + **`kotlin.compiler.execution.strategy=in-process`** + **`org.gradle.parallel=false`** + **`org.gradle.workers.max=2`**.
- **`android.aapt2FromMavenOverride=D:/Dev/android-sdk/build-tools/36.0.0/aapt2.exe`** — в `mobile/android/gradle.properties` + `~/.gradle/gradle.properties` (дубль — чтобы `git checkout` не сбивал).
- **NDK `source.properties`** — `setup.ps1` без BOM.
- **`flutter run --android-skip-build-dependency-validation`** — обязателен.
- **`export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`** — в каждом окне Git Bash.

### Что осталось

- ⬜ **`c-8b-fix-2`** — офлайн-редактирование «требует соединение»: разрешить сохранение полей без справочников. **Следующий.**
- ⬜ **`c-8-catalog-create-offline`** — офлайн-создание справочников через `sync_queue` (`CatalogService.create` сейчас только онлайн).
- ⬜ **`c-9-overflow-fix-4`** — 2 overflow (3.5 px, 7.2 px), `ТД-61`.
- ⏸ **`c-5`** — sneakernet через флешку (отложено).
- ✅ **`c-8a`**, **`c-8c`**, **`c-8d`**, **`c-8e`** — сняты с плана после аудита 2026-11-05 (все эндпоинты уже есть, functional gaps закрыты в `c-7c` / `c-9-fill-offline-2c-3` / `NetworkStatusProvider`).

### Метрики

- **Backend: 842 теста** (без изменений).
- **Web: 24 юнит-теста** (без изменений).
- **Mobile: 218 юнит-тестов** (было 32 в `2.x-mobile`; +186 за `3.x-offline`).

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
- Backend: 779 тестов.
- Web: 24 юнит-теста.
- Mobile: 32 → 43 (на старте `3.x-offline`).

---

## Серия `feature/2.x-mobile`

**Дата:** 2026-10-10 — 2026-10-12
**Ветка:** `feature/2.x-mobile` (влита в `main`, архив).
**Контекст:** Flutter-приложение для Android-планшетов.

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
- Итог: 32 юнит-теста.

---

## Серия `feature/2.x-web`

**Дата:** 2026-10-10
**Ветка:** `feature/2.x-web` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1a`..`bundle-9`** — инициализация, ESLint, MUI, `axios`, `authStore`, `ProtectedRoute`, sidebar, 4 карточки, DataGrid тары/проб, партии печати, bulk, справочники.

### Метрики

- Заходов: 10.
- Backend: 552 теста.
- Web: 6 юнит-тестов.

---

## Серия `feature/2.1-label-generator`

**Дата:** 2026-10-09 — 2026-10-10
**Ветка:** `feature/2.1-label-generator` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1`** — QR-сервис.
- ✅ **`bundle-2`** — PDF-этикетка.
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