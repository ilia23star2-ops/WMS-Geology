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

Полные формулировки — в истории git. Кратко:

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

**Требует:** `Container.updated_at` (уже был в v9 моделей, пачка `3.x-offline-sync-b-1a`).

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
- Mobile (c-6c) пингует перед выбором `apiBaseUrl` — JWT ещё нет, нельзя требовать авторизацию.
- Не обращается к БД — отвечает, пока процесс Django жив.
- Простая проверка связи, не бизнес-эндпоинт.

**Где:** `backend/wms_geology/health.py`, `backend/wms_geology/urls.py`.
**Статус:** ✅ действует (реализовано в `c-6a`).

### 1.79. 2026-11-02 — `?updated_since=` только с таймзоной, naive → 400

**Решение:** `?updated_since=<ISO 8601>` на `/storage/containers/` и `/samples/`. С таймзоной (UTC, суффикс Z или +00:00). Naive datetime → 400. Невалидный ISO → 400. Пусто → без фильтра (полный Pull).

**Причина:**
- Mobile всегда шлёт UTC; naive-время даст неоднозначность.
- Явная ошибка лучше молчаливого сдвига.

**Где:** `backend/apps/storage/filters.py`, `views.py` (`ContainerViewSet`, `SampleViewSet`).
**Статус:** ✅ действует (реализовано в `c-6b`).

### 1.80. 2026-11-02 — Auto-detect сети: probe /health/ → первый живой

**Решение:** при старте приложение параллельно пингует `GET /health/` (2 с таймаут) на трёх адресах:
1. `127.0.0.1` (USB, `adb reverse`).
2. `192.168.0.77` (WiFi, домашний ПК).
3. `10.0.2.2` (Android-эмулятор).

Первый живой — в `apiBaseUrl`. Если `--dart-define=API_HOST=...` задан — probe не запускается. Все мертвы → fallback `192.168.0.77`.

**Причина:**
- Не надо пересобирать APK при смене сети.
- `--dart-define` сохраняет детерминизм на рабочем ПК.
- Fallback сохраняет старое поведение.

**Цена:** 2 с задержки на старте.

**Где:** `mobile/lib/services/network_probe.dart`, `mobile/lib/config.dart::AppConfig.resolve`, `mobile/lib/main.dart`.
**Статус:** ✅ действует (реализовано в `c-6c`).

### 1.81. 2026-11-02 — ScanWindow: `_pickBarcodeInScanWindow` + landscape swap

**Решение:** два механизма фильтрации области сканирования:
1. `scanWindow` в `MobileScanner` — native-ограничение (если работает).
2. `_pickBarcodeInScanWindow` в `_onDetect` — ручной фильтр по центру `corners` → `BoxFit.cover`.

