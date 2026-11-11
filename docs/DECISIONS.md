# DECISIONS.md — решения и глоссарий

> Здесь фиксируются принятые решения и термины проекта.
> Решение без причины — плохое решение. Причина обязательна.

---

## 1. Решения

### 1.1–1.34 (сводка)

Полные формулировки — в истории git. Кратко:

- **1.1–1.13** — базовые: название, стек, WorkOrders self-ref, Sample как единица, M:N проба↔Н/З, QR, Уровень 1, фазы, система разработки, SSH.
- **1.14–1.19** — инфраструктура: портативный PG, `poetry run`, стандартный User, seeds ролей, Pallet «в пути», PROTECT для Container.
- **1.20–1.30** — топология v2: 4 яруса A–D, «тихий» Pallet, QR на секции/ячейке/таре, PickList, soft-delete утилизации, MoveOperation, вместимость, штрих-код ЛИМС, InventoryIssue, керн, помощник сортировки.
- **1.31–1.34** — PostgreSQL: пересоздание миграций, CHECK `move_item`, Docker Compose, JWT + OpenAPI.

**Статус:** ✅ действуют.

### 1.35–1.50 (сводка)

- **1.35–1.39** — справочники, паттерны, автоопределение участков и лабораторий.
- **1.40** — формат номера пробы (prefix/middle/sequence).
- **1.41** — оба Н/З на этикетке.
- **1.42** — отказ от `SampleDecryption`.
- **1.43** — UX ручного ввода.
- **1.44** — статусы проб на приёмке.
- **1.45–1.46** — формат этикетки (устарело, 1.55).
- **1.47** — статус `PENDING_PLACEMENT` (1.62).
- **1.48** — массовая печать (корзина → PDF).
- **1.49** — Excel: формат их.
- **1.50** — Акт приёмки (PDF).

**Статус:** ✅ действуют.

### 1.51–1.74 (сводка)

- **1.51** — ручной ввод доступен всегда.
- **1.52** — портал лабораторий.
- **1.53** — циклические импорты через строковые ссылки.
- **1.54** — `UniqueConstraint` с NULL.
- **1.55** — спецификация этикетки (модель 4d).
- **1.56** — `PrintBatch`: soft-delete через `CANCELLED`.
- **1.57** — `PrintBatchItem.container` — PROTECT.
- **1.58** — синхронизация статусов Sample ↔ Container через явный сервис.
- **1.59** — разделение bulk-create на два эндпоинта.
- **1.60** — Container: draft-поля + nullable `container_number`.
- **1.61** — `container_number` без глобальной уникальности.
- **1.62** — `PENDING_FILLING`.
- **1.63** — PDF QR топологии.
- **1.64** — каскадное удаление `ReceiptItem`.
- **1.65** — force-удаление тары.
- **1.66** — `Sample.SELECTED`.
- **1.67** — создание тары в ячейке.
- **1.68** — ID не переиспользуются.
- **1.69** — `fill-samples` обновляет draft-поля.
- **1.70** — аудит тары (`log_audit`).
- **1.71** — `print_batch_status` в сериализаторе.
- **1.72** — `ContainerDetailDialog`.
- **1.73** — proxy bypass рабочего ПК.
- **1.74** — JSON + gzip для sneakernet.

**Статус:** ✅ действуют.

### 1.75. 2026-10-30 — Денормализация сериализаторов для Mobile

**Решение:** добавить «денормализованные» поля-имена в сериализаторы (`container_type_name`, `floor_room_name`, `cell_full_address` и т.д.).

**Причина:** Mobile не тянет справочники отдельно; Web и Mobile используют одинаковые сериализаторы.

**Цена:** JSON больше на ~20–30%.

**Где:** `backend/apps/*/serializers.py`.
**Статус:** ✅ действует (реализовано в `c-6a`).

### 1.76. 2026-10-30 — Инкрементальный Pull (`?updated_since=`)

**Решение:** Mobile Pull поддерживает `?updated_since=`, отдаём только изменённые записи.

**Причина:** полный Pull 10k проб долго и много трафика.

**Где:** `backend/apps/storage/filters.py::apply_updated_since`, `views.py::ContainerViewSet` и `SampleViewSet`.
**Статус:** ✅ действует (реализовано в `c-6b`; на мобилке — `c-6b-updated-since-pull`).

### 1.77. 2026-10-30 — Offline-печать этикеток на Mobile

**Решение:** генерация PDF на клиенте (Dart `pdf`) без сервера.

**Причина:** мобилка должна работать без сервера; печать после оцифровки.

**Где:** `mobile/lib/services/label_service.dart`.
**Статус:** ✅ действует (реализовано в `c-7f-1` + `c-7f-2`).

### 1.78. 2026-11-02 — `GET /health/` вне `/api/v1/`, без авторизации

**Решение:** healthcheck на `/health/`, вне `/api/v1/`, без JWT. Отдаёт `{status, service, time}` (200).

**Причина:**
- Mobile (`c-6c`) пингует перед выбором `apiBaseUrl` — JWT ещё нет, нельзя требовать авторизацию.
- Не обращается к БД — отвечает, пока процесс Django жив.
- Простая проверка связи, не бизнес-эндпоинт.

**Где:** `backend/wms_geology/health.py`, `backend/wms_geology/urls.py`.
**Статус:** ✅ действует (реализовано в `c-6a`).

### 1.79. 2026-11-02 — `?updated_since=` только с таймзоной, naive → 400

**Решение:** `?updated_since=<ISO 8601>` на `/storage/containers/` и `/samples/`. С таймзоной (UTC, суффикс Z или +00:00). Naive datetime → 400. Невалидный ISO → 400. Пусто → без фильтра.

**Причина:** явная ошибка лучше молчаливого сдвига.

**Где:** `backend/apps/storage/filters.py`, `views.py` (`ContainerViewSet`, `SampleViewSet`).
**Статус:** ✅ действует (реализовано в `c-6b`).

### 1.80. 2026-11-02 — Auto-detect сети: probe /health/ → первый живой

**Решение:** при старте приложение параллельно пингует `GET /health/` на трёх адресах: `127.0.0.1` (USB), `192.168.0.77` (WiFi), `10.0.2.2` (эмулятор). Первый живой — в `apiBaseUrl`. `--dart-define=API_HOST` отменяет probe. Все мертвы → fallback `192.168.0.77`.

**Где:** `mobile/lib/services/network_probe.dart`, `mobile/lib/config.dart::AppConfig.resolve`, `mobile/lib/main.dart`.
**Статус:** ✅ действует (реализовано в `c-6c`).

### 1.81. 2026-11-02 — ScanWindow: `_pickBarcodeInScanWindow` + landscape swap

**Решение:** два механизма фильтрации области сканирования: native `scanWindow` + `_pickBarcodeInScanWindow` (по центру `corners`). Landscape-fix — swap effectiveSize в `mapImageToWidgetFrame`.

**Причина:** native `scanWindow` в `mobile_scanner 7.4.2` на Android не ограничивает область; `BarcodeCapture.rotation` не существует; `Barcode.scaleCorners` не учитывает landscape.

**Где:** `mobile/lib/utils/scan_window.dart`, `mobile/lib/screens/scanner_screen.dart`.
**Статус:** ✅ действует (`c-6d-fix` + `c-6d-fix-3`).

### 1.82. 2026-11-02 — `NetworkStatusProvider` (heartbeat `/health/` 10 с)

**Решение:** `Timer.periodic(10s)` → `GET /health/` текущего `AppConfig.apiHost`. При неудаче — `NetworkProbe.resolve()`. При смене хоста — `onBaseUrlChanged`.

**Причина:** `WidgetsBindingObserver` в `NetworkMonitor` давал регресс. Heartbeat 10 с — компромисс.

**Где:** `mobile/lib/providers/network_status_provider.dart`, `mobile/lib/widgets/network_badge.dart`, `mobile/lib/main.dart`.
**Статус:** ✅ действует.

### 1.83. 2026-11-02 — Синхронизация запрещена при офлайне / pendingOffline

