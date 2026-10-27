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
    poetry run pytest -q                 # все тесты
    poetry run pytest -v                 # подробно
    poetry run pytest apps/<app>/tests/test_<file>.py -v
    poetry run pytest -k "search"        # тесты по имени
    poetry run python manage.py check
    poetry run python manage.py makemigrations --check --dry-run

### Web

    cd web
    npm test                # Vitest (single run)
    npm run test:watch      # Vitest (watch)
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

- **`| tail` буферизует вывод.** Для прогресса — запускать `pytest -q`
  без пайпа, или `pytest -q 2>&1 | tee /tmp/pytest.log`.
- **Полный прогон — перед закрытием захода** (см. §12.5, stale-тесты
  копятся, если долго гонять только `apps/<app>/`).

---

## Текущее состояние

**Backend: 767 тестов.**
**Web: 24 юнит-теста** (`tokenStorage`, `authStore`, `parseSampleInput`).
**Mobile: 32 юнит-теста.**

### Backend — покрытие по приложениям

| Приложение | Ключевые тесты |
|---|---|
| `storage` | Модели топологии, `Pallet` (OneToOne, XOR), `Container` (+draft, nullable number, **без unique**, `PENDING_FILLING`), bulk-create, fill-samples, `bulk-place`, `create-in-cell`, фильтры `?draft_*`, `DELETE` + 409 + `?force=true`, QR топологии (авто-`qr_code`, PDF, batch) |
| `samples` | Модели, `Sample` (+`dispose`/`restore`, `SELECTED`, 409 при delete), `grouped` action, фильтры, поиск, seeds, `sync_sample_status_for_container` |
| `receiving` | Парсер Excel (группы, тип тары, `1+1`), `apply_shipment_import`, `receipts/{id}/conflicts/`, `resolve-conflicts`, `check`, `complete`, `act` (PDF), `import-shipment`, каскадное удаление `ReceiptItem` |
| `picking` | Модели + API, фильтр `?work_order=` (с `linked_order`) |
| `labels` | QR-сервис, PDF-этикетки, раскладка, QR-сетка, партии печати, `act_service` |
| `users` | JWT, `UserProfile`, `Role`, `AuditLog`, seeds |
| `movements`, `inventory`, `work_orders` | Модели + API, `WorkOrder` `__str__` (TYPE_CODED = «Текущий»), admin |
| `tests/test_openapi.py` | Contract-тесты: схема OpenAPI соответствует контрактам |

### Web — покрытие

- `src/api/tokenStorage.test.ts` — 3 теста.
- `src/stores/authStore.test.ts` — 3 теста.
- `src/utils/parseSampleInput.test.ts` — 18 тестов (парсер номера
  пробы: prefix / middle / sequence).

Компоненты и страницы (MUI-диалоги, DataGrid, роуты) —
**не тестируются юнит-тестами**, только device-check.

### Mobile — покрытие

- Парсер QR (`parseQrPayload`).
- `TokenStorage` на `flutter_secure_storage`.
- `ApiClient` (Dio, JWT-интерцептор).
- Модели `Container`, `Sample`.

UI (экраны, сканер) — device-check на планшете.

---

## Unit-тесты (приоритет 1)

### Домен

- `test_sample_number_not_unique` — один номер, разные
  `research_type` → две строки в БД.
- `test_one_container_one_research_type` — попытка положить в тару
  пробы разных типов → ошибка.
- `test_work_order_linked_incoming_coded` — связь INCOMING ↔ CODED
  через `linked_order_id`.
- `test_sample_work_orders_many_to_many` — проба связана с
  несколькими Н/З, фильтр по любому находит её.
- `test_container_number_duplicate_allowed` — `Container.container_number`
  больше не уникален глобально (DECISIONS 1.61).
- `test_container_number_duplicate_is_valid` — то же для
  сериализатора (2f-1b).
- `test_bulk_create_success` — после bulk-create `Container.status`
  = `PENDING_FILLING` (2f-5c-1).
- `test_bulk_create_duplicate_number_allowed` — второй раз тот же
  `container_number` → 201 (1.61, `2f-8-fix-2`).
