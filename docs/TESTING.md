# TESTING.md — что и как тестируется

> Правило: новый код → новые тесты. См. `RULES.md` §12.3.
> Проект в **кодовой фазе**, тесты пишутся и живут в репозитории.

---

## Три уровня тестов

| Уровень | Что проверяет | Скорость | Зависимости |
|---|---|---|---|
| **Unit** | Чистые функции, парсеры, доменные правила | < 500 мс | Нет |
| **Integration** | API-эндпоинты, запросы к БД (тестовая) | < 5 сек | PostgreSQL (тестовая БД) |
| **Contract** | Соответствие API зафиксированному в `API.md` | < 2 сек | Мок-клиент |

**Что НЕ тестируется:** UI, реальная камера, реальный PostgreSQL, внешние API — device-check / моки.

---

## Как запускать

### Backend

    cd backend
    poetry run pytest -q
    poetry run pytest -v
    poetry run pytest apps/<app>/tests/test_<file>.py -v
    poetry run python manage.py check
    poetry run python manage.py makemigrations --check --dry-run

### Web

    cd web
    npm test
    npm run lint

### Mobile

    cd mobile
    flutter test
    flutter analyze

### Автоматически

GitHub Actions: `.github/workflows/ci.yml`.

### Быстрый прогресс и отладка

- **`| tail` буферизует вывод.** Для прогресса — `pytest -q` без пайпа, или `pytest -q 2>&1 | tee /tmp/pytest.log`.
- **Полный прогон — перед закрытием захода** (stale-тесты копятся).

---

## Текущее состояние

**Backend: 842 теста.**
**Web: 24 юнит-теста** (`tokenStorage`, `authStore`, `parseSampleInput`).
**Mobile: 227 юнит-тестов.**

### Backend — покрытие по приложениям

| Приложение | Ключевые тесты |
|---|---|
| `storage` | Модели топологии, `Pallet`, `Container`, bulk-create, fill-samples, `bulk-place`, `create-in-cell`, фильтры `?draft_*`, `DELETE` + 409 + `?force=true`, QR топологии, аудит, `print_batch_status`, `?updated_since=` |
| `samples` | Модели, `dispose`/`restore`, `SELECTED`, `grouped`, фильтры, поиск, seeds, `sync_sample_status_for_container`, `?updated_since=` |
| `receiving` | Парсер Excel, `apply_shipment_import`, `conflicts`, `resolve-conflicts`, `check`, `complete`, `act`, `import-shipment`, каскадное удаление `ReceiptItem` |
| `picking` | Модели + API, фильтр `?work_order=` |
| `labels` | QR-сервис, PDF-этикетки, раскладка, QR-сетка, партии печати, `act_service` |
| `users` | JWT, `UserProfile`, `Role`, `AuditLog`, `log_audit`, `AuditLogSerializer`, seeds |
| `movements`, `inventory`, `work_orders` | Модели + API, `WorkOrder.__str__` |
| `tests/test_openapi.py` | Contract-тесты OpenAPI |

### Web — покрытие

- `src/api/tokenStorage.test.ts` — 3 теста.
- `src/stores/authStore.test.ts` — 3 теста.
- `src/utils/parseSampleInput.test.ts` — 18 тестов.

Компоненты и страницы — только device-check.

### Mobile — покрытие

- Парсер QR (`parseQrPayload`).
- `TokenStorage`, `ApiClient` (Dio, JWT).
- Модели `Container`, `Sample`, `ScanHistoryEntry`, `ContainerHistoryEntry`.
- `SyncService` (Pull, pre-fetch истории, `?updated_since=`, reconcile, `PullStats`).
- `SyncPusher` (PushResult, onSuccess, сброс `_pending_sync`, маппинг `bulk-create`, `processedIds`).
- `SyncProvider` (`PullStats`, `PushResult`, `_lastPullSince`).
- `NetworkProbe`, `NetworkStatusProvider` (включая `pingNow`).
- `scan_window` (портрет + ландшафт).
- `sample_range_parser`, `int_ranges`.
- `catalog` (модели), `container`, `container_history_entry`, `named_catalog`.
- `label_pdf_generator` (offline-рендер PDF на Dart).
- `catalog_service` (кэш справочников, fallback, `catalogParentId`).
- `container_service` (`bulkPlace` online/offline + локальное обновление, `fetchHistory` online/cache, `fetchList`, `bulkCreate` online/offline + `BulkCreateResult`, `update` online/offline + `UpdateOutcome`, `Container.fromJson` fallback).
- `sample_service` (`fetchByContainerId` online/cache + natural sort, `fillSamples` online/offline + negative-ID, `update`/`dispose`/`restore`/`deleteSample` online/offline, `updateLocalOffline`/`deleteLocalOffline` + `_rebuildFillPayload`).
- `natural_sort` (`naturalCompare`, `naturalCompareSampleNumber`).
- `sync_queue_dao` (21: `remapInPlace`, `remapLocalRef`, `remapEndpoint`).
- `container_from_json` (6).
- `sync_pusher` (5: bulk-create + localRef + responseData + reload; PATCH containers — надо проверить актуальную версию).
- `user`, `widget_test`.

