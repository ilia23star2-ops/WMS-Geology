## Серия `feature/3.x-migration` (OCR)

**Дата:** 2026-11-13 — 🟡 активна (переоткрыта).
**Ветка:** `feature/3.x-migration`.
**Контекст:** Миграция старых этикеток. Отказ от Tesseract в пользу ML Kit.

### Что закрыто
- ✅ **`c-3.x-migration-3`** (2026-11-13) — серверный OCR: модели `OcrBatch`/`OcrTask`, `POST /api/v1/ocr/recognize/`, `ocr_runner.py` (EasyOCR на портативном Python 3.12), `scripts/ocr_warmup.py` (warmup с монитором), `scripts/ocr_smoke.sh` (сквозной smoke с JWT + DB-verify), 14 unit-тестов (`test_bbox.py`, `test_ocr_recognize_view.py`). Fix: `safe_bbox` вынесен в `services/bbox.py` — numpy-типы в bbox не сериализовались в JSON.
- ✅ **`c-3.x-migration-5b`** (2026-11-13) — Web OCR review: `OcrReviewPage.tsx` (двухпанельный layout: `<img>` + bbox-overlay + форма), `api/ocr.ts` (`useOcrTask`, `useApproveOcrTask`, `resolveImageUrl`), `utils/parseSampleGroups.ts` (`prefix | middle | from-to` → `SampleGroup[]`), 6 unit-тестов (`parseSampleGroups.test.ts`), `vite.config.ts` proxy `/media`. Device-check пройден (4 стадии: media→стр→approve→verify). Container #215 создан, 3 пробы `PENDING_PLACEMENT`, `OcrTask.DONE`, `OcrBatch.COMPLETED`. Web: 24 → 30 тестов.
- ✅ **`c-3.x-migration-5a`** (2026-11-13) — approve-API: `POST /api/v1/ocr/tasks/{id}/approve/`, сервис `apps/ocr/services/approve.py` (композиция `fill_container_with_samples` + `bulk_place_containers` + `log_audit`), сериализатор `OcrApproveSerializer` (наследник `FillSamplesSerializer` + `container_type_id` + `cell_id`), 4 эндпоинта (batches list/create, batch detail, task detail, task approve), 8 unit-тестов (`test_approve_view.py`). 23 passed total.
- ✅ **`c-3.x-migration-1`** — Экран OCR переведен с Tesseract на ML Kit (`MlKitOcrService`). Удален нерабочий плагин `tesseract_ocr`.
- ✅ **`c-3.x-migration-2`** — Добавлены кнопки «Сделать фото» и «Из галереи» на экран OCR. Добавлена адаптивная верстка.

---

## Серия `feature/2.x-sorting`

**Дата:** 2026-11-11 — закрыта.
**Ветка:** `feature/2.x-sorting` (влита в `main`, архив).
**Контекст:** Помощник по сортировке. Рекомендации ячеек для тар с учетом Н/З, ТИ и Участка.

### Что закрыто
- ✅ **`c-2.x-sorting-1`** (2026-11-11) — backend: сервис `suggest_placement`, эндпоинт `suggest-placement`.
- ✅ **`c-2.x-sorting-2`** (2026-11-11) — web: диалог рекомендаций, группировка, динамическая заполненность, кнопка «Разместить все».

### Метрики
- **Backend: 904 теста.**
- **Web: 24 юнит-теста.**

---

# PROGRESS.md — история закрытых заходов

## Серия `feature/2.x-pool`
**Дата:** 2026-11-10 — закрыта.
**Ветка:** `feature/2.x-pool` (влита в `main`, архив).
**Контекст:** Пул (Корзина) для тар и проб. Хранение в БД, UI (страница + панель).

### Что закрыто
- ✅ **`c-2.x-pool-1`** (2026-11-10) — backend: модели `Pool`, `PoolItem`, CRUD API.
- ✅ **`c-2.x-pool-2`** (2026-11-10) — web: `PoolPage`, фильтры, плашки «В пуле», блокировка чекбоксов.

### Метрики
- **Backend: 901 тест.**
- **Web: 24 юнит-теста.**

---


## Серия `feature/2.x-rbac`