- `test_fill_samples_pending_filling_to_pending_placement` —
  `fill-samples` переводит `PENDING_FILLING → PENDING_PLACEMENT`,
  пробы создаются в `PENDING_PLACEMENT` (2f-5c-1).
- `test_fill_samples_active_container_still_creates_pending_placement` —
  `ACTIVE` тары → пробы `PENDING_PLACEMENT` (sync не вызывается,
  2f-5c-1 + `2f-8-fix-2`).
- `test_fill_samples_updates_draft_fields` — draft-поля после
  `fill-samples` обновляются из запроса (2f-7f + 1.69,
  `2f-8-fix-2`).
- `test_fill_samples_duplicate_number_allowed` — дубликат номера
  принимается (1.61, `2f-8-fix-2`).
- `test_check_all_matched_creates_containers` — при сверке
  `matched=true` создаётся `Container` со `PENDING_FILLING`
  (2f-5c-1).
- `test_sync_sample_status_protects_selected` — `SELECTED` пробы
  не перезаписываются при синхронизации (2f-9b).
- `test_issued_container_does_not_touch_sample` — для `Container.STATUS_ISSUED`
  маппинга нет, sync не обновляет (2f-9c, `2f-8-fix-2`).
- `test_work_order_str_coded` — `TYPE_CODED` label = «Текущий»
  (2f-8, `2f-8-fix-2`).

### Поиск и фильтры

- `test_search_by_sample_number` — поиск по номеру возвращает все
  строки с разными типами.
- `test_search_by_work_order_incoming` — фильтр по входящему Н/З
  находит пробы, чей текущий Н/З — зашифрованный.
- `test_search_by_research_type`, `test_search_by_site_and_well`.
- `test_filter_by_draft_work_order_coded_icontains`,
  `test_filter_by_draft_research_type`,
  `test_filter_draft_work_order_and_research_type_combined` — 2f-1.

### Адресное хранение

- `test_full_address_generation` — сборка «Комната / Стеллаж /
  Пролёт / Ярус / Ячейка».
- `test_pallet_one_to_one_cell_raises`, `test_pallet_in_transit_valid`,
  `test_pallet_capacity_override_jsonb`.

### QR топологии (2f-4c-1)

- `test_section_qr_auto_generated` — `Section.save()` генерирует
  `WMSG:SECTION:<pk>`, если `qr_code` пусто.
- `test_cell_qr_auto_generated` — аналогично для `Cell`.
- `test_section_qr_not_overwritten_when_set_explicitly` — явно
  заданный `qr_code` не перезаписывается.
- `test_section_qr_pdf_returns_pdf` — `GET /storage/sections/{id}/qr.pdf/`
  → 200 + PDF.
- `test_cell_qr_pdf_returns_pdf` — аналогично для ячейки.
- `test_qr_batch_returns_pdf` — `POST /storage/sections/qr-batch/`
  → 200 + PDF.
- `test_qr_batch_empty_items_returns_400`,
  `test_qr_batch_unknown_id_returns_404`,
  `test_qr_batch_unknown_type_returns_400`.
- `test_qr_grid_capacity_88` — композиция `_qr_grid_dimensions()` == 8×11.

### Парсеры

- `parse_excel` — группы «типы + Дата», шапка до
  `MAX_HEADER_SEARCH`, строка типа тары, `1+1`, список дат.
- `parseSampleInput` (web, 18 тестов) — префикс + middle +
  sequence.
- `test_parse_qr_payload` (mobile) — разбор `WMSG:<TYPE>:<ID>`.

### Custom actions

- `test_dispose_sets_status_and_audit`,
  `test_dispose_already_disposed_returns_400`,
  `test_restore_from_disposed_returns_200`,
  `test_restore_not_disposed_returns_400`,
  `test_delete_sample_returns_204`,
  `test_delete_sample_protected_returns_409` — 2f-2b.
- `test_delete_container_protected_returns_409` — 2f-1.
- `test_act_returns_pdf_for_confirmed_receipt`,
  `test_act_returns_400_for_non_confirmed` — 3f-1.
