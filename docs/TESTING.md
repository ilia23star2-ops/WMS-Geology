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

**Что НЕ тестируется:**
- UI (кнопки, экраны, навигация) — device-check.
- Реальная камера, реальный сканер QR — device-check.
- Реальный PostgreSQL продакшена.
- Внешние лабораторные API — моки.

---

## Как запускать

### Backend

    cd backend
    poetry run pytest -q
    poetry run pytest -v
    poetry run pytest apps/<app>/tests/test_<file>.py -v
    poetry run pytest -k "search"
    poetry run python manage.py check
    poetry run python manage.py makemigrations --check --dry-run

### Web

    cd web
    npm test
    npm run test:watch
    npm run lint
    npm run build

### Mobile

    cd mobile
    flutter test
    flutter analyze

### Автоматически

GitHub Actions: на каждый push в `feature/**` и `fix/**` —
unit + integration. На merge в `main` — все три уровня. Конфиг —
`.github/workflows/ci.yml`.

### Быстрый прогресс и отладка

- **`| tail` буферизует вывод.** Для прогресса — `pytest -q` без пайпа, или `pytest -q 2>&1 | tee /tmp/pytest.log`.
- **Полный прогон — перед закрытием захода** (stale-тесты копятся, если долго гонять только `apps/<app>/`).

---

## Текущее состояние

**Backend: 842 теста.**
**Web: 24 юнит-теста** (`tokenStorage`, `authStore`, `parseSampleInput`).
**Mobile: 139 юнит-тестов.**

### Backend — покрытие по приложениям

| Приложение | Ключевые тесты |
|---|---|
| `storage` | Модели топологии, `Pallet` (OneToOne, XOR), `Container` (+draft, nullable number, без unique, `PENDING_FILLING`), bulk-create, fill-samples, `bulk-place`, `create-in-cell`, фильтры `?draft_*`, `DELETE` + 409 + `?force=true`, QR топологии, аудит, `print_batch_status` |
| `samples` | Модели, `Sample` (+dispose/restore, `SELECTED`, 409 при delete), `grouped`, фильтры, поиск, seeds, `sync_sample_status_for_container` |
| `receiving` | Парсер Excel, `apply_shipment_import`, `conflicts`, `resolve-conflicts`, `check`, `complete`, `act` (PDF), `import-shipment`, каскадное удаление `ReceiptItem` |
| `picking` | Модели + API, фильтр `?work_order=` |
| `labels` | QR-сервис, PDF-этикетки, раскладка, QR-сетка, партии печати, `act_service` |
| `users` | JWT, `UserProfile`, `Role`, `AuditLog`, `log_audit`, `AuditLogSerializer`, seeds |
| `movements`, `inventory`, `work_orders` | Модели + API, `WorkOrder.__str__` |
| `tests/test_openapi.py` | Contract-тесты OpenAPI |

### Web — покрытие

- `src/api/tokenStorage.test.ts` — 3 теста.
- `src/stores/authStore.test.ts` — 3 теста.
- `src/utils/parseSampleInput.test.ts` — 18 тестов.

Компоненты и страницы — **не тестируются юнит-тестами**, только device-check.

### Mobile — покрытие

- Парсер QR (`parseQrPayload`).
- `TokenStorage`, `ApiClient` (Dio, JWT).
- Модели `Container`, `Sample`, `ScanHistoryEntry`, `ContainerHistoryEntry`.
- `SyncService` (Pull, pre-fetch истории), `SyncPusher`, `SyncProvider`.
- `NetworkProbe`, `NetworkStatusProvider`.
- `scan_window` (портрет + ландшафт).
- `sample_range_parser`, `int_ranges`.
- `catalog` (модели), `container`, `container_history_entry`.
- `label_pdf_generator` (offline-рендер PDF на Dart).
- `catalog_service` (кэш справочников, fallback, `catalogParentId`).
- `container_service` (bulkPlace online/offline, fetchHistory online/cache).
- `sample_service` (fetchByContainerId online/cache).
- `user`, `widget_test`.

UI (экраны, сканер) — device-check на планшете.

---

## Unit-тесты (приоритет 1)

### Домен