**Дата:** 2026-11-10 — активна.
**Ветка:** `main`.
**Контекст:** Роли и права (RBAC). Защита API и UI в соответствии с бизнес-логикой.

### Что закрыто

- ✅ **`c-2.x-rbac-1`** (2026-11-10) — backend + web: `permissions.py`, фильтрация QuerySet по лаборатории для `lab_worker`, ограничение создания/удаления для `worker`, скрытие кнопок и настройка `Sidebar` на фронтенде. Тесты: backend 385 passed, web 24 passed.

### Метрики

- **Backend: 385 тестов** (в рамках измененных приложений).
- **Web: 24 юнит-теста.**

---



> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---


## Серия `feature/3.x-offline`

**Дата:** 2026-10-28 — активна.
**Ветка:** `fix/2.x-mobile-bundle-c-2` (долгоживущий offline-бранч).
**Контекст:** Офлайн-режим мобильного приложения. SQLite + SyncQueue + Deferred Offline Login + USB + auto-detect + scanWindow + инкрементальный Pull. Backend на старте серии — 779 тестов.

### Что закрыто (backend)
- ✅ **`c-2.x-smart-input-bundle-2`** (2026-11-06) — подсказки в «Диапазон проб»: база (`TST1209`) вместо полного номера, `appendOnSelect=-` (клик → `TST1209-`), исключение полностью использованных баз из списка.

- ✅ **`c-2.x-smart-input-bundle-1`** (2026-11-06) — контекстные подсказки для создания тары и заполнения пробами. `SmartInputSuggestionsView` (эндпоинт `GET /storage/suggestions/`), MUI `Autocomplete` + `SmartAutocomplete`, фильтрация Н/З по участку и ТИ. 3 backend-теста.


- ✅ **`c-6a-pre`** (2026-10-30) — починка pre-existing.
- ✅ **`c-6a`** (2026-10-30) — `GET /health/` + денормализация `ContainerSerializer` + `select_related`.
- ✅ **`c-6b`** (2026-10-30) — `?updated_since=<ISO 8601>`.

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
- ✅ **`c-6g-tap-ping`** (2026-11-02) — тап на иконке → `pingNow()`.
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
- ✅ **`c-7c`** — Разместить / Местоположение.
- ✅ **`c-7-offline-catalog`**, **`c-7e-1`**, **`c-7e-2`**, **`c-7e-3`** — офлайн-справочники + история.

### Что закрыто (mobile, Drawer, реестр, офлайн-пробы, `c-9`)

- ✅ **`c-9-drawer`**, **`c-9-container-list`**, **`c-9-container-list-order`**, **`c-9-overflow-fix`**, **`c-9-overflow-fix-2`**, **`c-9-container-create`**, **`c-9-container-list-actions`** (2026-11-02).
- ✅ **`c-9-fill-offline-2a`**, **`2a-fix`**, **`2b`**, **`2c-1`**, **`2c-2`**, **`2c-3`**, **`2c-3-fix-1/2/3a/3b`**, **`2c-4`** — офлайн-редактирование проб.
- ✅ **`c-9-auto-sync`**, **`c-9-natural-sort`**, **`c-6b-updated-since-pull`** (2026-11-02).

### Что закрыто (mobile, офлайн-создание тары и справочников)

- ✅ **`c-8-catalog-create-offline`** (2026-11-06) — офлайн-создание справочников через `sync_queue`. `SyncPusher` маппит ID (local → server) после POST, а также обновляет `payload` и `endpoint` зависимых операций (например, создание тары). Исправлен баг `ContainerDao.saveAll`, который затирал локальные изменения (`pending_sync`) при Pull.


- ✅ **`c-8-catalog-create`** (2026-11-03) — офлайн-создание справочников.
- ✅ **`c-2d-2a`** (2026-11-03) — SQLite v8, маппинг negative→server после `bulk-create`, офлайн-создание тары.
- ✅ **`c-2d-2a-fix-3`** (2026-11-03) — `Container.fromJson` fallback на `*_id`, серверный формат JSON, история для negative-ID.

### Что закрыто (mobile, офлайн-операции на офлайн-тарах)

