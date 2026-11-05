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
**Mobile: 196 юнит-тестов.**

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
- `SyncPusher` (PushResult, onSuccess, сброс `_pending_sync`, маппинг `bulk-create`).
- `SyncProvider` (`PullStats`, `PushResult`, `_lastPullSince`).
- `NetworkProbe`, `NetworkStatusProvider` (включая `pingNow`).
- `scan_window` (портрет + ландшафт).
- `sample_range_parser`, `int_ranges`.
- `catalog` (модели), `container`, `container_history_entry`.
- `label_pdf_generator` (offline-рендер PDF на Dart).
- `catalog_service` (кэш справочников, fallback, `catalogParentId`).
- `container_service` (`bulkPlace` online/offline, `fetchHistory` online/cache, `fetchList`, `bulkCreate` online/offline + `BulkCreateResult`, `Container.fromJson` fallback).
- `sample_service` (`fetchByContainerId` online/cache + natural sort, `fillSamples` online/offline, `update`/`dispose`/`restore`/`deleteSample` online/offline, `updateLocalOffline`/`deleteLocalOffline` + `_rebuildFillPayload`).
- `natural_sort` (`naturalCompare`, `naturalCompareSampleNumber`).
- `sync_queue_dao` (13: `remapInPlace` — container_id / container_ids / containers[].id / no-op; `remapLocalRef` — int-строка / JSON-массив / null / невалидный).
- `container_from_json` (6: серверный формат, локальный `*_id` fallback, пустые поля → 0/null, `_pending_sync`).
- `sync_pusher` (5: +1 на передачу `localRef` + `responseData`).
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

- `sync_queue_dao_test.dart` (13 тестов: `remapInPlace` для `container_id` / `container_ids[]` / `containers[].id` / no-op; `remapLocalRef` для int-строки / JSON-массива / null / невалидного JSON).
- `container_from_json_test.dart` (6 тестов: серверный формат, локальный `*_id` fallback, пустые поля → `0`/`null`, `_pending_sync`).
- `sync_pusher_test.dart` (+1 тест: `onSuccess` получает `localRef` + `responseData` для `bulk-create`).
- `container_service_test.dart` (`bulkCreate` возвращает `BulkCreateResult {count, queued}`).

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
- **SQLite (mobile):** тесты через DI (`saveContainers`, `saveSamples`, `saveCatalog`, `saveHistory`, `saveSamples`, `getCached`, `getLocalNegative`, `updateLocalStatus`, `updateLocalFields`, `deleteLocal`, `getQueuePayload`, `updateQueuePayload`, `setPendingSyncLocal`, `hasPendingForContainer`, `getAllCached`). Иначе `databaseFactory not initialized`.
- **Fake ApiClient (mobile):** `Fake implements ApiClient` с переопределением `get`/`post`/`patch`/`delete`.
- **`ArgumentError` vs `ApiException`:** `bulkPlace` / `updateLocalOffline` с невалидными аргументами → `ArgumentError`, не `ApiException`. Это контракт.
- **`MapEntry` не реализует `==` по значению** — не сравнивать коллекции `MapEntry` через `expect`, использовать `.length` + `.key` + `.value`.
- **`[...list]..sort(...)`** — если список может быть unmodifiable (`cast`, `const`), делать копию перед сортировкой.
- **`updatedSince` в Pull:** `DateTime.utc(...)` → `.toUtc().toIso8601String()`. Тест `pullAll(updatedSince:)` проверяет наличие `updated_since` в `queryParameters`.
- **`naturalCompare`:** тесты на `TST6701 < TST6710`, ведущие нули, разные префиксы, пустую строку.
- **`NetworkStatusProvider.pingNow`** — без `@visibleForTesting`, чтобы вызывать из `NetworkBadge`.
- **`SyncQueueDao.remapInPlace` / `remapLocalRef`** — `@visibleForTesting`, тесты на все ветки (map / list / вложенный / no-op; int / JSON / null / invalid).
- **`Container.fromJson`** — тесты на серверный формат, локальный `*_id` fallback и пустые поля (не должно быть краша).

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
- **842 backend** + 24 web + **196 mobile** = **1062 теста**.
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

**Осталось:**
- **ТД-34.** `console.error` в catch-блоках web — низкий.
- **ТД-28.** Fallback `parseSampleInput` — низкий.
- **ТД-40.** `A4_H_MM` — unused import в `test_label_service.py` — низкий.
- **ТД-56.** Синхронизация констант `label_service.py` ↔ `label_pdf_generator.dart`.
- **ТД-58.** Pull больших справочников — батчинг.
- **ТД-59.** Pull истории = N запросов. Backend batch-эндпоинт.
- **ТД-60.** `catalogParentId` — проверить на реальных данных.
- **ТД-61.** UI overflow 3.5 / 7.2 px — не воспроизвелось, следить.
- **ТД-62.** `_lastPullSince` не персистится — Pull раз в сессию полный.
- **ТД-63.** `SampleDao.getByContainerId` natural sort в памяти — для больших тар оптимизировать в SQL.
- **ТД-64.** `ContainerService.bulkCreate` офлайн-ветка не покрыта unit-тестом (нет DI на `ContainerDao.saveAll`).
- **ТД-65.** `_defaultOnSuccess` не снимает `pending_sync` для `fill-samples` / `bulk-place` на negative-ID — закрывается в `c-2d-2c`.
- Покрытие серии `3.x-offline` — по мере реализации (`c-2d-2c`, `c-8-*`).