- `test_sample_number_not_unique` — один номер, разные `research_type` → две строки.
- `test_one_container_one_research_type` — пробы разных типов → ошибка.
- `test_work_order_linked_incoming_coded` — INCOMING ↔ CODED.
- `test_sample_work_orders_many_to_many` — проба связана с несколькими Н/З.
- `test_container_number_duplicate_allowed` — `container_number` не уникален (1.61).
- `test_bulk_create_success` — `PENDING_FILLING` (2f-5c-1).
- `test_fill_samples_pending_filling_to_pending_placement` — (2f-5c-1).
- `test_fill_samples_updates_draft_fields` — (2f-7f + 1.69).
- `test_check_all_matched_creates_containers` — (2f-5c-1).
- `test_sync_sample_status_protects_selected` — (2f-9b).
- `test_issued_container_does_not_touch_sample` — (2f-9c).

### Аудит тары (2f-14a)

- `test_history_empty_for_new_container`.
- `test_history_after_create` / `_update` / `_delete` / `_fill_samples` / `_bulk_place`.
- `test_history_order_desc`, `test_history_404_unknown_container`.

### `print_batch_status` (2f-17b)

- `test_print_batch_status_null_without_batch` / `_draft` / `_printed` / `_cancelled_shown_as_null`.

### Поиск и фильтры

- `test_search_by_sample_number`, `test_search_by_work_order_incoming`, `test_search_by_research_type`, `test_search_by_site_and_well`.
- `test_filter_by_draft_work_order_coded_icontains`, `test_filter_by_draft_research_type`, `test_filter_draft_work_order_and_research_type_combined`.

### Адресное хранение

- `test_full_address_generation`, `test_pallet_one_to_one_cell_raises`, `test_pallet_in_transit_valid`, `test_pallet_capacity_override_jsonb`.

### QR топологии (2f-4c-1)

- `test_section_qr_auto_generated`, `test_cell_qr_auto_generated`, `test_section_qr_not_overwritten_when_set_explicitly`.
- `test_section_qr_pdf_returns_pdf`, `test_cell_qr_pdf_returns_pdf`, `test_qr_batch_returns_pdf`.
- `test_qr_batch_empty_items_returns_400`, `test_qr_batch_unknown_id_returns_404`, `test_qr_batch_unknown_type_returns_400`.
- `test_qr_grid_capacity_88`.

### Парсеры

- `parse_excel` — группы, шапка, тип тары, `1+1`, список дат.
- `parseSampleInput` (web, 18) — prefix + middle + sequence.
- `test_parse_qr_payload` (mobile).

### Custom actions

- `test_dispose_sets_status_and_audit`, `test_dispose_already_disposed_returns_400`, `test_restore_from_disposed_returns_200`, `test_restore_not_disposed_returns_400`, `test_delete_sample_returns_204`, `test_delete_sample_protected_returns_409`.
- `test_delete_container_protected_returns_409`.
- `test_act_returns_pdf_for_confirmed_receipt`, `test_act_returns_400_for_non_confirmed`.
- `test_delete_item_without_container`, `_with_empty_container`, `_with_container_and_samples`, `_returns_404_for_unknown`, `_returns_409_if_sample_protected`.
- `test_bulk_place_to_cell`, `test_bulk_place_to_floor`.
- `test_create_in_cell`.
- `test_delete_container_force_with_samples`.
- `test_patch_comment_non_draft_allowed`.

### Mobile, `c-7-offline-catalog`

- `catalog_service_test.dart` (11):
  - `catalogParentId`: `room` / `room_id` / `tier_id` / верхнеуровневые (null).
  - `CatalogService`: `fetchRooms` онлайн → save; `fetchRooms` офлайн → cache; `fetchSites` офлайн → typed; `fetchRacks` офлайн → `getByParent`; `fetchCells` офлайн пустой; fallback online→offline.
- `sync_service_test.dart` (2):
  - все 9 эндпоинтов справочников запрошены + `saveCatalog` 9 раз;
  - ошибка истории одной тары не валит Pull.

### Mobile, `c-7e-1` / `c-7e-2` / `c-7e-3`

- `sample_service_test.dart` (5):
  - онлайн → save; онлайн пусто; офлайн с кэшем; офлайн с пустым кэшем (`[]`, без `rethrow`); валидация (не network) → `ApiException`.
- `container_service_test.dart` (11):
  - `bulkPlace`: онлайн (ячейка / пол), офлайн (`queued`, payload), валидация (rethrow), `ArgumentError` (ни один / оба).
  - `fetchHistory`: онлайн → save в кэш; офлайн с кэшем; офлайн пусто (`[]`); валидация → `ApiException`.
- `sync_service_test.dart` (2):
  - pre-fetch истории для всех тар; ошибка одной тары не валит Pull.

---

## Integration-тесты (приоритет 2)