- ✅ **`c-2d-2c`** (2026-11-05) — офлайн-`fill-samples` / `bulk-place` на офлайн-тарах: `localRef`, `remapEndpoint`, `SyncPusher.pushAll` + `processedIds`.
- ✅ **`c-2d-2c-fix-1`** (2026-11-05) — при офлайн-`bulkPlace` локально обновлять `containers` (`updateLocationLocal`, `ACTIVE`, адрес).
- ✅ **`c-2d-2c-fix-2`** (2026-11-05) — `NamedCatalog.fullAddress`, полный путь `В4/1/1/B/2`.

### Что закрыто (mobile, офлайн-редактирование шапки тары)

- ✅ **`c-8b-status`** (2026-11-06) — ручная смена статуса тары: `status` dropdown в `ContainerEditForm` (5 значений), `containerStatusToApi`, отправка через `update` (офлайн -> `sync_queue`). Тесты: 227 passed.

### Что закрыто (mobile, офлайн-редактирование шапки тары)

- ✅ **`c-8b`** (2026-11-05) — `ContainerService.update` офлайн → `sync_queue` PATCH + `updateFieldsLocal` + `pending_sync`; `UpdateOutcome {online, queued}`; `SyncPusher` PATCH `/storage/containers/{id}/` → `clearPendingSync`; `_onSaveEdit` при `queued` перечитывает кэш + SnackBar.
- ✅ **`c-8b-fix-1`** (2026-11-05) — UI: `useSafeArea`, sticky «Сохранить» вне `ListView`.
- ✅ **`c-8b-fix-2`** (2026-11-05) — `update` ловит **все не-4xx** (сеть/таймаут/5xx/unknown) → `sync_queue` (фикс «Не удалось сохранить: требуется подключение»); payload с `*_name` (`container_type_name` / `draft_site_name` / `draft_research_type_name`) — `Container.fromJson` видит новые имена после офлайн-сохранения; убрано «(черновик)» из лейблов шапки и формы.
- ✅ **`c-8b-fix-3`** (2026-11-05) — ТД-66: `ContainerEditForm` больше не блокирует сохранение при `_catalogsError != null` (5xx/DB-ошибки загрузки справочников). Dropdown'ы `container_type` / `draft_site` / `draft_research_type` — `disabled` + баннер «Справочники не загружены. Повторить», в payload не идут. Текстовые поля (`container_number`, `comment`, `position_on_pallet`, `draft_work_order_*`) — редактируются и сохраняются всегда. Бонус: `safeValue` для `draft_site` / `draft_research_type` — защита от `DropdownButton` assertion, если текущий ID не в справочнике. Репро вручную не воспроизведено (сетевые ошибки ловит `CatalogService` без исключения) — защитная правка.
- ✅ **`c-8b-fix-4`** (2026-11-05) — окно редактирования шапки тары приподнято: высота `(screen − viewInsets.bottom) × 0.95` вместо `0.9 × (screen − safeBottom)`. Убран `Padding(bottom: insets) + SizedBox(0.95 * screen)` — при открытой клавиатуре давал overflow. Синтаксис `_openEditSheet` починен (незакрытая скобка). `c-9-overflow-fix-4` снят с плана — overflow 3.5 / 7.2 px не воспроизводится.
### Что закрыто (web, комментарий тары)

- ✅ **`c-2f-comment-web`** (2026-11-05) — `ContainerDetailDialog.tsx`: в шапке `Комментарий` + `Шаблон`; `ContainersPage.tsx`: колонка «Комментарий» — `comment` с fallback на `comment_template_text`.

### Инфраструктура (рабочий ПК, прокси)

- **`setup.ps1` обязателен после `git reset --hard`**.
- **`checkRevocation=false`** + **`aapt2FromMavenOverride`** + **`kotlin.incremental=false`** + **`kotlin.compiler.execution.strategy=in-process`** + **`org.gradle.parallel=false`** + **`org.gradle.workers.max=2`**.
- **`android.aapt2FromMavenOverride=D:/Dev/android-sdk/build-tools/36.0.0/aapt2.exe`** — в `mobile/android/gradle.properties` + `~/.gradle/gradle.properties`.
- **NDK `source.properties`** — `setup.ps1` без BOM.
- **`flutter run --android-skip-build-dependency-validation`** — обязателен.
- **`export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`** — в каждом окне Git Bash.

### Что осталось