UI (экраны, сканер, диалоги) — device-check на планшете.

---

## Unit-тесты (приоритет 1)

### Домен

- `test_sample_number_not_unique`, `test_one_container_one_research_type`, `test_work_order_linked_incoming_coded`, `test_sample_work_orders_many_to_many`.
- `test_container_number_duplicate_allowed` (1.61).
- `test_bulk_create_success`, `test_fill_samples_pending_filling_to_pending_placement` (2f-5c-1).
- `test_fill_samples_updates_draft_fields` (2f-7f + 1.69).
- `test_check_all_matched_creates_containers` (2f-5c-1).
- `test_sync_sample_status_protects_selected` (2f-9b).

### Аудит тары (2f-14a)

- `test_history_*` (8 тестов).

### `print_batch_status` (2f-17b)

- `test_print_batch_status_*` (4 теста).

### Поиск и фильтры

- `test_search_*`, `test_filter_*`.

### QR топологии (2f-4c-1)

- `test_section_qr_*`, `test_cell_qr_*`, `test_qr_batch_*`, `test_qr_grid_capacity_88`.

### Парсеры

- `parse_excel`, `parseSampleInput` (web, 18), `test_parse_qr_payload` (mobile).

### Custom actions

- dispose/restore, delete 409, act PDF, каскад `ReceiptItem`, `bulk_place`, `create_in_cell`, force-delete, `?updated_since=`.

### Mobile, `c-7-offline-catalog`

- `catalog_service_test.dart` (11), `sync_service_test.dart` (+1), `catalog_test.dart` (DI `saveCatalog`).

### Mobile, `c-7e-1` / `c-7e-2` / `c-7e-3`

- `sample_service_test.dart` (5), `container_service_test.dart` (11), `sync_service_test.dart` (2).

### Mobile, `c-9-container-list`

- `container_service_test.dart` (+3 теста на `fetchList`).

### Mobile, `c-9-container-create`

- `container_service_test.dart` (+2 теста на `bulkCreate`).

### Mobile, `c-9-fill-offline-2a`..`2c-4`

- `sample_service_test.dart` (~22 теста: `fillSamples` online/offline, `updateLocalOffline`/`deleteLocalOffline`, `update`/`dispose`/`restore`/`deleteSample` online/offline, `isOfflinePending`/`needsSync`).

### Mobile, `c-9-auto-sync` + `c-6b-updated-since-pull`

- `sync_service_test.dart` (5 тестов: PullStats, updated_since, reconcile).
- `sync_provider_test.dart` (9 тестов: PullStats, `_lastPullSince`, push/pull).

### Mobile, `c-9-natural-sort`

- `natural_sort_test.dart` (8 тестов).

### Mobile, `c-2d-2a` + `c-2d-2a-fix-3`

- `sync_queue_dao_test.dart` (13: `remapInPlace`, `remapLocalRef`).
- `container_from_json_test.dart` (6: серверный формат, локальный `*_id` fallback).
- `sync_pusher_test.dart` (+1: `onSuccess` получает `localRef` + `responseData` для `bulk-create`).
- `container_service_test.dart` (`bulkCreate` возвращает `BulkCreateResult {count, queued}`).

### Mobile, `c-2d-2c` + fixes