- `test_api_create_sample` — POST создаёт запись, возвращает ID.
- `test_api_filter_samples` — GET с параметрами.
- `test_inventory_session_flow` — старт → сканы → завершение → отчёт.
- `test_import_shipment_creates_full_chain` — Excel → Shipment + Receipt + ReceiptItem + Container.
- `test_complete_receipt_blocks_unresolved` — 400, если неразобранные конфликты.
- `test_migration_001_applied` — миграция создаёт все таблицы.

---

## Contract-тесты (приоритет 2)

- `test_schema_matches_api_md` — OpenAPI соответствует `API.md`.
- `test_error_responses_consistent` — формат ошибок 400/404/500 единый.
- `test_pagination_format` — пагинация одинаковая.

---

## Правила написания

- Имя теста: `test_<что>_<условие>_<ожидание>` (snake_case).
- Один тест — одна проверка.
- Ассерты простые, без магии.
- Не тестировать UI.
- Тест быстрый: unit < 500 мс, integration < 5 сек.
- Комментарии — на русском.
- Фикстуры — в `conftest.py`, не дублировать.

### Специфика проекта

- **Django:** `@pytest.mark.django_db` на каждом тесте, использующем БД.
- **`FileResponse`:** нет атрибута `.content`, читать `streaming_content`.
- **`ProtectedError`:** в тестах `destroy` мокать через `patch(..., side_effect=ProtectedError("test", []))`.
- **`get_object()` уважает `get_queryset`.** «Скрытые» объекты — `Model.objects.filter(pk=pk).first()`.
- **Data-migration `storage/0008`:** проверяется вручную.
- **MSYS2 (UCRT64):** `manage.py shell -c "..."` ломается — тесты или временный скрипт.
- **stale-тесты** — копятся, если долго гонять только `apps/<app>/`. Перед закрытием — `pytest -q` целиком.
- **`tail` буферизует** — для прогресса `pytest -q` без пайпа или `| tee`.
- **Prefetch с `to_attr`:** `getattr(obj, "active_items", None)`.
- **SQLite (mobile):** тесты через `sqflite_common_ffi` (`databaseFactory = databaseFactoryFfi`) — иначе `Bad state: databaseFactory not initialized`. Сейчас все тесты с кэшем используют DI (`saveContainers` / `saveSamples` / `saveCatalog` / `saveHistory` / `saveSamples`), чтобы не требовать SQLite.
- **Fake ApiClient (mobile):** два подхода — `_FakeAdapter implements HttpClientAdapter` (для Dio) или `Fake implements ApiClient` с переопределением `get`/`post`/`patch`/`delete` (проще для сервисных тестов).
- **`ArgumentError` vs `ApiException`:** `bulkPlace` с невалидными аргументами (оба/ни один) → `ArgumentError`, не `ApiException`. Это контракт.

---

## Что делать при падении теста

Не удалять тест.
1. Понять, кто прав — тест или код.
2. Если тест прав — исправить код.
3. Если тест устарел — обновить с пояснением.
4. Если непонятно, кто прав — остановиться и спросить.

---

## Долг — сводка

**Сделано:**
- Три уровня тестов (unit / integration / contract) — действуют.
- **842 backend** + 24 web + **139 mobile** = **1005 тестов**.
- Contract-тесты OpenAPI.
- Все stale-тесты после серии 2f починены.
- Аудит тары — 8 тестов.
- `print_batch_status` — 4 теста.
- Offline-рендер PDF — 7 тестов.
- Офлайн-справочники (кэш + fallback + `catalogParentId`) — 11 тестов.
- Офлайн-история (bulkPlace + fetchHistory online/cache) — 11 тестов.
- Офлайн-пробы (fetchByContainerId cache) — 5 тестов.
- Pre-fetch истории (`pullAll` + ошибка одной тары) — 2 теста.

**Осталось:**
- **ТД-34.** `console.error` в catch-блоках web — низкий.
- **ТД-28.** Fallback `parseSampleInput` — низкий.
- **ТД-40.** `A4_H_MM` — unused import в `test_label_service.py` — низкий.
- **ТД-56.** Синхронизация констант `label_service.py` ↔ `label_pdf_generator.dart` (порт 1:1).
- **ТД-58.** Pull больших справочников — батчинг / пагинация в одном запросе.
- **ТД-59.** Pull истории = N запросов. Backend batch-эндпоинт.
- **ТД-60.** `catalogParentId` — проверить на реальных данных, что сервер отдаёт поле-родителя.
- Покрытие серии `3.x-offline` — по мере реализации (`c-8-*`).