- `test_delete_item_without_container`,
  `test_delete_item_with_empty_container`,
  `test_delete_item_with_container_and_samples`,
  `test_delete_item_returns_404_for_unknown`,
  `test_delete_item_returns_409_if_sample_protected` — 2f-5a-1
  (каскадное удаление `ReceiptItem`).
- `test_bulk_place_to_cell`, `test_bulk_place_to_floor` — 2f-10.
- `test_create_in_cell` — 2f-12a.
- `test_delete_container_force_with_samples` — 2f-12b.
- `test_patch_comment_non_draft_allowed` — `name`/`comment` в любом
  статусе партии печати (2f-7e, `2f-8-fix-2`).

---

## Integration-тесты (приоритет 2)

- `test_api_create_sample` — POST создаёт запись и возвращает ID.
- `test_api_filter_samples` — GET /samples с параметрами фильтра.
- `test_inventory_session_flow` — старт → сканы → завершение →
  отчёт по расхождениям.
- `test_import_shipment_creates_full_chain` — Excel → Shipment +
  Receipt + ReceiptItem + Container.
- `test_complete_receipt_blocks_unresolved` — `complete` возвращает
  400, если есть неразобранные конфликты.
- `test_migration_001_applied` — миграция создаёт все таблицы.

---

## Contract-тесты (приоритет 2)

- `test_schema_matches_api_md` — OpenAPI-схема соответствует
  `API.md`.
- `test_error_responses_consistent` — формат ошибок 400/404/500
  единый.
- `test_pagination_format` — формат пагинации одинаковый во всех
  list-эндпоинтах.

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

- **Django:** `@pytest.mark.django_db` на каждом тесте, использующем
  БД.
- **Файлы-ответы (`FileResponse`):** у `FileResponse` **нет**
  атрибута `.content`. Читать `streaming_content`
  (см. `test_receipt_act_endpoint.py` 3f-1,
  `test_qr_topology.py` 2f-4c-1).
- **`ProtectedError`:** в тестах `destroy` удобно мокать через
  `patch(..., side_effect=ProtectedError("test", []))` —
  не заводить реальные `PrintBatch`/`Shipment` только ради 409
  (примеры: `test_delete_sample_protected_returns_409`,
  `test_delete_item_returns_409_if_sample_protected`).
- **`get_object()` уважает `get_queryset`.** Если экшен должен
  видеть «скрытые» объекты (утилизированные пробы) — брать
  `Model.objects.filter(pk=pk).first()` (2f-2b,
  `_get_sample_any`).
- **Data-migration `storage/0008`:** тесты автоматом не проверяют
  перевод старых `PENDING_PLACEMENT` без проб → `PENDING_FILLING`.
  Проверяется вручную в shell (31 тара на тестовой БД).
- **MSYS2 (UCRT64):** `manage.py shell -c "..."` ломается —
  писать тесты или временный скрипт.
- **stale-тесты** — копятся, если долго гонять только `apps/<app>/`
  (2f-8-fix-2: 8 stale-тестов от 2f-5c-1, 2f-7e, 2f-7f, 2f-9c,
  1.61, `TYPE_CODED`). Перед закрытием захода — `pytest -q` целиком.
- **`tail` буферизует** — для прогресса `pytest -q` без пайпа
  или `| tee`.

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
- **767 backend** + 24 web + 32 mobile = **823 теста**.
- Contract-тесты OpenAPI.
- Все stale-тесты после серии 2f починены (`2f-8-fix-2`).

**Осталось:**
- **ТД-34.** `console.error` в catch-блоках web-компонентов — низкий.
- **ТД-28.** Fallback `parseSampleInput` — низкий.
- **ТД-40.** `A4_H_MM` — unused import в `test_label_service.py` — низкий.
- Покрытие новых заходов серии 2f — по мере реализации.
- Покрытие custom actions приёмки (`check`/`complete`) — точечное.
- Покрытие `qr-batch` при отказе одного item — есть.
- Покрытие `Section`/`Cell` QR в новых эндпоинтах — есть
  (`test_qr_topology.py`).