**Решение:** кнопка «Синхронизация» на `HomeScreen` и все действия на `SyncScreen` `disabled`, если `!isOnline` или `isPendingOffline`.

**Где:** `mobile/lib/screens/home_screen.dart`, `mobile/lib/screens/sync_screen.dart`.
**Статус:** ✅ действует.

### 1.84. 2026-11-02 — Иконка сети на `LoginScreen`

**Решение:** `NetworkBadge` в `AppBar.actions` `LoginScreen`. `AppBar` прозрачный.

**Где:** `mobile/lib/screens/login_screen.dart`, `mobile/test/widget_test.dart`.
**Статус:** ✅ действует.

### 1.85. 2026-11-02 — Адаптив карточки тары (портрет / ландшафт)

**Решение:** `LayoutBuilder` + два layout'а (портрет — `AppBar` + `TabBar.bottom`; ландшафт — `Row` с левой панелью ~40%). Кнопки — в `bottomNavigationBar` + `SafeArea`.

**Где:** `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.86. 2026-11-02 — Форма шапки тары в bottom sheet

**Решение:** ✏ в `AppBar.actions` открывает `showModalBottomSheet` с `ContainerEditForm`. Поля — `container_number`, `container_type`, `comment`, `position_on_pallet`, `draft_*`.

**Где:** `mobile/lib/widgets/container_edit_form.dart`, `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует (модифицировано в `c-8b-fix-1` — см. 1.103).

### 1.87. 2026-11-02 — `FillContainerContent` на mobile (Dart-порт веба)

**Решение:** вкладка «Редактирование» — Dart-порт `FillContainerContent.tsx`.

**Где:** `mobile/lib/utils/sample_range_parser.dart`, `mobile/lib/utils/int_ranges.dart`, `mobile/lib/widgets/fill_container_content.dart`, `mobile/lib/widgets/range_edit_dialog.dart`.
**Статус:** ✅ действует.

### 1.88. 2026-11-02 — Вкладка «Пробы» как в вебе

**Решение:** поиск, чекбоксы, bulk-статус, `SampleStatusChip`, `SampleEditDialog` (edit/dispose/restore/delete).

**Где:** `mobile/lib/widgets/sample_status_chip.dart`, `mobile/lib/widgets/sample_edit_dialog.dart`, `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.89. 2026-11-02 — История сканов с `Н/З · ТИ · номер`

**Решение:** `ScanHistoryService` хранит `List<ScanHistoryEntry>` в `shared_preferences`. Миграция со старого `scan_history_ids`.

**Где:** `mobile/lib/models/scan_history_entry.dart`, `mobile/lib/services/scan_history_service.dart`.
**Статус:** ✅ действует.

### 1.90. 2026-11-02 — Правило: перед `git add` — `git status --short | grep "mobile/lib"`

**Решение:** перед `git add` проверять `git status --short | grep "mobile/lib"`, включать `M`/`??` явными именами.

**Причина:** дважды за сессию (`c-7b`, `c-7h`) файлы остались uncommitted.

**Статус:** ✅ действует.

### 1.91. 2026-11-02 — Не выдавать код следующего захода, пока текущий не закоммичен

**Решение:** перед выдачей кода нового захода — `git status --short | grep "mobile/lib"` должно быть пусто.

**Причина:** три случая (`c-7b`, `c-7d`, `c-7h`) смешавшихся файлов. `flutter analyze`/`flutter test` проходят, но `git clone` с нуля ломается.

**Статус:** ✅ действует.

### 1.92. 2026-11-02 — Offline-place через `sync_queue` (c-7c)

**Решение:** `POST /storage/containers/bulk-place/` — онлайн + офлайн через `sync_queue`. `PlaceOutcome {online, queued}`.

**Кнопки в карточке тары — раздельные:**
- `[Предпросмотр]` — всегда.
- `[Разместить]` — `canPlace = PENDING_FILLING || PENDING_PLACEMENT`.
- `[Местоположение]` — `hasCell = cellId != null`.

**Где:** `mobile/lib/services/container_service.dart`, `mobile/lib/widgets/place_container_dialog.dart`, `mobile/lib/widgets/container_location_dialog.dart`, `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.93. 2026-11-02 — Мобилка = полное двустороннее зеркало сервера

**Решение:** мобилка в офлайне видит всё, что на сервере; умеет создавать/менять локально с синхронизацией.

**Правила:**
1. **Pull тянет ВСЁ**: топология, справочники, `containers`, `samples`, **история всех тар**.
2. **Каждый справочник кэшируется** в SQLite с fallback.
3. **История кэшируется** через **pre-fetch в Pull**.
4. **Создание/редактирование справочника офлайн** — через `sync_queue`.

**Реализовано:** `c-7-offline-catalog` (1–2), `c-7e-1`/`c-7e-2`/`c-7e-3` (3), `c-8-catalog-create` (4, но `create` пока только онлайн — полное офлайн-создание = `c-8-catalog-create-offline`).

**Где:** `SyncService.pullAll`, `CatalogService`, `CatalogDao`, `ContainerHistoryDao`, `database.dart` (v8).
**Статус:** 🟡 правила 1–3 закрыты, 4 частично (`c-8-catalog-create` — online; `c-8-catalog-create-offline` — TODO).

### 1.94. 2026-11-02 — Мобилка: офлайн-редактирование серверных проб

**Решение:** `SampleService.update`/`dispose`/`restore`/`deleteSample` при `isNetworkError` → `sync_queue`:
- Локально обновить кэш (`updateLocalStatus`/`deleteById`).
- `sync_queue.enqueue(PATCH/POST/DELETE, endpoint, payload)`.
- `setPendingSyncLocal(id, true)` + `setPendingSync(containerId, true)`.
- `Sample.pendingSync` — флаг, `Sample.needsSync` — для UI.

**`SampleDao.saveAll` не перезаписывает** пробы с `_pending_sync = 1`. `fetchByContainerId` возвращает кэш при `hasPendingForContainer`. `_pending_sync` сбрасывается после Push или Pull (reconcile).