- ⬜ **`c-8-catalog-create-offline`** — офлайн-создание справочников через `sync_queue` (`CatalogService.create` пока только онлайн). **Следующий.**
- ⬜ **`c-9-overflow-fix-4`** — 2 overflow (3.5 px, 7.2 px), `ТД-61`.
- ⏸ **`c-5`** — sneakernet через флешку (отложено).
- ✅ **`c-8a`**, **`c-8c`**, **`c-8d`**, **`c-8e`** — сняты с плана после аудита 2026-11-05.

- ✅ **`c-2.x-shipments-2`** (2026-11-06) — детали рейса OUTBOUND: тары в рейсе (`ShipmentContainerItem`), «Добавить тары» (`AddContainersToShipmentDialog`), «Убрать», «Собрать рейс», «Отправить». При `send` тары → `IN_TRANSIT`, пробы синхронизируются.
- ✅ **`c-2.x-shipments-2-fix`** (2026-11-06) — `origin_laboratory` (FK → Laboratory) для «Откуда», миграция `0005`. UI: «Откуда»/«Куда» в форме, «Участок» скрыт для OUTBOUND, автообновление (staleTime 0 + invalidate вместо setQueryData).
- ✅ **`c-2.x-shipments-2-fix-2`** (2026-11-06) — `Autocomplete` с `freeSolo` для «Откуда»/«Куда» (`inputValue`/`onInputChange`), автосоздание организации в справочнике `Laboratory` при создании рейса. `AddContainersToShipmentDialog` включает `PENDING_PLACEMENT` (не только `ACTIVE`). Колонка «Откуда» в списке рейсов.

### Метрики

- **Backend: 842 теста** (без изменений).
- **Web: 24 юнит-теста** (без изменений).
- **Mobile: 218 юнит-тестов** (было 32 в `2.x-mobile`; +186 за `3.x-offline`).

---


## Серия `feature/2.x-shipments`

**Дата:** 2026-11-06 — активна.
**Ветка:** `feature/2.x-shipments`.
**Контекст:** Рейсы (OUTBOUND «Отправка»). Раздельная UI для OUTBOUND и INBOUND. Модель `ShipmentContainerItem` (тары в рейсе, не пробы).

### Что закрыто

- ✅ **`c-2.x-shipments-1`** (2026-11-06) — модель `ShipmentContainerItem`, `Shipment.name`, `sent_at` переделан с `auto_now_add` на `null=True` (баг: ставился при создании). Endpoints `add-containers` / `remove-container` / `send`. Тесты: 855 passed (+13 в picking).
- ✅ **`c-2.x-shipments-1a`** (2026-11-06) — автогенерация `shipment_number` (ОТ-YYYY-NNN для OUTBOUND, ПР-YYYY-NNN для INBOUND). Поле `shipment_number` в сериализаторе теперь `required=False`. Тесты: 858 passed (+3).
- ✅ **`c-2.x-shipments-1b`** (2026-11-06) — страница «Отправка» (`ShipmentsPage` + `CreateShipmentDialog`), роут `/shipments`, пункт в sidebar. UI: создание рейса с автогенерацией, редирект на детали. Тесты: 24 passed web.


### Метрики

- **Backend: 858 тестов.**
- **Web: 24 юнит-теста.**

---



## Серия `feature/2.x-lifecycle`

**Дата:** 2026-11-09 — активна.
**Ветка:** `feature/2.x-lifecycle`.
**Контекст:** Реализация решений 1.109-1.121 (статусы тары/пробы, is_disposable, утилизация, parent_*, шифрование).

### Что закрыто