- `sync_queue_dao_test.dart` (+8: `remapEndpoint` — negative fill-samples / negative delete / positive no-op / bulk-create no-op / bulk-place no-op / samples endpoint no-op / negative без mapping / пустой mapping).
- `sample_service_test.dart` (+3: `fillSamples` при negative-ID — POST не уходит, локальные + очередь с `localRef`, `containerNumber` обновляется, статус `PENDING_PLACEMENT`).
- `container_service_test.dart` (+3: `bulkPlace` negative-ID — POST не уходит, очередь с `localRef = "[-N]"`, `updateLocationLocal` вызван; смешанные negatives+positives — очередь атомарно, `localRef = "[-1,-2]"`; офлайн-локально — `status=ACTIVE`).
- `named_catalog_test.dart` (5: `fullAddress` из `json['full_address']`, `label` приоритеты, пустой `full_address` → null).

### Mobile, `c-8b`

### Mobile, `c-8b-status`

- `container_service_test.dart` (+2: `update` со `status` online + offline, +3: `containerStatusToApi`).

- `container_service_test.dart` (+3: `update` — онлайн PATCH, офлайн → `sync_queue` PATCH + `updateFieldsLocal` + `setPendingSync`, валидация-400 → rethrow).

### Mobile, `c-8b-fix-2`

- Юнит-тестов не добавилось: `update`-catch (`catch (_)`) — тест требует mock DioException без ApiException — выходит за рамки unit-теста. Покрыто device-check (офлайн-редактирование шапки).
- `ContainerEditForm` — UI, не покрывается.
---

## Integration-тесты (приоритет 2)

- `test_api_create_sample`, `test_api_filter_samples`, `test_inventory_session_flow`, `test_import_shipment_creates_full_chain`, `test_complete_receipt_blocks_unresolved`, `test_migration_001_applied`.

---

## Contract-тесты (приоритет 2)

- `test_schema_matches_api_md`, `test_error_responses_consistent`, `test_pagination_format`.

---

## Правила написания

- Имя теста: `test_<что>_<условие>_<ожидание>` (snake_case).
- Один тест — одна проверка.
- Ассерты простые.
- Не тестировать UI.
- Тест быстрый: unit < 500 мс, integration < 5 сек.
- Комментарии — на русском.
- Фикстуры — в `conftest.py`, не дублировать.

### Специфика проекта

- **Django:** `@pytest.mark.django_db` на каждом тесте с БД.
- **`FileResponse`:** читать `streaming_content`.
- **`ProtectedError`:** мокать через `patch(..., side_effect=ProtectedError(...))`.
- **`get_object()` уважает `get_queryset`.** «Скрытые» — `Model.objects.filter(pk=pk).first()`.
- **Data-migration `storage/0008`:** проверяется вручную.
- **MSYS2 (UCRT64):** `manage.py shell -c "..."` ломается — тесты или временный скрипт.
- **stale-тесты** — копятся при прогоне только `apps/<app>/`. Перед закрытием — `pytest -q` целиком.
- **`tail` буферизует** — для прогресса без пайпа.
- **Prefetch с `to_attr`:** `getattr(obj, "active_items", None)`.
- **SQLite (mobile):** тесты через DI (`saveContainers`, `saveSamples`, `saveCatalog`, `saveHistory`, `saveSamples`, `getCached`, `getLocalNegative`, `updateLocalStatus`, `updateLocalFields`, `deleteLocal`, `getQueuePayload`, `updateQueuePayload`, `setPendingSyncLocal`, `hasPendingForContainer`, `getAllCached`, `updateLocationLocal`, `updateFieldsLocal`). Иначе `databaseFactory not initialized`.
- **Fake ApiClient (mobile):** `Fake implements ApiClient` с переопределением `get`/`post`/`patch`/`delete`.
- **`ArgumentError` vs `ApiException`:** `bulkPlace` / `updateLocalOffline` / `update` с невалидными аргументами → `ArgumentError`, не `ApiException`. Это контракт.
- **`MapEntry` не реализует `==` по значению** — не сравнивать коллекции `MapEntry` через `expect`, использовать `.length` + `.key` + `.value`.
- **`[...list]..sort(...)`** — если список может быть unmodifiable (`cast`, `const`), делать копию перед сортировкой.
- **`updatedSince` в Pull:** `DateTime.utc(...)` → `.toUtc().toIso8601String()`. Тест `pullAll(updatedSince:)` проверяет наличие `updated_since` в `queryParameters`.
- **`naturalCompare`:** тесты на `TST6701 < TST6710`, ведущие нули, разные префиксы, пустую строку.
- **`NetworkStatusProvider.pingNow`** — без `@visibleForTesting`, чтобы вызывать из `NetworkBadge`.
- **`SyncQueueDao.remapInPlace` / `remapLocalRef` / `remapEndpoint`** — `@visibleForTesting`, тесты на все ветки.
- **`Container.fromJson`** — тесты на серверный формат, локальный `*_id` fallback, пустые поля.
- **`NamedCatalog.fromJson`** — тесты на `fullAddress` (из `json['full_address']`), `label` приоритеты.