**Где:** `mobile/lib/models/sample.dart`, `sample_dao.dart`, `sample_service.dart`, `sample_edit_dialog.dart`, `container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.95. 2026-11-02 — Мобилка: офлайн-редактирование `sample_number` (офлайн-проб)

**Решение:** у офлайн-пробы (`id < 0`) `sample_number` редактируется. `SampleService.updateLocalOffline` + `SampleDao.updateLocalFields` + `_rebuildFillPayload`.

**Где:** `sample_edit_dialog.dart`, `sample_service.dart`, `sample_dao.dart`.
**Статус:** ✅ действует.

### 1.96. 2026-11-02 — Мобилка: счётчик на кнопке синхронизации

**Решение:** `SyncProvider.refresh()` после каждой офлайн-операции → `pendingCount` сразу отражает реальность. `SyncProvider.push()` / `syncAll()` → `PushResult?` → SnackBar «Отправлено: N» по реальному `sent`.

**Где:** `sync_provider.dart`, `sync_screen.dart`, `home_screen.dart`, `sample_edit_dialog.dart`, `container_detail_screen.dart`, `fill_container_content.dart`.
**Статус:** ✅ действует.

### 1.97. 2026-11-02 — Мобилка: автосинхронизация при возврате сети

**Решение:** `AuthGate` при `isOnline: false → true`:
1. **Push** — если `pendingCount + errorCount > 0`.
2. **Pull** — всегда.
3. **Один объединённый SnackBar** через `scaffoldMessengerKey`.

**Где:** `mobile/lib/main.dart` (`AuthGate._autoSync`), `sync_service.dart` (`PullStats`), `sync_provider.dart`, `sync_screen.dart`.
**Статус:** ✅ действует.

### 1.98. 2026-11-02 — Мобилка: инкрементальный Pull с `?updated_since=`

**Решение:** `SyncProvider._lastPullSince` — время последнего **успешного** Pull. При следующем Pull — `?updated_since=` в `/storage/containers/` и `/samples/`. `PullStats` = реальные изменения. `_lastPullSince` — в памяти (персистить — `ТД-62`).

**Где:** `sync_service.dart`, `sync_provider.dart`.
**Статус:** ✅ действует.

### 1.99. 2026-11-02 — Мобилка: natural sort проб

**Решение:** `naturalCompare(a, b)` — разбивает строку на куски `цифры | не-цифры`, цифры числами. Применяется в `SampleDao.getByContainerId`, `SampleService.fetchByContainerId`, `LabelData.fromContainer`.

**Где:** `mobile/lib/utils/natural_sort.dart`, `sample_dao.dart`, `sample_service.dart`, `label_data.dart`.
**Статус:** ✅ действует.

### 1.100. 2026-11-02 — Мобилка: тап на иконке сети → `pingNow()`

**Решение:** `NetworkBadge` — `IconButton` с `onPressed: () => pingNow()`. Спиннер во время пинга. `NetworkStatusProvider.pingNow()` — публичный.

**Где:** `network_badge.dart`, `network_status_provider.dart`.
**Статус:** ✅ действует.

### 1.101. 2026-11-03 — Мобилка: офлайн-создание тары (c-2d-2a)

**Решение:**
1. **`bulkCreate` при `isNetworkError`** создаёт тару локально с negative ID, кладёт в `sync_queue` с `localRef` (JSON-массив), возвращает `BulkCreateResult {count, queued}`. `pending_sync = true` → `cloud_off`.
2. **`SyncPusher` после `bulk-create`** строит маппинг `localId → serverId` **по индексу** `created_containers[i].id` (порядок гарантирован циклом `.create()`).
3. **`remapAllLocalRefs`** (идемпотентно) перемапливает `payload` (`container_id`, `container_ids[]`, `containers[].id`) и `local_ref` (int-строка, JSON-массив) в **PENDING + ERROR**.
4. **`ContainerDao.remapId`** — PK в `containers`. **`SampleDao.remapContainerId`** — колонка `container_id` + JSON `container` в `samples`.
5. **Локальный JSON тары — в серверном формате** (`container_type`, `draft_site`, `draft_research_type`), не `*_id`.
6. **`Container.fromJson`** — fallback на `*_id` (страховка от старых записей).
7. **История для negative-ID** не зовётся на сервер (`_loadHistory` guard).
8. **Проверка длины:** `created_containers.length != payload.containers.length` → маппинг пропускается, `debugPrint`.

**Причина:** без маппинга `fill-samples` / `bulk-place` на офлайн-тару уйдут с `container_id = -1` → 404. Индексный маппинг — потому что сервер не знает про `local_ref`. Полное решение (`local_ref` на сервере) — отложено.

**Где:** `mobile/lib/db/database.dart` (v8), `sync_queue_dao.dart` (`remapAllLocalRefs`), `container_dao.dart` (`remapId`), `sample_dao.dart` (`remapContainerId`), `services/sync_pusher.dart` (`_remapBulkCreate`), `services/container_service.dart` (`BulkCreateResult`), `models/container.dart` (`fromJson`), `screens/container_detail_screen.dart` (`_loadHistory`), `widgets/create_containers_dialog.dart`.
**Статус:** ✅ действует.

### 1.102. 2026-11-05 — Мобилка: офлайн-`fill-samples` / `bulk-place` на офлайн-тарах (c-2d-2c)

**Решение:**
1. **`SampleService.fillSamples`** при `containerId < 0` — сразу `sync_queue` (POST `/containers/{id}/fill-samples/`), `localRef = '$containerId'`. Сервер с negative ID не зовём (404 не `isNetworkError`).
2. **`ContainerService.bulkPlace`** при negatives в `containerIds` — всегда `sync_queue`, атомарно (все или ничего). `localRef = jsonEncode(negatives)` — только negatives, positives не трогаются.
3. **`remapEndpoint`** — после маппинга negative→server заменяет URL (`/containers/-N/fill-samples/` → `/containers/M/fill-samples/`). Regex `/containers/(-?\d+)(/|$)`, positive ID не трогает.
4. **`SyncPusher.pushAll` после `bulk-create`** перечитывает очередь (`items = await _getPendingItems()`), чтобы дочерние операции ушли с серверными URL. `processedIds` — защита от зацикливания, если `markSynced` не удалил запись.
5. **`ContainerDao.updateLocationLocal`** при офлайн-`bulkPlace` — локально обновить `containers` (`status=ACTIVE`, `cell_id`, `cell_full_address`, `floor_room`, `floor_room_name`, `pallet=null`, `updated_at`) → UI сразу видит место. `_onPlace` при `queued` перечитывает кэш через `ContainerDao.getById`.
6. **`NamedCatalog.fullAddress`** — отдельное поле из `json['full_address']`. `label` не меняется (короткий код). `PlaceContainerDialog._selectedCellAddress` → `fullAddress ?? label` (полный путь `В4/1/1/B/2` вместо `2`).
7. **`PlaceContainerDialog`** передаёт `cellFullAddress` / `floorRoomName` из справочника в `bulkPlace`.

**Причина:** без `localRef` и `remapEndpoint` — сервер получит URL `/containers/-N/fill-samples/` → 404. Без `updateLocationLocal` — пользователь не видит, куда разместил, до Push. Без `fullAddress` — в шапке показывался только код ячейки (`2`), а не полный путь.

**Где:** `mobile/lib/services/sample_service.dart` (`fillSamples` negative-ветка, `_queueFillSamples`), `container_service.dart` (`bulkPlace`, `_applyLocalPlace`), `db/sync_queue_dao.dart` (`remapEndpoint`), `services/sync_pusher.dart` (`pushAll` reload + `processedIds`), `db/container_dao.dart` (`updateLocationLocal`), `models/catalog.dart` (`NamedCatalog.fullAddress`), `widgets/place_container_dialog.dart`, `screens/container_detail_screen.dart` (`_onPlace`).
**Статус:** ✅ действует.

### 1.103. 2026-11-05 — Мобилка: офлайн-редактирование шапки тары (c-8b)

**Решение:**
1. **`ContainerService.update`** при `isNetworkError` → `sync_queue` (PATCH `/containers/{id}/`), `ContainerDao.updateFieldsLocal` (мержит поля в JSON `containers.data`), `setPendingSync(id, true)`. Возвращает `UpdateOutcome {online, queued}`.
2. **`SyncPusher._defaultOnSuccess`** — regex `^/storage/containers/(\d+)/$` (PATCH контейнера) → `ContainerDao.clearPendingSync(id)`.
3. **`_onSaveEdit`** при `queued` — перечитать кэш через `ContainerDao.getById`, `setState`, SnackBar «Сохранено офлайн. Отправится при синхронизации.».
4. **UI (`c-8b-fix-1`):** `_openEditSheet` — `useSafeArea: true`, высота = `MediaQuery.size.height − viewInsets.bottom − padding.bottom`, × 0.9. `ContainerEditForm` — `Form(Column(Expanded(ListView), sticky bottomBar))`, кнопка «Сохранить» в `SafeArea(top: false)` вне `ListView` — не уезжает под системный бар Android.

**Причина:** без `sync_queue` офлайн-редактирование шапки падало «Не удалось сохранить». Без `clearPendingSync` иконка `cloud_off` не пропадала после Push. UI-фикс — кнопка «Сохранить» уезжала под navigation bar при скролле.

**Где:** `mobile/lib/services/container_service.dart` (`update`, `UpdateOutcome`), `db/container_dao.dart` (`updateFieldsLocal`), `services/sync_pusher.dart` (`_defaultOnSuccess`, regex PATCH containers), `screens/container_detail_screen.dart` (`_onSaveEdit`, `_openEditSheet`), `widgets/container_edit_form.dart` (sticky bottom bar).
**Статус:** ✅ действует.

---

### 1.104. 2026-11-05 — Мобилка: офлайн-редактирование шапки — фикс классификации ошибок и `*_name` (c-8b-fix-2)

**Решение:**
1. **`ContainerService.update`** при `ApiException` с `statusCode` в 4xx — `rethrow` (валидация сервера, в очередь не кладём). При **всём остальном** (сеть, таймауты, 5xx, `statusCode == null`, `unknown`) и при любом другом исключении (`catch (_)`) — `_queueUpdateLocal` + `UpdateOutcome.queued`.
2. **`ContainerEditForm` payload** обогащается `container_type_name` / `draft_site_name` / `draft_research_type_name` — из справочника или fallback из `initial`. `ContainerDao.updateFieldsLocal` их мержит. `Container.fromJson` читает имена из `*_name` → UI сразу видит новое имя. Сервер (`ContainerSerializer`) эти поля **read_only**, DRF игнорирует.
3. **Лейблы шапки тары и формы** — без «(черновик)»: «Участок», «ТИ», «Н/З (тек.)», «Н/З (вх.)».

**Причина:**
- `api_client.dart` классифицирует `DioExceptionType.unknown` без `statusCode` как `isNetworkError = false`. Плюс возможны `transformTimeout` (будущие типы Dio). `update` раньше делал `if (!e.isNetworkError) rethrow` → ошибка офлайн → «Не удалось сохранить: требуется подключение к серверу». Теперь ловим всё, кроме явных 4xx.
- `Container.fromJson` показывает `containerTypeName` / `draftSiteName` / `draftResearchTypeName`. Payload слал только ID → имена не обновлялись, показывались старые/пустые. `*_name` в payload решает **для локального кэша**; на сервер уходит только `*_id`.
- «(черновик)» в лейблах — технический хвост от draft-полей. В UI лишний шум.

**Где:** `mobile/lib/services/container_service.dart` (`update`, `_queueUpdateLocal`), `mobile/lib/widgets/container_edit_form.dart` (`_save`, `_containerTypeName`, `_siteName`, `_researchTypeName`, лейблы), `mobile/lib/screens/container_detail_screen.dart` (`_buildHeader` — лейблы).

**Статус:** ✅ действует.

## 2. Что не делаем и почему

- Не используем SampleParts — разделение вне WMS.
- Не храним две колонки для Н/З — не масштабируется.
- Не заставляем лаборатории использовать наш формат.
- Не переклеиваем старые этикетки.
- Не используем закрытые лицензии в ядре.
- Не создаём кастомную модель User.
- Не используем Django fixtures для seeds.
- Не запускаем Django-команды через кнопку «Run» в VS Code.
- Не клеим QR на поддоны и пробы в MVP.
- Не удаляем пробы физически без явного DELETE с обработкой ProtectedError.
- Не блокируем размещение при превышении вместимости.
- Не реализуем bin packing и учёт веса в MVP.
- Не реализуем логику керна в MVP.
- Не патчим миграции v1 через 0002.
- Не используем session-based auth для API.
- Не пишем OpenAPI вручную.
- Не создаём SampleDecryption на MVP.
- Не парсим номер пробы позиционно.
- Не навязываем свой формат Excel.
- Не используем pillow 10.4 (11.3).
- Не полагаемся на сортировку кириллицы в БД.
- Не импортируем модели напрямую при циклах.
- Не печатаем ID под QR (внутри payload).
- Не масштабируем шрифт этикетки вниз — 10 pt всегда.
- Не разрываем этикетку между листами A4.
- Не используем A5 как лист печати.
- Не используем Django signals для sync-логики (1.58).
- Не используем Django signals для аудита (1.70).
- Не создаём тару с обязательным container_number в bulk-create (1.60).
- Не считаем container_number глобально уникальным (1.61).
- Не задаём маппинг PENDING_FILLING → Sample.status (1.62).
- Не используем полные этикетки тары для QR секций/ячеек (1.63).
- Не обнуляем draft-поля после fill-samples (1.69).
- Не используем baseUrl в tsconfig.json (TS ≥4.4).
- Не пишем аудит через Django signals (1.70).
- Не считаем print_batch_status = CANCELLED (1.71).
- Не коммитим сертификаты прокси и локальные Maven-пути (1.73).
- Не делаем автоматическое слияние конфликтов синхронизации — last write wins.
- Не хардкодим IP в config.dart — только String.fromEnvironment или probe (1.80).
- Не пишем healthcheck в /api/v1/ — вне, без авторизации (1.78).
- Не принимаем ?updated_since= без таймзоны — naive → 400 (1.79).
- Не используем Barcode.scaleCorners — не учитывает landscape (1.81).
- Не полагаемся на native scanWindow — фильтруем вручную (1.81).
- Не используем WidgetsBindingObserver для heartbeat сети (был регресс в c-6f, 1.82).
- Не разрешаем синхронизацию при isPendingOffline (1.83).
- Не держим форму шапки в вкладке «Редактирование» — там FillContainerContent как в вебе (1.86).
- Не дублируем ТИ / Н/З под каждой пробой — они в шапке тары (1.85, c-7f-fix).
- Не храним историю сканов как List<int> — только ScanHistoryEntry с JSON (1.89).
- Не выдаём git add без git status --short | grep "mobile/lib" (1.90).
- Не выдаём код нового захода, пока предыдущий не закоммичен (1.91).
- Не показываем [Местоположение] для тары без ячейки (`hasCell = cellId != null`, 1.92).
- Не открываем PlaceContainerDialog по кнопке [Местоположение] (1.92).
- Не трогаем SyncPusher / SyncQueueDao для offline-place — обычный POST покрывает операцию (1.92).
- Не считаем, что Pull нужен только для containers/samples (1.93).
- Не делаем lazy-кэш истории — только pre-fetch в Pull (1.93).
- Не пересоздаём `sync_queue` при миграции SQLite — там несохранённые изменения (1.93).
- Не перезаписываем пробы с `_pending_sync = 1` при Pull (1.94).
- Не скрываем `_pending_sync` от UI — иконка `cloud_off` (1.94).
- Не пишем `_pending_sync` в SQLite при миграции v6→v7 через `DROP` — только `ALTER` (1.94).
- Не разрешаем редактировать `sample_number` у серверной пробы офлайн (только у офлайн-проб) (1.95).
- Не считаем «Нечего отправлять» по `pendingCount` — только по `PushResult.sent` (1.96).
- Не запускаем автосинхронизацию при `isPendingOffline` (1.97).
- Не делаем Pull с `updated_since` для справочников — там нет `updated_since` (1.98).
- Не сортируем пробы по `id` — только по `sample_number` natural (1.99).
- Не вызываем `pingNow` из прод-кода без снятия `@visibleForTesting` (1.100).
- Не маппим ID по `local_ref` с сервера — порядок `created_containers` гарантирован циклом `.create()` (1.101).
- Не пишем локальный JSON тары в `*_id` формате — только серверный (`container_type`, `draft_site`, `draft_research_type`) (1.101).
- Не ходим в историю тары при negative-ID (1.101).
- Не зовём сервер `fill-samples` / `bulk-place` с negative-ID — сервер их не знает (1.102).
- Не делаем `bulkPlace` смешанных списков (negatives + positives) онлайн-только — атомарно в очередь (1.102).
- Не перечитываем `sync_queue` после каждой операции в `pushAll` — только после `bulk-create` + `processedIds` (1.102).
- Не отображаем короткий код ячейки в шапке — только полный `full_address` при наличии (1.102).
- Не делаем `ContainerService.update` онлайн-только — офлайн через `sync_queue` (1.103).
- Не держим кнопку «Сохранить» в `ListView` формы тары — sticky bottom (1.103).

- Не полагаемся на `e.isNetworkError` в `update` — ловим `catch (_)` для всех не-4xx (1.104).
- Не отображаем «(черновик)» в лейблах шапки тары и формы (1.104).

---

## 3. Глоссарий

### Данные

| Термин | Что значит |
|---|---|
| Проба (Sample) | Физическая единица хранения = навеска. |
| Навеска | То же, что Проба. |
| Наряд-заказ (Н/З) | Группа проб. INCOMING / CODED. |
| Тип исследования (ТИ) | ResearchType. ШЛ, ХА, ИЗ. |
| Участок (Site) | Место отбора проб. |
| Лаборатория (Laboratory) | Откуда пришла проба. |
| Тара (Container) | Физический контейнер. |
| Тара-заготовка | Container без container_number, с draft-полями, PENDING_FILLING. |
| Draft-поля тары | draft_site, draft_research_type, draft_work_order_coded, draft_work_order_incoming. |
| Тип тары (ContainerType) | Общий или для конкретной лаборатории. |
| Поддон (Pallet) | «Тихий» объект. OneToOne с ячейкой. |
| Ячейка (Cell) | Место на ярусе. 1 поддон. |
| Секция | Пролёт с 4 ярусами A–D. |
| Скважина (Well) | Источник пробы. |
| Партия (Receipt) | Группа тары, приехавшая одной машиной. |
| Рейс (Shipment) | Отправка. INBOUND / OUTBOUND. |
| Партия печати (PrintBatch) | Корзина тар для массовой печати. |
| Группа (Н/З × ТИ) | Контекст, внутри которого номер тары уникален. |
| AuditLog | Журнал значимых действий. log_audit() (1.70). |
| print_batch_status | Статус последней не-CANCELLED партии печати (1.71). |
| Health-эндпоинт | GET /health/ — 200 без авторизации (1.78). |
| `local_ref` | Локальный ID (negative) в `sync_queue` для маппинга в `bulk-create` (1.101). |
| `BulkCreateResult` | `{count, queued}` — результат `bulkCreate` (1.101). |
| `remapAllLocalRefs` | Идемпотентная замена negative → server ID в payload + `local_ref` + endpoint всех записей очереди (1.101, 1.102). |
| `remapEndpoint` | Замена `/containers/-N/...` → `/containers/M/...` в endpoint (1.102). |
| `processedIds` | `Set<int>` в `SyncPusher.pushAll` — защита от повторной обработки после reload (1.102). |
| `UpdateOutcome` | `online` / `queued` — результат `ContainerService.update` (1.103). |
| `updateFieldsLocal` | `ContainerDao`: мерж полей в JSON `containers.data` + `updated_at` (1.103). |
| `container_type_name` / `draft_site_name` / `draft_research_type_name` | Денормализованные имена в payload формы для локального кэша (1.104). |

### Процесс

| Термин | Что значит |
|---|---|
| Шифровка | Присвоение Н/З нового названия. |
| Приёмка | Поступление тары. |
| Двухфазная приёмка | Excel → предзаполнение → подтверждение. |
| Акт приёмки | PDF с расхождениями (1.50). |
| Формирование поддона | Сбор тар на поддон. |
| Выборка (picking) | Извлечение проб по списку. |
| Отправка (shipment) | Группа проб. |
| Утилизация | Soft-delete (DISPOSED). |
| Инвентаризация | Сверка физического наличия. |
| Расхождение (issue) | Проблема по инвентаризации. |
| Помощник по сортировке | Рекомендация места. |
| Префикс | Код участка или лаборатории в номере пробы. |
| Партия (шифр) | 5 цифр в шифрованном номере. |
| Порядковый номер (sequence) | Последние цифры номера пробы. |
| Портал лаборатории | Веб-раздел для лабораторий. |
| Продолжение этикетки | Вторая этикетка без шапки. |
| Sync-сервис | Явная функция синхронизации статусов (1.58). |
| Аудит | Журнал действий с объектом (1.70). |
| Deferred Offline Login | Вход по QR без сети (1.75). |
| Offline-печать | PDF на мобилке без сервера (1.77). |
| Auto-detect сети | Probe /health/ → выбор apiBaseUrl (1.80). |
| ScanWindow | Мёртвая зона 220×220 (1.81). |
| Incremental Pull | ?updated_since= (1.79, 1.98). |
| NetworkStatusProvider | Heartbeat /health/ 10 с, isOnline, auto-switch (1.82). |
| NetworkBadge | Иконка cloud_done / cloud_off / vpn_key в AppBar (1.82, 1.100). |
| ContainerEditForm | Форма шапки тары в bottom sheet (1.86, 1.103). |
| FillContainerContent (mobile) | Вкладка «Редактирование» (1.87). |
| ScanHistoryEntry | Снимок истории сканов Н/З · ТИ · номер (1.89). |
| SampleEditDialog (mobile) | Диалог редактирования пробы (1.88). |
| SampleStatusChip | Цветной чип статуса пробы (1.88). |
| LabelData (offline) | Модель для offline-рендера PDF (1.77). |
| label_pdf_generator | Offline-рендер PDF на Dart (1.77). |
| NamedCatalog | Универсальный `{id, label, fullAddress?}` для каскада (1.92, 1.102). |
| PlaceOutcome | Результат `bulkPlace`: `online` / `queued` (1.92). |
| ContainerLocationDialog | Диалог «где тара» — адрес (1.92). |
| CatalogDao | DAO кэша справочников (1.93). |
| ContainerHistoryDao | DAO кэша истории тары (1.93). |
| Pre-fetch истории | Загрузка истории тар в Pull (1.93). |
| Sample.pendingSync | Флаг: серверная проба правилась офлайн (1.94). |
| Sample.needsSync | В UI показывать `cloud_off` (1.94). |
| Reconcile | Сброс `_pending_sync`, если записи в `sync_queue` нет (1.94). |
| PushResult | Результат `pushAll`: `sent`, `failed` (1.96). |
| PullStats | Результат `pullAll`: `containers`, `samples`, `total` (1.98). |
| `_lastPullSince` | Время последнего Pull, для `?updated_since=` (1.98). |
| naturalCompare | Естественная сортировка с числами (1.99). |
| `remapId` | `ContainerDao`: PK тары negative → server (1.101). |
| `remapContainerId` | `SampleDao`: `container_id` пробы negative → server, колонка + JSON (1.101). |
| `updateLocationLocal` | `ContainerDao`: локально обновить место + `status=ACTIVE` при офлайн-`bulkPlace` (1.102). |

### Инфраструктура

| Термин | Что значит |
|---|---|
| Docker Compose | PG в контейнере (домашний ПК). |
| Портативный PostgreSQL | PG без установки (рабочий ПК). |
| poetry run | Запуск в venv. |
| JWT | JSON Web Token. |
| drf-spectacular | Генератор OpenAPI 3. |
| fpdf2 | Генерация PDF (Python). |
| Proxy Bypass | Набор настроек рабочего ПК (1.73). |
| adb reverse | Проброс порта ПК на планшет через USB. |
| FLUTTER_STORAGE_BASE_URL | Зеркало engine-артефактов Flutter. |
| scaffoldMessengerKey | Глобальный ключ SnackBar (1.97). |

### UI

| Термин | Что значит |
|---|---|
| Дашборд | Главный экран. |
| Сканер | Экран сканирования. |
| Виртуальный вид секции | Ярусы A–D и ячейки. |
| Корзина печати | Пул тар для массовой печати. |
| Единое окно тары | ContainerDetailDialog (1.72). |
| Модалка предпросмотра | ContainerPreviewDialog (1.72). |
| SyncScreen | Экран ручной синхронизации. |
| Drawer | Гамбургер-меню разделов (c-9-drawer). |

---

## 4. Что НЕ значат эти термины

- «Часть пробы» — не используется. Есть навеска.
- «Логическая проба» — не сущность в системе.
- «Ячейка» — не слот на 3 поддона. 1 поддон.
- «Поддон» — «тихий» объект, без QR.
- «Наряд-заказ» — входящий и зашифрованный — разные строки.
- «Проба» — не уникальна по номеру.
- «User» — Django-овский.
- «Справочник» — редактируемый, не жёсткий choices.
- «Префикс» — не часть sequence.
- «Партия в номере» — не Receipt.
- «Рейс» — не одна тара.
- «ContainerType.laboratory = NULL» — не «без лаборатории», а «общий тип».
- «Тара-заготовка» — не «пустая тара физически». Это Container без container_number.
- «Container.container_number» — не уникален глобально (1.61).
- «PENDING_FILLING» — состояние в системе (1.62).
- «Draft-поля тары» — обновляются актуальными значениями (1.69).
- «baseUrl в tsconfig.json» — не используется.
- «AuditLog» — не Django signals, только явные вызовы (1.70).
- «print_batch_status» — не «все партии», только последняя не-CANCELLED (1.71).
- «ContainerDetailDialog» — не «редактор», а просмотр + действия (1.72).
- «Proxy Bypass» — не «взлом прокси». Легальная настройка (1.73).
- «Deferred Offline Login» — не «вход без пароля», а отложенная синхронизация токена.
- «Health-эндпоинт» — не «API v1». Вне /api/v1/, без авторизации (1.78).
- «?updated_since=» — не «фильтр для Web». Только для Mobile Pull (1.79).
- «Auto-detect» — не «выбор по IP-адресу в коде», а probe /health/ (1.80).
- «ScanWindow» — не «native-ограничение», а _pickBarcodeInScanWindow (1.81).
- «NetworkStatusProvider» — не NetworkMonitor (тот откачен, 1.82).
- «FillContainerContent» на mobile — не диалог, а вкладка (1.87).
- «ScanHistoryEntry» — не полный Container, только снимок (1.89).
- «ContainerEditForm» — не «редактор вкладки», а bottom sheet (1.86).
- «Н/З · ТИ · номер» — именно в этом порядке (c-7h-fix).
- «Местоположение» на мобилке — не переход в топологию и не размещение, а диалог с адресом (1.92).
- «PlaceOutcome.queued» — не ошибка, а отложенная операция в `sync_queue` (1.92).
- «Pull» — не только containers/samples. Справочники + история всех тар (1.93).
- «Кэш истории» — не lazy. Pre-fetch в Pull (1.93).
- «_pending_sync = 1» — не «есть правка», а «есть правка, ещё не ушедшая на сервер». Сбрасывается после Push или Pull (1.94).
- «pendingCount» — не «число правок», а «число записей в `sync_queue` со статусом PENDING» (1.96).
- «85 загружено» — не «85 изменений», а «85 тар в ответе сервера». После `updated_since` — реальные изменения (1.98).
- «natural sort» — не сортировка по `id`, а по `sample_number` (числа числами) (1.99).
- «pingNow» — не «перезапуск heartbeat», а один цикл `_ping()` (1.100).
- «local_ref» — не «серверное поле». Только локальное, для маппинга на `bulk-create` (1.101).
- «Маппинг по индексу» — не «по `local_ref` с сервера». Порядок гарантирован циклом `.create()` (1.101).
- «`container_type_id` в локальном JSON» — не формат. В кэше — `container_type` (серверный), fallback на `_id` только для старых записей (1.101).
- «remapEndpoint» — не «переименование поля», а замена ID в URL (1.102).
- «processedIds» — не «все обработанные», а «обработанные с последнего reload» (1.102).
- «`fullAddress` в NamedCatalog» — не «полный адрес всегда». Только если сервер отдаёт `full_address` в JSON (1.102).
- «UpdateOutcome.queued» — не ошибка, а отложенная операция PATCH в `sync_queue` (1.103).
### 1.102. 2026-11-06 — Мобилка: офлайн-создание справочников и защита от перезаписи (c-8-catalog-create-offline)

**Решение:**
1. CatalogService.create при isNetworkError создает локальный справочник (negative ID) и кладет POST в sync_queue с localRef.
2. SyncPusher._defaultOnSuccess ловит успешный POST к /sites/ и др. Берет responseData id, вызывает CatalogDao.remapId и SyncQueueDao.remapAllLocalRefs.
3. ContainerDao.saveAll больше не перезаписывает тару, если у нее pending_sync = 1.
4. SyncService._reconcile не сбрасывает pending_sync, если в очереди есть незавершенный bulk-create.

**Причина:** без маппинга ID тара уходила на сервер с отрицательным draft_site_id и падала с 400. Без защиты saveAll Pull затирал внесенные офлайн изменения.

**Где:** catalog_service.dart, sync_pusher.dart, sync_queue_dao.dart, sync_service.dart, container_dao.dart.
**Статус:** ✅ действует.

---

### 1.105. 2026-11-06 — Мобилка: ручная смена статуса тары в шапке (c-8b-status)

**Решение:**
1. В `ContainerEditForm` добавлен dropdown `status` — 5 значений (`PENDING_FILLING`, `PENDING_PLACEMENT`, `ACTIVE`, `IN_TRANSIT`, `ISSUED`). Служебный `unknown` скрыт.
2. Отправка через `ContainerService.update` (PATCH `/storage/containers/{id}/`). Офлайн-ветка (`isNetworkError`) уже существует с `c-8b-fix-2` — кладет в `sync_queue`, обновляет `ContainerDao.updateFieldsLocal`.
3. В `Container.fromJson` добавлена обратная функция `containerStatusToApi` (enum -> строка).

**Причина:** пользователь должен иметь возможность ручного перевода (например, `ACTIVE` -> `ISSUED` при выдаче). До этого статусы менялись только автоматически (`fill-samples`, `bulk-place`).

**Где:** `mobile/lib/models/container.dart`, `mobile/lib/widgets/container_edit_form.dart`, `mobile/test/services/container_service_test.dart`.
**Статус:** ✅ действует.


### 1.106. 2026-11-06 — Мобилка: фикс клавиатуры над окном шапки в landscape (c-9-overflow-fix-4)

**Решение:** в `_openEditSheet` вернуть `Padding(bottom: insets)` + высоту `SizedBox` = `(H - insets) * 0.95`. Общая высота `(H - insets) * 0.95 + insets` всегда < H — overflow не будет, окно над клавиатурой.

**Причина:** `c-8b-fix-4` убрал `Padding`, чтобы избежать overflow, но в landscape клавиатура перекрывала окно.

**Где:** `mobile/lib/screens/container_detail_screen.dart` (`_openEditSheet`).
**Статус:** ✅ действует.


### 1.107. 2026-11-06 — Контекстные подсказки (c-2.x-smart-input-bundle-1)

**Решение:** эндпоинт `GET /storage/suggestions/?site=&work_order=&research_type=` возвращает уникальные `work_orders`, `research_types`, `samples`, `wells` по контексту. На фронте — `SmartAutocomplete` (MUI Autocomplete + freeSolo) для полей Н/З, ТИ, диапазон проб.

**Причина:** пользователь не должен вводить одно и то же (Н/З, префикс, скважину) при заполнении 3-5 тар одного Н/З.

**Где:** `backend/apps/storage/views.py::SmartInputSuggestionsView`, `web/src/components/SmartAutocomplete.tsx`, `CreateContainersDialog.tsx`, `FillContainerContent.tsx`.
**Статус:** ✅ действует.


### 1.108. 2026-11-06 — Подсказки диапазона: база + auto-dash (c-2.x-smart-input-bundle-2)

**Решение:** в поле «Диапазон проб» подсказки — базовые части (`TST1209`), без sequence. При выборе подсказки автодобавляется `-` (`TST1209-`), пользователь дописывает диапазон (`031` или `001-031`). Из списка скрыты базы, у которых все пробы уже добавлены.

**Причина:** ввод `TST1209` без `-` не работает (парсер требует sequence). Показ полного `TST120901` → пользователь случайно вводит одну пробу вместо диапазона. Скрытие использованных — меньше шума при 3-5 тарах одного Н/З.

**Где:** `web/src/components/SmartAutocomplete.tsx` (`appendOnSelect`), `FillContainerContent.tsx` (`baseSampleOptions`).
**Статус:** ✅ действует.


### 1.109. 2026-11-06 — Статусы тары: DISPOSED + is_disposable

**Решение:**
1. `Container.status` — добавляем `DISPOSED` (Утилизирована). Итого: `PENDING_FILLING` / `PENDING_PLACEMENT` / `ACTIVE` / `IN_TRANSIT` / `ISSUED` / `DISPOSED`.
2. UI-метка `ACTIVE` = «Размещена» (было «Активна» в вебе, «Размещена» в мобилке — синхронизируем на «Размещена»).
3. `ContainerType.is_disposable` (boolean, default `false`) — флаг «одноразовая тара».
4. При утилизации последней пробы в таре: `is_disposable=true` → `Container.status=DISPOSED`; `is_disposable=false` → `PENDING_FILLING` (переиспользование, этикетку сорвать).
5. Возврат тары (была `ACTIVE`, вывезли, вернули): `PENDING_PLACEMENT` (полный цикл приёмки, даже если место известно). Пробы могли быть перешифрованы — нужна проверка.

**Причина:** одноразовые коробки должны уходить в утиль, многоразовые ящики — возвращаться в оборот. Без флага не знаем, что делать с записью после утилизации проб.

**Где:** `backend/apps/storage/models.py` (`ContainerType.is_disposable`, `Container.DISPOSED`), `backend/apps/samples/services.py::_handle_container_after_dispose`.
**Статус:** ✅ действует (решение принято, реализация — пачки `c-2.x-lifecycle-*`).


### 1.110. 2026-11-06 — Статусы пробы: убираем CONSUMED, синхронизация с тарой

**Решение:**
1. Из `Sample.status` убираем `CONSUMED` (Израсходована). Итого: `IN_STORAGE` / `IN_TRANSIT` / `ISSUED` / `DISPOSED` / `PENDING_DECRYPTION` / `PENDING_PLACEMENT` / `SELECTED`.
2. Проба синхронизируется с тарой: тара `IN_TRANSIT` → проба `IN_TRANSIT`. Тара `PENDING_PLACEMENT` → проба `PENDING_PLACEMENT`. Тара `ACTIVE` → проба `IN_STORAGE`.
3. `PENDING_DECRYPTION` — только у пробы (не у тары). Шифруются `WorkOrder` и `Sample`, тара — просто контейнер.

**Причина:** «Израсходована» — не состояние пробы, а событие (её просто больше нет в наличии). Учёт ведётся через `DISPOSED` (soft-delete). Шифровка — на уровне наряда и пробы, не тары.

**Где:** `backend/apps/samples/models.py` (STATUS_CHOICES), `backend/apps/samples/services.py::sync_sample_status_for_container` (расширить), `web/src/api/samples.ts`, `mobile/lib/models/sample.dart`.
**Статус:** ✅ действует (решение принято, реализация — пачки `c-2.x-lifecycle-*`).


### 1.111. 2026-11-06 — origin_laboratory_id на уровне Container

**Решение:** добавляем `Container.origin_laboratory_id` (FK → `Laboratory`, nullable). Одна лаборатория на тару (пробы одной тары почти всегда из одного источника).

Заполнение:
- При создании тары через приёмку (`Receipt.laboratory_id` → `Container.origin_laboratory_id`).
- При создании тары вручную — опционально в `CreateContainersDialog` (поле «Лаборатория-источник»).
- При `fill-samples` — если передано в payload, иначе остаётся `null`.

**Причина:** для нешифрованных проб `Laboratory` сейчас не хранится вообще (теряется). Для шифрованных — можно по префиксу, но это ненадёжно. `Container.origin_laboratory_id` — минимальный уровень, покрывающий 95% случаев.

**Где:** `backend/apps/storage/models.py` (`Container.origin_laboratory_id`), `backend/apps/storage/serializers.py`, `web/src/api/containers.ts`, `mobile/lib/models/container.dart`.
**Статус:** ✅ действует (решение принято, реализация — пачки `c-2.x-lifecycle-*`).


### 1.112. 2026-11-06 — ShipmentContainerItem: тары в рейсе (c-2.x-shipments-1)

**Решение:** для OUTBOUND-рейсов тары хранятся в новой таблице `ShipmentContainerItem` (`shipment` + `container` + `position`). Старая `ShipmentItem` (пробы) остаётся для INBOUND и смешанных случаев. `Shipment.containers_count` для OUTBOUND считается из `container_items`, для INBOUND — из `receipts`.

**Также:**
- `Shipment.name` — человекочитаемое название (опционально).
- `Shipment.sent_at` — переделан с `auto_now_add=True` на `null=True` (баг: ставился при создании, а не при отправке).
- `shipment_number` — генерируется на бэкенде: `ОТ-YYYY-NNN` (OUTBOUND), `ПР-YYYY-NNN` (INBOUND).
- Custom actions: `add-containers`, `remove-container`, `send`. При `send` все тары → `IN_TRANSIT`, пробы синхронизируются.

**Причина:** в OUTBOUND тара едет целиком с пробами (не перекладываются). Хранить тару удобнее чем перечислять 30 проб. INBOUND остаётся через Receipt (там уже работает).

**Где:** `backend/apps/picking/models.py`, `serializers.py`, `views.py`, миграция `picking/0004_...`.
**Статус:** ✅ действует.


### 1.113. 2026-11-06 — origin_laboratory: «Откуда» / «Куда» в рейсе (c-2.x-shipments-2-fix)

**Решение:** в `Shipment` добавлено `origin_laboratory` (FK → `Laboratory`, null). В UI: «Откуда» / «Куда». «Участок» (`site`) скрыт для OUTBOUND (показывается только для INBOUND).

**Причина:** для OUTBOUND-рейса «Куда едет» — главное, «Откуда едет» — тоже нужно (какой склад/лаборатория отправил). «Участок» — это про пробы (для INBOUND), в OUTBOUND не нужен.

**Где:** `backend/apps/picking/models.py`, миграция `picking/0005_...`, `web/src/pages/ShipmentDetailPage.tsx`, `CreateShipmentDialog.tsx`.
**Статус:** ✅ действует.


### 1.114. 2026-11-06 — Автосоздание организации из Autocomplete (c-2.x-shipments-2-fix-2)

**Решение:** в форме создания рейса поля «Откуда» / «Куда» — `Autocomplete freeSolo`. Если ввести имя, которого нет в справочнике «Лаборатории», при нажатии «Создать» организация создаётся автоматически (`code` = имя без пробелов в верхнем регистре, `prefixes=[]`).

**Причина:** вводить организацию каждый раз заново (или сначала идти в «Справочники» → создавать) — долго. Хочется ввести в один клик.

**Где:** `web/src/components/CreateShipmentDialog.tsx`.
**Статус:** ✅ действует.


### 1.115. 2026-11-06 — Перекладывание проб при отправке (решение В)

**Решение:** при отправке в лабораторию — два варианта, выбор кладовщика:
1. Вся тара едет целиком (все пробы в ней).
2. Часть проб перекладывается в транспортную тару (только нужные).

Подвопросы:
- **3.1 (А):** при перекладывании проба остаётся той же (`Sample.id`), меняется `container_id` → новая тара. История — в `AuditLog` (старая тара, новая тара).
- **3.2 (А):** исходная тара остаётся `ACTIVE` с оставшимися пробами (не переходит в `PENDING_PLACEMENT`/`PENDING_FILLING`).
- **3.3 (А):** транспортная тара создаётся вручную (`+ Создать тару`) → потом добавляется в рейс. Без «виртуальных» упаковок и автосоздания.
- **3.4 (А):** перекладывание — в одном диалоге «Добавить тары в рейс»: выбрать «Переложить пробы» → выбрать пробы → они переезжают в новую тару → новая тара попадает в рейс.
- **3.5 (отложено):** возврат остатков от лаборатории — отдельная серия `2.x-lab-portal`.

**Причина:** на практике иногда нужна вся тара целиком (экономия времени), иногда — только часть проб (например, 5 из 31). Жёсткое правило «только целиком» или «только перекладывать» не подходит.

**Реализация:** пока нет (MVP — только вариант 1, тара целиком). Будет реализовано в отдельной пачке `c-2.x-lifecycle-3` (после остальных вопросов).

**Где:** `backend/apps/picking/models.py` (`ShipmentItem` для проб — сейчас есть, но не используется в OUTBOUND), `web/src/components/AddContainersToShipmentDialog.tsx` (новая модалка «Переложить»), `backend/apps/picking/views.py` (новый action `repack-samples`).
**Статус:** 🟡 решение принято, реализация — отложена.


### 1.116. 2026-11-06 — Возврат от лаборатории: новый объект (вопрос 4 = А)

**Решение:** при возврате от лаборатории — **новый объект** (`Container` + `Sample` с новыми `id`). Старый `Container` остаётся в истории (`ISSUED` / `DISPOSED`). Связь — через `parent_container_id` / `parent_sample_id` (см. решение 1.119).

**Причина:** лаборатория возвращает «остатки» — часть проб израсходована, часть перешифрована (новый Н/З, новая этикетка). Мы не знаем, что они делали. Сопоставлять по старому `id` ненадёжно. Новый объект + `parent_*` даёт полную цепочку «тара A → лаборатория → вернулась как B → уехала → вернулась как C».

**Исключение:** если физическая тара не менялась и лаборатория вернула всё без изменений — можно обновить старый объект (это кейс `2.x-lab-portal`, там обсудим).

**Где:** `backend/apps/storage/models.py` (добавить `parent_container_id`), `backend/apps/samples/models.py` (добавить `parent_sample_id`).
**Статус:** 🟡 решение принято, реализация — в `2.x-lab-portal`.


### 1.117. 2026-11-06 — Н/З не закрывается автоматически (вопрос 5 = Б)

**Решение:** при отправке рейса статус `WorkOrder` **не меняется**. Остаётся `ACTIVE`. Закрытие (`COMPLETED` / `CANCELLED`) — только вручную менеджером.

**Причина:** могут быть пробы, которые вернутся (остатки). Могут быть новые пробы в тот же Н/З (добавлены позже). Могут быть частичные отправки. Автозакрытие сломает эти сценарии.

**Где:** `backend/apps/work_orders/models.py` (без изменений), `backend/apps/picking/views.py` (при `send` не трогаем `WorkOrder`).
**Статус:** ✅ действует.


### 1.118. 2026-11-06 — Шифрование: legacy_data + sample_number + work_order_number (вопрос 6 = А+А2)

**Решение:** при шифровке пробы — сохраняем в `Sample.legacy_data` (JSONB):
- `sample_number` — номер до шифровки.
- `work_order_number` — Н/З до шифровки.

Формат шифрования пока неизвестен — `legacy_data` заполняется вручную при шифровке (или автоматически, когда узнаем).

**Причина:** `SampleDecryption` (отдельная таблица) уже отменена в решении 1.42. `legacy_data` (JSONB) — гибко, без новых таблиц. Двух полей (`sample_number` + `work_order_number`) достаточно для «найти пробу по старому номеру» / «вернуть в исходный Н/З». Остальное восстанавливается через `WorkOrder.linked_order`.

**Где:** `backend/apps/samples/models.py` (`legacy_data` уже есть), ничего не меняем в модели. Заполнение — при `update` / `encrypt` в `2.x-lifecycle`.
**Статус:** 🟡 решение принято, реализация — в `2.x-lifecycle-impl`.


### 1.119. 2026-11-06 — parent_container_id / parent_sample_id (вопрос 7 = А)

**Решение:** добавляем `Container.parent_container_id` (FK → `Container`, null) и `Sample.parent_sample_id` (FK → `Sample`, null). Хранится только **direct parent** (1 уровень). Полное дерево — рекурсией в Python (не в БД).

**Когда заполняется:**
- При **возврате от лаборатории** (создан новый объект, см. 1.116) — `parent_*` указывает на старый объект.
- При **перекладывании проб** (вопрос 3, вариант В) — **НЕ заполняется**. Проба та же (`Sample.id`), меняется только `container_id`. Это не «потомок», это «переезд».

**Причина:** materialized path (Б) и closure table (В) — избыточно для наших сценариев. Direct parent покрывает 99% случаев (цепочка A→B→C для аудита). Если понадобится «всё дерево одним SQL» — добавим `path` позже (без переделки модели).

**Где:** `backend/apps/storage/models.py` (`parent_container_id`), `backend/apps/samples/models.py` (`parent_sample_id`).
**Статус:** 🟡 решение принято, реализация — в `2.x-lab-portal`.


### 1.120. 2026-11-06 — Кто меняет статусы (вопрос 8)

**Решение:** два механизма — автоматический и ручной.

**Автоматически** (при ключевых событиях):
- `Shipment.send` → все тары рейса `IN_TRANSIT`, пробы синхронизируются.
- `Receipt.complete` → `Shipment.RECEIVED` (для INBOUND).
- `Sample.dispose` (последняя в таре) → `Container.DISPOSED` (если `is_disposable`) или `PENDING_FILLING` (см. 1.109).
- `bulk-place` → `Container.ACTIVE`, пробы `IN_STORAGE`.

**Вручную** — через edit-форму тары/пробы (`ContainerEditDialog` в вебе, `ContainerEditForm` в мобилке). Свободное переключение любого статуса (без валидации переходов).

**Причина:** автоматика для нормальных сценариев, ручное — для исключений (ошибка, форс-мажор). State machine (жёсткие переходы) — откладываем; добавим, если начнутся ошибки «нельзя так делать».

**Где:** `backend/apps/picking/views.py` (`send`), `backend/apps/receiving/views.py` (`complete`), `backend/apps/samples/views.py` (`dispose`), `backend/apps/storage/views.py` (`bulk-place`). Ручное — в UI.
**Статус:** ✅ действует (автоматика уже работает, ручное — уже есть).


### 1.121. 2026-11-06 — Приёмка ↔ отправка, кто ставит RECEIVED (вопрос 9)

**Решение:**
- **INBOUND** (лаборатория → мы): `Receipt.complete` → `Shipment.status = RECEIVED` **автоматически** (уже работает в `backend/apps/receiving/views.py`).
- **OUTBOUND** (мы → лаборатория): лаборатория подтверждает **в своём клиенте** (`2.x-lab-portal`). У нас в деталях рейса — кнопка «Отметить принятым» (**ручная**) на случай, если лаборатория не через наш клиент.

**Причина:** у нас нет доступа к системе лаборатории напрямую. INBOUND автоматически (мы принимаем — мы и ставим). OUTBOUND — лаборатория решает, когда подтвердить. Ручная кнопка у нас — fallback.

**Где:** `backend/apps/receiving/views.py` (уже), `backend/apps/picking/views.py` (добавить `mark-received` action для OUTBOUND), `web/src/pages/ShipmentDetailPage.tsx` (кнопка).
**Статус:** 🟡 для INBOUND — ✅, для OUTBOUND — реализация в `2.x-shipments-3`.


### 1.122. 2026-11-10 — mark_received проверяет роль, а не is_superuser (ТД-72)

**Решение:** право на приёмку рейса (mark-received) проверяется только по роли (`admin` или `manager`) и привязке к лаборатории (`UserProfile.laboratory`). Флаг `is_superuser` игнорируется.

**Причина:** роли — это бизнес-логика WMS. Суперюзер — это техническая роль Django (для доступа в админку). Смешивать их опасно. Если суперюзеру нужно принимать рейсы — ему нужно выдать роль `admin` в профиле.

### 1.123. 2026-11-10 — Флаг  и  action (1.118)
**Решение:** в модель  добавлено поле . Создан action . При шифровании заполняется .
**Статус:** ✅ действует.

### 1.124. 2026-11-10 — Перекладывание проб  (1.115)
**Решение:** Action  переносит часть проб в транспортную тару. При опустении тары вызывается .
**Статус:** ✅ действует.

### 1.123. 2026-11-10 — Флаг  и  action (1.118)
**Решение:** в модель  добавлено поле . Создан action .
**Статус:** ✅ действует.

### 1.124. 2026-11-10 — Перекладывание проб  (1.115)
**Решение:** Action  переносит часть проб в транспортную тару.
**Статус:** ✅ действует.

### 1.125. 2026-11-10 — Пул (Корзина) для тар и проб
**Решение:** Создано приложение . Модели  (OneToOne к User) и  (FK к Pool, Container или Sample). API: , , , [H[2J[3J. Фронтенд: отдельная страница  с фильтрами, индикация «В пуле».
**Причина:** Удобный буфер для формирования списков перед массовыми действиями.
**Статус:** ✅ действует.

### 1.126. 2026-11-11 — Помощник по сортировке (2.x-sorting)
**Решение:** Сервис  анализирует соседние тары и рекомендует ячейки. Приоритет: Участок (+10), ТИ (+5), Н/З (+5). UI позволяет группировать тары и размещать их пакетом.
**Статус:** ✅ действует.