- ✅ **`c-2.x-lifecycle-1`** (2026-11-09) — решение 1.109: `ContainerType.is_disposable` (миграция storage/0011), `Container.STATUS_DISPOSED`, `_handle_container_after_dispose` / `_handle_container_after_restore` в `services.py`. Логика: при утилизации последней пробы одноразовая тара → `DISPOSED`, многоразовая → `PENDING_FILLING`. При restore: место есть → `ACTIVE`, нет → `PENDING_PLACEMENT`. UI: 4-я вкладка «Типы тары» в «Справочниках», `ContainerTypeDialog`, чекбокс «Показать утилизированные» в реестре тары, иконка `Recycling` для `DISPOSED`.
- ✅ **`c-2.x-lifecycle-3a`** (2026-11-09) — backend: `Container.parent_container_id` (FK → self), `Sample.parent_sample_id` (FK → self). Миграции `storage/0012` + `samples/0008`. Сериализаторы: `parent_container*` / `parent_sample*` (read-only, денормализация). Фикс: `ContainerTypeSerializer` теперь возвращает `is_disposable` (пропущено в `c-2.x-lifecycle-1-ui`). Тесты: 874 passed (+8 `test_parent`).
- ✅ **`c-2.x-lifecycle-3b`** (2026-11-09) — web: `parent_container` / `parent_container_number` / `parent_sample` / `parent_sample_number` в интерфейсах `Container` / `Sample`.

- ✅ **`c-2.x-lifecycle-2a`** (2026-11-09) — backend: убран `Sample.STATUS_CONSUMED`, data-migration `CONSUMED → DISPOSED`. Обновлены `_PROTECTED_SAMPLE_STATUSES`, `inventory/offline_import`, тесты. Миграция `samples/0007`.
- ✅ **`c-2.x-lifecycle-2b`** (2026-11-09) — web: убран `CONSUMED` из `SampleStatus`, `SAMPLE_STATUS_LABELS`, `STATUS_COLORS` (`FillContainerContent`, `SamplesTreeTable`), `ActualizationPage`.
- ✅ **`c-2.x-lifecycle-2c`** (2026-11-09) — mobile: убран `SampleStatus.consumed`, `_parseStatus` мапит `CONSUMED → disposed` (старый кэш). `flutter analyze` OK, 227 тестов.


### Метрики

- **Backend: 867 тестов.**
- **Web: 24 юнит-теста.**

---



## Серия `feature/2.x-web-v2`

**Дата:** 2026-10-12 — 2026-10-27.
**Ветка:** `feature/2.x-web-v2` (влита в `main`, архив).
**Контекст:** Web: приёмка, ручной ввод тары, полный CRUD, полировка. Backend на старте — 552 теста.

### Что закрыто (backend)


- ✅ **`bundle-1`**, **`bundle-2`**, **`bundle-5`**, **`bundle-6a`**, **`bundle-6b`**, **`bundle-7a-1`**, **`bundle-7a-2`**, **`bundle-7a-2b`**.
- ✅ **`receiving-1a`..`receiving-3d-3-fix-2`** — парсер Excel, `apply_shipment_import`, `conflicts`, `resolve-conflicts`, `check`, `complete`, `act`, `import-shipment`.
- ✅ **`3f-1` / `3f-1b`** — PDF «Акт приёмки».
- ✅ **`2f-1`** — фильтры draft, 409 + `?force=true`.
- ✅ **`2f-2b`** — dispose/restore.
- ✅ **`2f-4c-1`** — QR топологии.
- ✅ **`2f-5a-1`** — каскадное удаление `ReceiptItem`.
- ✅ **`2f-5c-1`** — `PENDING_FILLING`.
- ✅ **`2f-10`** — `bulk-place`.
- ✅ **`2f-11c`** — `cell_id`/`pallet_id`.
- ✅ **`2f-12a`** — `create-in-cell`.
- ✅ **`2f-8` / `2f-8-fix` / `2f-8-fix-2`** — WorkOrder + stale-тесты.
- ✅ **`2f-14a`** — аудит.
- ✅ **`2f-17b`** — `print_batch_status`.

### Что закрыто (web)

- ✅ **`bundle-7a-3`..`bundle-7a-4c-2c`**, **`receiving-3d-1`..`3d-3`**, **`3f-2`**, **`2f-1`..`2f-17c`**, **`3.x-offline-auth`** (полный список — в предыдущих версиях, все закрыты).


### Метрики

- Заходов закрыто: 75.
- Backend: 779 тестов.
- Web: 24 юнит-теста.
- Mobile: 32 → 43 (на старте `3.x-offline`).

---


## Серия `feature/2.x-mobile`