---

## Что делать при падении теста

1. Понять, кто прав — тест или код.
2. Если тест прав — исправить код.
3. Если тест устарел — обновить с пояснением.
4. Если непонятно — остановиться и спросить.

---

## Долг — сводка

**Сделано:**
- Три уровня тестов (unit/integration/contract).
- **842 backend** + 24 web + **227 mobile** = **1093 теста**.
- Contract-тесты OpenAPI.
- Все stale-тесты после серии 2f починены.
- Аудит тары — 8 тестов.
- `print_batch_status` — 4 теста.
- Offline-рендер PDF — 7 тестов.
- Офлайн-справочники — 11 тестов.
- Офлайн-история — 11 тестов.
- Офлайн-пробы — 5 тестов.
- Pre-fetch истории — 2 теста.
- Реестр тары — 3 теста.
- Создание тары — 2 теста.
- Офлайн-редактирование проб — ~22 теста.
- `PushResult` + `onSuccess` — 5 тестов.
- Reconcile — 2 теста.
- Счётчик — 1 тест.
- `PullStats` + `updated_since` — 5 тестов.
- Natural sort — 8 тестов.
- `pingNow` — покрыт `network_probe_test` / `network_status_provider_test` (device-check).
- Маппинг ID после `bulk-create` — 13 (`sync_queue_dao_test`) + 6 (`container_from_json_test`) + 1 (`sync_pusher_test`).
- Офлайн на офлайн-тарах (`c-2d-2c`) — 8 (`remapEndpoint`) + 3 (`fillSamples` negative) + 3 (`bulkPlace` negative) + 5 (`named_catalog`).
- Офлайн-редактирование шапки (`c-8b`) — 3 (`update`).

**Осталось:**
- **ТД-34.** `console.error` в catch-блоках web — низкий.
- **ТД-28.** Fallback `parseSampleInput` — низкий.
- **ТД-40.** `A4_H_MM` — unused import в `test_label_service.py` — низкий.
- **ТД-56.** Синхронизация констант `label_service.py` ↔ `label_pdf_generator.dart`.
- **ТД-58.** Pull больших справочников — батчинг.
- **ТД-59.** Pull истории = N запросов. Backend batch-эндпоинт.
- **ТД-60.** `catalogParentId` — проверить на реальных данных.
- **ТД-61.** UI overflow 3.5 / 7.2 px — не воспроизвелось, следить.
- **ТД-62.** `_lastPullSince` не персистится.
- **ТД-63.** `SampleDao.getByContainerId` natural sort в памяти.
- **ТД-64.** `ContainerService.bulkCreate` офлайн-ветка не покрыта unit-тестом.
- **ТД-65.** `_defaultOnSuccess` `pending_sync` для `fill-samples` / `bulk-place` на negative-ID — ✅ закрыто в `c-2d-2c`.
- **ТД-66.** `c-8b-fix-2`: офлайн-редактирование шапки блокируется при пустом кэше справочников.
- **ТД-67.** `ContainersPage.tsx` — `(row as any).comment` — временный обход типа.
- Покрытие серии `3.x-offline` — по мере реализации (`c-8b-fix-2`, `c-8-catalog-create-offline`).
- **ТД-68.** `api_client.dart` классифицирует `DioExceptionType.unknown` без `statusCode` как `isNetworkError = false`. `ContainerService.update` уже ловит `catch (_)`, но `fetchList` / `fetchHistory` / `fetchLabelPdf` — только `on ApiException if (!isNetworkError) rethrow`. Возможны ложные «не сетевые» ошибки офлайн. На device-check не воспроизвелось.
- `ContainerService.update` — не покрыт unit-тестом на `catch (_)`.