**Проблема:**
- Native `scanWindow` в `mobile_scanner 7.4.2` на Android не ограничивает область (issue #633).
- `BarcodeCapture.rotation` в 7.4.2 не существует.
- `Barcode.scaleCorners` не учитывает landscape.

**Landscape-фикс (`c-6d-fix-3`):** `capture.size` остаётся портретным, `corners` — rotated. `mapImageToWidgetFrame` swap effectiveSize.

**DetectionSpeed:** `normal` (не `noDuplicates`). Дублирующую обработку блокирует флаг `_handled`.

**Где:** `mobile/lib/utils/scan_window.dart`, `mobile/lib/screens/scanner_screen.dart`.
**Статус:** ✅ действует (реализовано в `c-6d-fix` + `c-6d-fix-3`).

### 1.82. 2026-11-02 — `NetworkStatusProvider` (heartbeat `/health/` 10 с)

**Решение:** упрощённый `NetworkStatusProvider` (вместо откаченного `NetworkMonitor`):
- `Timer.periodic(interval=10s)` → `GET /health/` текущего `AppConfig.apiHost` (2 с таймаут).
- При неудаче — `NetworkProbe.resolve()`.
- При смене хоста — `onBaseUrlChanged(url)` → `ApiClient.dio.options.baseUrl = url`.
- При `--dart-define=API_HOST` — только статус, без swap.

**Причина:**
- `WidgetsBindingObserver` в `NetworkMonitor` давал регресс.
- Heartbeat 10 с — компромисс между «свежестью» и батареей.
- `NetworkBadge` читает `isOnline` через `context.select`.

**Где:** `mobile/lib/providers/network_status_provider.dart`, `mobile/lib/widgets/network_badge.dart`, `mobile/lib/main.dart`.
**Статус:** ✅ действует.

### 1.83. 2026-11-02 — Синхронизация запрещена при офлайне / pendingOffline

**Решение:** кнопка «Синхронизация» на `HomeScreen` и все действия на `SyncScreen` `disabled`, если `!isOnline` или `isPendingOffline`.

**Причина:**
- `AuthProvider.isOffline` стареет; `NetworkStatusProvider.isOnline` — свежий (heartbeat 10 с).
- Pending-offline — синхронизация невозможна до подтверждения JWT.

**Где:** `mobile/lib/screens/home_screen.dart`, `mobile/lib/screens/sync_screen.dart`.
**Статус:** ✅ действует.

### 1.84. 2026-11-02 — Иконка сети на `LoginScreen`

**Решение:** `NetworkBadge` в `AppBar.actions` `LoginScreen`. `AppBar` прозрачный, карточка логина не сдвигается.

**Причина:** до ввода пароля пользователь должен знать, есть ли связь с сервером.

**Где:** `mobile/lib/screens/login_screen.dart`, `mobile/test/widget_test.dart`.
**Статус:** ✅ действует.

### 1.85. 2026-11-02 — Адаптив карточки тары (портрет / ландшафт)

**Решение:** `LayoutBuilder` и два layout'а:
- **Портрет:** `AppBar` + `TabBar.bottom`, шапка в `SliverToBoxAdapter`.
- **Ландшафт:** `Row`, слева панель ~40% ширины, справа `TabBar` + `TabBarView`.
- Кнопки — в `bottomNavigationBar` + `SafeArea`.

**Где:** `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.86. 2026-11-02 — Форма шапки тары в bottom sheet

**Решение:** ✏ в `AppBar.actions` открывает `showModalBottomSheet` с `ContainerEditForm`.

**Поля:** `container_number`, `container_type`, `comment`, `position_on_pallet`, `draft_*`. Справочники — `CatalogService`.

**Где:** `mobile/lib/widgets/container_edit_form.dart`, `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

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

### 1.90. 2026-11-02 — Правило: перед `git add` — `git status --short`

**Решение:** перед `git add` выполнять `git status --short | grep "mobile/lib"`. Все `M`/`??` из `mobile/lib/*` включать в `git add` явными именами.

**Причина:** дважды за сессию (`c-7b`, `c-7h`) файлы остались uncommitted.

**Где:** чек-лист перед закрытием захода; `CONTEXT.md` §«Mobile».
**Статус:** ✅ действует.

### 1.91. 2026-11-02 — Не выдавать код следующего захода, пока текущий не закоммичен

**Решение:** перед выдачей кода следующего захода — `git status --short | grep "mobile/lib"` должно быть пусто.

**Причина:** три случая (`c-7b`, `c-7d`, `c-7h`) смешавшихся или не закоммиченных файлов. `flutter analyze`/`flutter test` проходят, но `git clone` с нуля ломается.

**Отличается от 1.90:** 1.90 — перед `git add`; 1.91 — перед выдачей кода нового захода.

**Где:** чек-лист перед каждым заходом.
**Статус:** ✅ действует.

### 1.92. 2026-11-02 — Offline-place через `sync_queue` (c-7c)

**Решение:** `POST /storage/containers/bulk-place/` на мобилке — онлайн и офлайн через `ContainerService.bulkPlace`:
- **Онлайн:** сразу на сервер → `PlaceOutcome.online`.
- **Офлайн:** `isNetworkError` → `sync_queue.enqueue` → `PlaceOutcome.queued`. `SyncPusher` отправляет при следующем `pushAll`.

**Кнопки в карточке тары — раздельные, как в вебе:**
- `[Предпросмотр]` — всегда.
- `[Разместить]` — `canPlace = PENDING_FILLING || PENDING_PLACEMENT`.
- `[Местоположение]` — `hasCell = cellId != null`; в мобилке — `ContainerLocationDialog` с адресом.

**Причина:** требование «мобилка работает офлайн как веб». `sync_queue` уже поддерживает `POST` без изменений — `c-8d` закрыт в `c-7c`.

**Где:** `mobile/lib/services/container_service.dart`, `mobile/lib/widgets/place_container_dialog.dart`, `mobile/lib/widgets/container_location_dialog.dart`, `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.93. 2026-11-02 — Мобилка = полное двустороннее зеркало сервера

**Решение:** мобилка обязана **в офлайне видеть всё, что есть на сервере**, и **уметь создавать/менять данные локально**, чтобы при синхронизации они уходили на сервер.

**Правила:**
1. **Pull тянет ВСЁ**: топология, справочники, `containers`, `samples`, **история всех тар**.
2. **Каждый справочник кэшируется** в SQLite с fallback: онлайн → API + save; офлайн → кэш.
3. **История кэшируется** через **pre-fetch в Pull** (не lazy).
4. **Создание/редактирование справочника офлайн** — через `sync_queue`.

**Реализовано:** `c-7-offline-catalog` (правила 1–2), `c-7e-1`/`c-7e-2`/`c-7e-3` (правило 3), `c-8-catalog-create` (правило 4).

**Причина:** требование «мобилка офлайн как веб». `c-7c` показал разрыв (каскад размещения онлайн-only). Pre-fetch истории — чтобы офлайн была история любой тары.

**Где:** `SyncService.pullAll`, `CatalogService` (fallback), `CatalogDao`, `ContainerHistoryDao`, `database.dart` (v6 — `catalog` + `container_history`; v8 — `local_ref` в `sync_queue`).
**Статус:** ✅ действует (правила 1–4 закрыты).

### 1.94. 2026-11-02 — Мобилка: офлайн-редактирование серверных проб (c-9-fill-offline-2c-3)

**Решение:** `SampleService.update` / `dispose` / `restore` / `deleteSample` для **серверных** проб при `isNetworkError` → `sync_queue`:
- Локально обновить кэш (`updateLocalStatus` / `deleteById`).
- `sync_queue.enqueue(PATCH/POST/DELETE, endpoint, payload)`.
- `setPendingSyncLocal(id, true)` + `setPendingSync(containerId, true)`.
- `Sample.pendingSync` — флаг в модели, `Sample.needsSync` — для UI (`cloud_off`).

**`SampleDao.saveAll` не перезаписывает** пробы с `_pending_sync = 1` — Pull не теряет офлайн-правки.

**`fetchByContainerId` возвращает кэш**, если `hasPendingForContainer` — UI видит новые статусы, а не серверные.

**`sync_queue` regex fix:** `/samples/(\d+)/(?:dispose/|restore/)?$` — PATCH/DELETE `(/samples/5/)` и dispose/restore `(/samples/5/dispose/)`. Раньше PATCH/DELETE **не матчились** → `_pending_sync` не сбрасывался после Push, и reconcile не сохранял флаги проб с PATCH в очереди.

**`_pending_sync` сбрасывается**:
- После успешного Push (`SyncPusher.onSuccess`).
- При Pull, если в `sync_queue` **нет** записи для пробы (`SyncService._reconcile`).

**Причина:** требование «все функции редактирования доступны офлайн», «как в вебе».

**Где:** `mobile/lib/models/sample.dart`, `mobile/lib/db/sample_dao.dart`, `mobile/lib/services/sample_service.dart`, `mobile/lib/widgets/sample_edit_dialog.dart`, `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.95. 2026-11-02 — Мобилка: офлайн-редактирование `sample_number` (c-9-fill-offline-2c-4)

**Решение:** для офлайн-пробы (`id < 0`) поле `sample_number` **редактируется** в `SampleEditDialog`. При сохранении — `parseSampleInput` (валидация + разбор). Диапазон — ошибка. Передаётся в `SampleService.updateLocalOffline`:
- `newSampleNumber`, `newPrefix`, `newMiddle`, `newSequence`, `newSequenceDigits`, `newWellName`.
- `SampleDao.updateLocalFields` обновляет JSON.
- `_rebuildFillPayload` пересобирает `sample_groups` в очереди — сервер создаст пробу с новым номером.

**`SampleEditDialog._loadCatalogs`** дополнительно грузит `laboratories` (для `prefixes` парсера), `sites` (для `matchPatterns`).

**Справочники (ТИ, участок) read-only** у офлайн-проб — они на контейнере, сервер возьмёт из контейнера.

**Причина:** без редактирования номера офлайн-филл не гибкий. Пользователь ошибся в диапазоне — должен исправить, не пересоздавая.

**Где:** `mobile/lib/widgets/sample_edit_dialog.dart`, `mobile/lib/services/sample_service.dart`, `mobile/lib/db/sample_dao.dart`.
**Статус:** ✅ действует.

### 1.96. 2026-11-02 — Мобилка: счётчик на кнопке синхронизации (c-9-fill-offline-2c-3-fix-3b)

**Решение:** `SyncProvider.refresh()` вызывается **после каждой офлайн-операции** (`SampleEditDialog`, `_applyBulkStatus`, `_onPlace`, `FillContainerContent._handleSubmit`) → `pendingCount` сразу отражает реальность.

**`HomeScreen` в офлайне** показывает `total` в скобках: `«Синхронизация (3, нет связи)»` (было без числа).

**`SyncProvider.push()` / `syncAll()`** возвращают `PushResult?` → `SyncScreen._runPushAction` показывает `«Отправлено: N»` по реальному `sent`, а не по разнице `pendingCount` (в офлайне застревал на 0 → «Нечего отправлять» при непустой очереди).

**Причина:** пользователь не видел, сколько накопилось, и думал, что данные не уходят.

**Где:** `mobile/lib/providers/sync_provider.dart`, `mobile/lib/screens/sync_screen.dart`, `mobile/lib/screens/home_screen.dart`, `mobile/lib/widgets/sample_edit_dialog.dart`, `mobile/lib/screens/container_detail_screen.dart`, `mobile/lib/widgets/fill_container_content.dart`.
**Статус:** ✅ действует.

### 1.97. 2026-11-02 — Мобилка: автосинхронизация при возврате сети (c-9-auto-sync)

**Решение:** `AuthGate` подписан на `NetworkStatusProvider`. При переходе `isOnline: false → true`:
1. **Push** — если `pendingCount + errorCount > 0` (`SyncProvider.push()`).
2. **Pull** — **всегда** (`SyncProvider.pull()`).
3. **Один объединённый SnackBar** через `scaffoldMessengerKey` (виден на любом экране):
   - только Push: «Отправлено: N»;
   - только Pull: «Загружено: N»;
   - Push + Pull: «Синхронизировано — отправлено: N, загружено: M»;
   - ошибка — текст ошибки.

**`PullStats`** — счётчик: `containers` + `samples`, total.

**`SyncScreen._runPullAction`** — SnackBar «Загружено: N (тар: X, проб: Y)» / «Данные уже актуальны».

**Причина:** требование «уведомление, что синхронизация прошла, чтобы лишний раз не нажимать кнопку». Push и Pull — оба направления, оба информативны.

**Где:** `mobile/lib/main.dart` (`scaffoldMessengerKey`, `AuthGate._autoSync`), `mobile/lib/services/sync_service.dart` (`PullStats`), `mobile/lib/providers/sync_provider.dart`, `mobile/lib/screens/sync_screen.dart`.
**Статус:** ✅ действует.

### 1.98. 2026-11-02 — Мобилка: инкрементальный Pull с `?updated_since=` (c-6b-updated-since-pull)

**Решение:** `SyncProvider._lastPullSince` запоминает время последнего **успешного** Pull. При следующем Pull передаётся в `SyncService.pullAll(updatedSince: ...)` → `?updated_since=<ISO 8601 UTC>` в `/storage/containers/` и `/samples/` (бэкенд `c-6b` возвращает только изменённые). `PullStats` = реальные изменения.

**История pre-fetch** теперь только для **изменённых** тар (N запросов → M запросов, M = изменённые).

**Справочники** — полный Pull (мало данных, `updated_since` там не поддерживается).

**`_lastPullSince` — в памяти.** При перезапуске приложения — снова полный Pull. Персистить (`shared_preferences`) — `ТД-62`.

**Причина:** пользователь видел «Загружено 85» при каждом Pull, даже если ничего не менялось (`PullStats` считал **пришедшее**, а не **изменённое**). Теперь: первый Pull — 85, второй — 0, третий — только изменённые.

**Где:** `mobile/lib/services/sync_service.dart` (`pullAll(updatedSince:)`), `mobile/lib/providers/sync_provider.dart` (`_lastPullSince`).
**Статус:** ✅ действует.

### 1.99. 2026-11-02 — Мобилка: natural sort проб (c-9-natural-sort)

**Решение:** `naturalCompare(a, b)` — разбивает строку на куски `цифры | не-цифры`, цифровые — числами, не-цифровые — лексикографически. Применяется:
- `SampleDao.getByContainerId` (офлайн-ветка);
- `SampleService.fetchByContainerId` (онлайн-ветка, `[...list]..sort`);
- `LabelData.fromContainer` (PDF-предпросмотр).

**Пример:** `TST6701 < TST6702 < … < TST6710` (а не `TST6701 < TST6710 < TST6702`). `TAA-A34076001-001 < TAA-A34076001-002 < … < TAA-A34076001-031`.

**Причина:** порядок проб по `id` — не по номеру. При `SELECTED` в конце списка `TST6702` оказывалась после `TST6710`.

**Где:** `mobile/lib/utils/natural_sort.dart` (новый), `mobile/lib/db/sample_dao.dart`, `mobile/lib/services/sample_service.dart`, `mobile/lib/models/label_data.dart`.
**Статус:** ✅ действует.

### 1.100. 2026-11-02 — Мобилка: тап на иконке сети → `pingNow()` (c-6g-tap-ping)

**Решение:** `NetworkBadge` — `IconButton` с `onPressed: () => pingNow()`. Пока пинг идёт — спиннер (1–2 сек). SnackBar не показываем — иконка сама меняет цвет. `NetworkStatusProvider.pingNow()` — публичный (снят `@visibleForTesting`).

**Причина:** heartbeat 10 сек — долго. Пользователь должен иметь возможность «пнуть» связь при подозрении.

**Где:** `mobile/lib/widgets/network_badge.dart`, `mobile/lib/providers/network_status_provider.dart`.
**Статус:** ✅ действует.

### 1.101. 2026-11-03 — Мобилка: офлайн-создание тары (c-2d-2a)

**Решение:**
1. **`bulkCreate` при `isNetworkError`** создаёт тару локально с negative ID, кладёт в `sync_queue` с `localRef` (JSON-массив ID), возвращает `BulkCreateResult {count, queued}`. `pending_sync = true` → `cloud_off`.
2. **`SyncPusher` после успешного `bulk-create`** строит маппинг `localId → serverId` **по индексу** `created_containers[i].id` (порядок гарантирован `services.bulk_create_containers` — цикл `.create()` в том же порядке, что и вход).
3. **`remapAllLocalRefs`** (идемпотентно) перемапливает `payload` (`container_id`, `container_ids[]`, `containers[].id`) и `local_ref` (int-строка, JSON-массив) во **всех** записях `sync_queue` (PENDING + ERROR).
4. **`ContainerDao.remapId`** меняет PK в `containers` (`pending_sync` сохраняется). **`SampleDao.remapContainerId`** меняет колонку `container_id` и JSON `container` в `samples`.
5. **Локальный JSON тары — в серверном формате** (`container_type`, `draft_site`, `draft_research_type`), не `*_id`. Иначе `Container.fromJson` падает на `as int`.
6. **`Container.fromJson`** имеет fallback на `*_id` — страховка от старых записей.
7. **История для negative-ID** не зовётся на сервер (`_loadHistory` guard в `ContainerDetailScreen`) — истории ещё нет.
8. **Проверка длины:** `created_containers.length != payload.containers.length` → маппинг пропускается, `debugPrint`.

**Причина:**
- Без маппинга `fill-samples` / `bulk-place` на офлайн-тару уйдут с `container_id = -1` → 404.
- Без серверного формата JSON `Container.fromJson` падает на локальной таре → карточка не открывается (было в `c-2d-2a` до fix-3).
- Индексный маппинг — потому что сервер (`ContainerSerializer`) не знает про `local_ref`. Порядок гарантирован кодом сервиса. Если порядок сломается — проверка длины + лог покажут сразу; полное решение (`local_ref` на сервере) — `c-8a`.

**Где:** `mobile/lib/db/database.dart` (v8), `sync_queue_dao.dart` (`remapAllLocalRefs`, `remapInPlace`, `remapLocalRef`), `container_dao.dart` (`remapId`), `sample_dao.dart` (`remapContainerId`), `services/sync_pusher.dart` (`_remapBulkCreate`), `services/container_service.dart` (`BulkCreateResult`, офлайн-ветка), `models/container.dart` (`fromJson` fallback), `screens/container_detail_screen.dart` (`_loadHistory` guard), `widgets/create_containers_dialog.dart` (SnackBar по `queued`).

**Статус:** ✅ действует.

---

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
| `remapAllLocalRefs` | Идемпотентная замена negative → server ID в payload + `local_ref` всех записей очереди (1.101). |

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
| ContainerEditForm | Форма шапки тары в bottom sheet (1.86). |
| FillContainerContent (mobile) | Вкладка «Редактирование» (1.87). |
| ScanHistoryEntry | Снимок истории сканов Н/З · ТИ · номер (1.89). |
| SampleEditDialog (mobile) | Диалог редактирования пробы (1.88). |
| SampleStatusChip | Цветной чип статуса пробы (1.88). |
| LabelData (offline) | Модель для offline-рендера PDF (1.77). |
| label_pdf_generator | Offline-рендер PDF на Dart (1.77). |
| NamedCatalog | Универсальный `{id, label}` для каскада (1.92). |
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
- «_pending_sync = 1» — не «есть правка», а «есть правка, **ещё не ушедшая** на сервер». Сбрасывается после Push или Pull (1.94).
- «pendingCount» — не «число правок», а «число записей в `sync_queue` со статусом PENDING» (1.96).
- «85 загружено» — не «85 изменений», а «85 тар в ответе сервера». После `updated_since` — реальные изменения (1.98).
- «natural sort» — не сортировка по `id`, а по `sample_number` (числа числами) (1.99).
- «pingNow» — не «перезапуск heartbeat», а один цикл `_ping()` (1.100).
- «local_ref» — не «серверное поле». Только локальное, для маппинга на `bulk-create` (1.101).
- «Маппинг по индексу» — не «по `local_ref` с сервера». Порядок гарантирован циклом `.create()` (1.101).
- «`container_type_id` в локальном JSON» — не формат. В кэше — `container_type` (серверный), fallback на `_id` только для старых записей (1.101).