**Дата:** 2026-10-10 — 2026-10-12.
**Ветка:** `feature/2.x-mobile` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1a`..`5`** — Flutter init, API, auth, сканер, список проб.
- ✅ **`docs/2.x-mobile-update`**.


### Метрики

- Заходов: 8.
- Итог: 32 юнит-теста.

---


## Серия `feature/2.x-web`

**Дата:** 2026-10-10.
**Ветка:** `feature/2.x-web` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1a`..`9`** — инициализация, ESLint, MUI, `axios`, `authStore`, `ProtectedRoute`, sidebar, 4 карточки, DataGrid тары/проб, партии печати, bulk, справочники.


### Метрики

- Заходов: 10.
- Backend: 552 теста.
- Web: 6 юнит-тестов.

---


## Серия `feature/2.1-label-generator`

**Дата:** 2026-10-09 — 2026-10-10.
**Ветка:** `feature/2.1-label-generator` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1`..`4d-4`** — QR-сервис, PDF-этикетка, `label.pdf/`, `PrintBatch`, раскладка A4, QR-сетка 8×11, API печати партии.


### Метрики

- Заходов: 7.
- Итог: 552 теста (было 433).

---


## Серия `feature/2.0-excel-parser`

**Дата:** 2026-10-09.
**Ветка:** `feature/2.0-excel-parser` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1`..`3`** — парсер `.xlsx`, сервис импорта, `POST /receiving/import-sessions/upload/`.


### Метрики

- Заходов: 3.
- Итог: 433 теста (было 400).

---


## Серия `feature/1.3-backend-v2`

**Дата:** 2026-10-08 — 2026-10-09.
**Ветка:** `feature/1.3-backend-v2` (влита в `main`, архив).

### Что закрыто

- ✅ **`bundle-1`..`8b`** — справочники, seeds, Sample FK, Container comment/draft, WorkOrder site FK, модели + API приёмки, Shipment, ContainerType laboratory.


### Метрики

- Заходов: 13.
- Итог: 400 тестов (было 268).

---


## Серия `feature/1.2-mobile-init`

**Дата:** 2026-10-08.
**Ветка:** `feature/1.2-mobile-init` (влита в `2.x-mobile`).

### Что закрыто

- ✅ **`bundle-1`..`2`** — Flutter init, API-клиент с JWT.


### Метрики

- Заходов: 3.
- Итог: 12 тестов mobile.

---


## Серия `feature/1.1-backend-api`

**Дата:** 2026-10-07 — 2026-10-08.
**Ветка:** влита в `main`, архив.

### Что закрыто

- ✅ **`bundle-1`..`9`** — сериализаторы, ViewSets, JWT, OpenAPI.


### Метрики

- Заходов: 9.
- Итог: 268 тестов (было 128).

---


## Серия `feature/1.0a-topology-v2`

**Дата:** 2026-10-07.
**Ветка:** влита в `main`, архив.

### Что закрыто

- ✅ **`bundle-1`..`3`** — storage v2, samples (soft-delete) + inventory, picking + movements.


### Метрики

- Заходов: 3 код + 4 docs.
- Итог: 128 тестов (было 78).

---


## Серия `feature/1.0-backend-init`

**Дата:** 2026-10-07.
**Ветка:** влита в `main`, архив.

### Что закрыто

- ✅ **`bundle-1`..`10`** — Poetry init, Django skeleton, 6 приложений, модели, seeds.


### Метрики

- Заходов: 11.
- Итог: 78 тестов.

---


## Серия `feature/0.2-prep-code`

**Дата:** 2026-10-07.
**Ветка:** docs → `main` (commit `0a72c9f`).

### Что закрыто

- ✅ Структура папок, `.env.example`, CI, `TEMPLATES-PROJECT.md`.


### Метрики

- Заходов: 3.

---


## Серия `feature/0.1-foundation`

**Дата:** 2026-10-07.
**Ветка:** docs → `main` (commit `2e7ea42`).

### Что закрыто

- ✅ Стартовые доки (README, LICENSE, .gitignore, PROJECT, CONTEXT, DECISIONS), DATABASE, API, SCENARIOS, TESTING.


### Метрики

- Заходов: 1.
- ✅ **c-8-catalog-create-offline** (2026-11-06) — офлайн-создание справочников через sync_queue. SyncPusher маппит ID (local -> server) после POST, обновляет payload и endpoint зависимых операций. Исправлен баг ContainerDao.saveAll, затиравший локальные изменения при Pull.

