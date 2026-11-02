# PROGRESS.md — история закрытых заходов

> Хронология. Свежее — сверху.
> Метрики раз в серию — в конце каждого раздела.

---

## Серия `feature/3.x-offline`

**Дата:** 2026-10-28 — активна.
**Ветка:** `fix/2.x-mobile-bundle-c-2` (долгоживущий offline-бранч).
**Контекст:** Офлайн-режим мобильного приложения. SQLite + SyncQueue + Deferred Offline Login + USB + auto-detect + scanWindow + инкрементальный Pull. Backend на старте серии — 779 тестов.

### Что закрыто (backend)

- ✅ **`c-6a-pre`** (2026-10-30) — починка pre-existing регрессов, обнаруженных полным прогоном:
  - `log_audit(old_value=..., new_value=...)` — восстановлен параметр `old_value` (регресс, `DECISIONS 1.70`), передаётся в `AuditLog`.
  - `UserProfile.__str__` — fallback `"без роли"` при `role=None`.
  - `test_access_tokens.py` — 3 stale-теста: `len(raw_token) == 43` (было `== 64` после `token_urlsafe(32)`), `make_access_token_qr_svg(4 args)` (base64-JSON из `c-4.5`).
  - Коммиты `58549e5` (pre) + merge.
- ✅ **`c-6a`** (2026-10-30) — `GET /health/` (200 без авторизации, `{status, service, time}`) + денормализация `ContainerSerializer` (`container_type_name`, `floor_room_name`, `cell_full_address`) + `select_related("pallet__cell", ...)` в `ContainerViewSet.get_queryset` (без N+1).
  - `wms_geology/health.py` — новый.
  - `apps/storage/tests/test_serializers_denormalization.py` — 5 тестов.
  - `tests/test_health.py` — 2 теста.
- ✅ **`c-6b`** (2026-10-30) — `?updated_since=<ISO 8601>` на `/storage/containers/` и `/samples/`.
  - `apps/storage/filters.py::apply_updated_since` — DRY-хелпер.
  - ISO с таймзоной; naive / невалидный → 400 (`ValidationError`).
  - Тесты: `test_updated_since.py` × 2 (4 storage + 3 samples).

### Что закрыто (mobile, сеть и сканер)

- ✅ **`c-1`** — SQLite: `containers`, `samples`, DAO, инициализация.
- ✅ **`c-2`** (2026-10-29) — `SyncService` (Pull), 50/стр, DI для тестов. 4 теста.
- ✅ **`c-3`** (2026-10-29) — `SyncQueue` (SQLite) + `SyncQueueDao` + `SyncPusher`. 3 теста.
- ✅ **`c-4`** (2026-10-29) — `SyncProvider` + `SyncScreen` + кнопка. 7 тестов.
- ✅ **`c-4.5`** (2026-10-30) — Deferred Offline Login:
  - QR = base64-JSON `{token, purpose, expires_at, user}`.
  - `AuthService.savePendingOfflineToken` / `get` / `clear`.
  - `AuthProvider.loginWithQr` (fallback), `_tryExchangePendingToken`.
  - `QrLoginScreen` — base64-JSON с fallback на raw.
  - Плашки «Офлайн-режим» / «Временный доступ».
  - `DeviceIdService` (UUID v4 на `shared_preferences`).
  - `ScanHistoryService` — история 10 тар.
  - `ContainerService.fetchById` / `SampleService.fetchByContainerId` — fallback на DAO.
  - `ApiException.isNetworkError` + `AuthProvider._isNetworkError`.
  - Миграция `users/0003_*` (`qr_svg`).
- ✅ **`c-4.6`** (2026-10-30) — USB-режим:
  - `adb reverse tcp:8000 tcp:8000` → `127.0.0.1:8000`.
  - `--dart-define=API_HOST=127.0.0.1`.
  - SQLite `version = 4`.
  - Fix `home_screen.dart`.
  - **Успешная сборка на рабочем ПК** (прокси).
- ✅ **`c-6c`** (2026-10-30) — auto-detect сети:
  - `lib/services/network_probe.dart` — `NetworkProbe.resolve()` (parallel ping `GET /health/`, 2 с).
  - `lib/config.dart::AppConfig.resolve()` — приоритет `--dart-define=API_HOST` → probe (`127.0.0.1` / `192.168.0.77` / `10.0.2.2`) → fallback `192.168.0.77`.
  - `lib/main.dart` — `WidgetsFlutterBinding.ensureInitialized()` + `await AppConfig.resolve()` перед `runApp`.
  - `test/services/network_probe_test.dart` — 6 тестов.
  - **Device-check:** портрет ok, ландшафт ok (после `c-6d`).
- ✅ **`c-6d-fix`** (2026-11-02) — scanWindow 220×220:
  - `lib/utils/scan_window.dart::calculateScanWindow` + `barcodeCenterFromCorners`.
  - `lib/screens/scanner_screen.dart`: `_pickBarcodeInScanWindow` (по `corners`), `DetectionSpeed.normal`, `_widgetSize` + `_scanWindow` из `LayoutBuilder`.
  - `test/utils/scan_window_test.dart` — 10 тестов.
  - **Первая попытка `c-6d`**: native `scanWindow` в `mobile_scanner 7.4.2` на Android не ограничивает (issue #633).
  - **`c-6d-fix-2`**: попытка `BarcodeCapture.rotation` (нет в 7.4.2) → `scaleCorners` (не учитывает rotation) → откат, ничего не вмержено.
- ✅ **`c-6d-fix-3`** (2026-11-02) — landscape-фикс:
  - **Причина:** `capture.size` в `mobile_scanner` на Android **не** меняется при повороте (остаётся 1440×1920), а `corners` приходят уже в rotated системе (1920×1440). BoxFit.cover с `capture.size` даёт сдвиг → в ландшафте QR внутри не сканируется.
  - **Фикс:** `mapImageToWidgetFrame` swap effectiveSize при `widget landscape + image portrait`.
  - `test/utils/scan_window_test.dart` — +4 теста (landscape-кейсы из реального лога).
  - **Device-check:** портрет + ландшафт, QR внутри/вне — ok.
- ✅ **`c-6g`** (2026-11-02) — `NetworkStatusProvider`:
  - `lib/providers/network_status_provider.dart` — `ChangeNotifier` + `Timer.periodic(10s)` → `GET /health/` текущего `AppConfig.apiHost` (2 с таймаут). При неудаче — `NetworkProbe.resolve()` (auto-detect заново), при смене хоста — `onBaseUrlChanged(url)` → `ApiClient.dio.options.baseUrl = url`. При `--dart-define=API_HOST` — только статус, без swap.
  - `lib/widgets/network_badge.dart` — `cloud_done` / `cloud_off` / `vpn_key`.
  - `lib/main.dart` — `NetworkStatusProvider` в `MultiProvider`, `start()` в `AuthGate.initState`, `onBaseUrlChanged` регистрируется.
  - `test/providers/network_status_provider_test.dart` — 3 теста.
  - **Device-check:** портрет/ландшафт, USB вкл/выкл — ok.
- ✅ **`c-6h`** (2026-11-02) — синхронизация запрещена при `!isOnline` / `isPendingOffline`:
  - `HomeScreen`: `Consumer2<SyncProvider, NetworkStatusProvider>`, `blocked = !net.isOnline || auth.isPendingOffline`, иконка `cloud_off`, текст «Синхронизация (нет связи)», tooltip.
  - `SyncScreen`: `_OfflineBanner` (красный Card), все кнопки `disabled = sync.isSyncing || !online`.
- ✅ **`c-6g-login`** (2026-11-02) — иконка `NetworkBadge` в `AppBar.actions` `LoginScreen` (прозрачный `AppBar`, карточка логина не сдвигается).
  - `widget_test.dart` — обёрнут в `MultiProvider` с `NetworkStatusProvider` (иначе `ProviderNotFoundException`).
- ⚠️ **`c-6f`** — откачен. `NetworkMonitor` с `WidgetsBindingObserver` конфликтовал с lifecycle, заменён на `c-6g`.

### Что закрыто (mobile, карточка тары)

- ✅ **`c-7a`** (2026-11-02) — карточка тары: шапка + 3 вкладки (Пробы / Редактирование / История) + адаптив:
  - **Портрет** — `NestedScrollView` + `SliverToBoxAdapter` (шапка растягивается на натуральную высоту, уезжает при скролле, `TabBar` прилипает).
  - **Ландшафт** — `Row`: слева панель `~40% ширины` (`clamp 320..460`) со шапкой (скроллится независимо), справа `TabBar` + `TabBarView`.
  - Денормализация `Container` (`containerTypeName`, `floorRoomName`, `cellFullAddress`, `draftSiteName`, `draftResearchTypeName`), `Sample.PENDING_PLACEMENT` / `SELECTED`.
  - Кнопки `[Предпросмотр] [Разместить]` — в `bottomNavigationBar` + `SafeArea`.
  - `ContainerHistoryEntry` — модель аудита, `ContainerService.fetchHistory`.
  - `test/models/container_test.dart` — 5 тестов, `test/models/container_history_entry_test.dart` — 2 теста, `test/sample_test.dart` — обновлён.
- ✅ **`c-7b`** + **`c-7b-fix`** (2026-11-02) — форма шапки тары:
  - `ContainerEditForm` в `showModalBottomSheet` (карандаш ✏ в `AppBar.actions`).
  - Поля: `container_number`, `container_type` (dropdown), `comment`, `position_on_pallet`, `draft_site` (dropdown), `draft_research_type` (dropdown), `draft_work_order_coded`, `draft_work_order_incoming`.
  - `CatalogService` (`fetchSites`, `fetchResearchTypes`, `fetchContainerTypes`, `fetchLaboratories`).
  - `Container.draftSiteId` / `draftResearchTypeId` — добавлены для предзаполнения dropdown'ов.
  - `test/catalog_test.dart` — 6 тестов.
  - `c-7b-fix` — дозакоммит недостающих файлов (`container_edit_form.dart`, `CatalogService` в `main`, `draft-поля` в `Container`).
- ✅ **`c-7f`** + **`c-7f-fix`** (2026-11-02) — `FillContainerContent` (Dart-порт `FillContainerContent.tsx`):
  - `sample_range_parser.dart` — `parseSampleInput` (Dart-порт парсера диапазонов, `TAA-A34076001-031` / `TST124001-005` / `TAA-A34076001`) + `buildSampleNumbers`.
  - `int_ranges.dart` — `parseIntRanges` / `formatIntRanges` (`"2, 4-7"` ↔ `[2,4,5,6,7]`).
  - `range_edit_dialog.dart` — skip / selected.
  - `fill_container_content.dart` — блоки «Добавить новые пробы» / «Пробы в таре» / «Итого».
  - `SampleService.fillSamples` / `deleteSample`.
  - `CatalogService.fetchLaboratories` (плюс `Laboratory` в `catalog.dart`).
  - `test/utils/sample_range_parser_test.dart` — 13 тестов.
  - `c-7f-fix` — `_sampleTile` без дублей ТИ/Н/З (есть в шапке).
- ✅ **`c-7g`** (2026-11-02) — вкладка «Пробы» как в вебе:
  - поиск (номер / скважина), чекбоксы (индивидуальные + «все»), bulk-статус dropdown + [Применить] (последовательные `PATCH`, ошибки — SnackBar).
  - `SampleStatusChip` — цветной чип (`IN_STORAGE` green, `IN_TRANSIT` blue, `CONSUMED`/`PENDING_PLACEMENT` orange, `DISPOSED` red, `SELECTED`/`unknown` surface).
  - `SampleEditDialog` (edit / dispose / restore / delete) — открывается по ✏ на каждой пробе и по тапу на строку.
  - `Sample.researchTypeId`, `siteId`, `wellName`, `disposedAt`, `disposalReason`, `containerNumber`, `sampleStatusToApi`.
  - `SampleService.fetchById`, `update`, `dispose`, `restore`.
  - В `FillContainerContent` — ✏ у каждой существующей пробы → тот же `SampleEditDialog`.
- ✅ **`c-7h`** + **`c-7h-fix`** + **`c-7h-fix-2`** (2026-11-02) — история сканов `Н/З · ТИ · номер`:
  - `ScanHistoryEntry` — модель с `id`, `containerNumber`, `workOrderCoded`, `researchTypeName`, `label`, `toJson` / `fromJson`.
  - `ScanHistoryService` — ключ `scan_history_entries` (JSON-строки), миграция со старого `scan_history_ids` (`List<int>`).
  - `HomeScreen`: чипы показывают `entry.label` (`Н/З · ТИ · номер`), тап → `ContainerDetailScreen`.
  - `ScannerScreen`: `addToHistory(ScanHistoryEntry.fromContainer(container))`.
  - `test/services/scan_history_entry_test.dart` — 5 тестов.
  - `c-7h-fix` — порядок `Н/З · ТИ · номер` (было `номер · Н/З · ТИ`).
  - `c-7h-fix-2` — дозакоммит недостающих файлов (`home_screen.dart`, `scanner_screen.dart`, `scan_history_service.dart`).

### Что закрыто (mobile, PDF-серия)

- ✅ **`c-7d`** (2026-11-02) — PDF предпросмотр (online):
  - `ApiClient.download` + `open_filex`.
  - Кнопка [Предпросмотр] открывает `label.pdf` тары.
- ✅ **`c-7f-1`** (2026-11-02) — подготовка offline-рендера PDF:
  - Ассеты `pdf`, `qr`, `DejaVuSans.ttf`.
  - `LabelData` — модель для offline-рендера.
- ✅ **`c-7f-2`** (2026-11-02) — offline-рендер PDF на Dart:
  - `label_pdf_generator.dart` — `pw.Text`, `pw.BarcodeWidget`, галочка `SELECTED` через `pw.CustomPaint` (Y-вверх, как на сервере).
  - `label_service.dart` — переключение серверный / offline рендер.
  - `container_detail_screen.dart` — fallback на offline при недоступности сервера.
  - `label_pdf_generator_test.dart` — 7 тестов.

### Инфраструктура (рабочий ПК, прокси)

- **`setup.ps1` обязателен после `git reset --hard`** — восстанавливает сертификаты, `maven-local`, `local.properties`, `~/.gradle/gradle.properties`, aapt2-путь, NDK.
- **`aapt2FromMavenOverride`** в `mobile/android/gradle.properties` — иначе `Connection reset` с `dl.google.com`.
- **`kotlin.incremental=false` + `kotlin.compiler.execution.strategy=in-process` + `org.gradle.parallel=false` + `org.gradle.workers.max=2`** в `mobile/android/gradle.properties` — иначе D8 OOM на `mergeExtDexDebug` (даже с `-Xmx8G` и 16 GB RAM).
- **NDK `source.properties`** — `setup.ps1` пишет с BOM, CMake не парсит. Фикс: `printf` без BOM.
- **`cat >> file`** без завершающего `\n` склеивает строки.
- **`flutter run --android-skip-build-dependency-validation`** — флаг обязателен на рабочем ПК.
- **`export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`** — в каждом новом окне Git Bash.
- **`git push --force-with-lease`** использован один раз (`c-6c`, исправление прямого коммита в долгоживущий).
- **`c-7b-fix` и `c-7h-fix-2`** — дозакоммит недостающих файлов (правило `DECISIONS 1.90`: перед `git add` — `git status --short | grep "mobile/lib"`).

### Что осталось

- ⬜ **`c-7c`** — кнопка «Разместить» (`PlaceContainerDialog` каскад `Room → Rack → Section → Tier → Cell` + `bulk-place`). **Следующий.**
- ⬜ **`c-7e`** — кэш истории офлайн (SQLite `container_history`, v5, fallback в `fetchHistory`).
- ⬜ **`c-8a`..`c-8e`** — изменения в офлайне (PATCH статусов, размещение, auto-sync USB).
- ⏸ **`c-5`** — sneakernet через флешку (отложено).

### Метрики

- **Backend: 842 теста** (было 779 в начале серии, +35 pre-existing фиксов + 14 новых + 28 из `c-7d`/`c-7f-*` и смежных).
- **Web: 24 юнит-теста** (без изменений).
- **Mobile: 111 юнит-тестов** (было 32 в серии `2.x-mobile`; +79 за `3.x-offline`: sync_service 4, sync_pusher 3, sync_provider 7, network_probe 6, network_status_provider 3, scan_window 10+4, sample_range_parser 13, int_ranges 4, catalog 6, container 5, container_history_entry 2, sample 7, scan_history_entry 5, label_pdf_generator 7, user 4, widget_test 1, api_client, token_storage, parse_qr — исторически).

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
- ✅ **`receiving-1a` / `1a-2`** — парсер Excel (группы, шапка, тип тары, `1+1`, список дат).
- ✅ **`receiving-1b`** — `apply_shipment_import`: Shipment + Receipt + ReceiptItem + Container.
- ✅ **`receiving-1c`** — `POST /import-sessions/import-shipment/`.
- ✅ **`receiving-3a`** — `multi_date_match` только вопрос.
- ✅ **`receiving-3b-1`** — `conflicts` + `resolve-conflicts`.
- ✅ **`receiving-3b-1-2a`** — `ReceiptItem.container_type`.
- ✅ **`receiving-3b-2`** — `POST /receipts/{id}/check/`.
- ✅ **`receiving-3c`** — `POST /receipts/{id}/complete/`.
- ✅ **`receiving-3d-3-fix-2`** — снять `unique=True` с `container_number` (1.61).
- ✅ **`3f-1`** — `GET /receipts/{id}/act/` PDF «Акт приёмки».
- ✅ **`3f-1b`** — stale-тесты `container_number`.
- ✅ **`2f-1`** — фильтры `?draft_work_order_coded=`, `?draft_research_type_id=`, 409 при delete, `?force=true`.
- ✅ **`2f-2b`** — dispose/restore, 409 при delete пробы.
- ✅ **`2f-4c-1`** — автогенерация `qr_code` для Section/Cell, PDF, batch.
- ✅ **`2f-5a-1`** — каскадное удаление `ReceiptItem`.
- ✅ **`2f-5c-1`** — `Container.STATUS_PENDING_FILLING` (1.62).
- ✅ **`2f-10`** — `bulk-place`.
- ✅ **`2f-11c`** — `cell_id` / `pallet_id` в сериализаторах.
- ✅ **`2f-12a`** — `create-in-cell`.
- ✅ **`2f-8`** — WorkOrder: admin, samples_count, containers, linked_order_number, `TYPE_CODED = «Текущий»`.
- ✅ **`2f-8-fix` / `2f-8-fix-2`** — stale-тесты под правки 2f-5c-1, 2f-7e, 2f-7f, 2f-9c, 1.61.
- ✅ **`2f-14a`** — аудит: `log_audit()` в 6 actions, `history`, snapshot 6 полей (1.70).
- ✅ **`2f-17b`** — `print_batch_status` + prefetch (1.71).

### Что закрыто (web)

- ✅ **`bundle-7a-3`** — форма «Создать тару».
- ✅ **`bundle-7a-4ab`** — `parseSampleInput` + `useFillSamples`. 18 тестов.
- ✅ **`bundle-7a-4c-1`** — форма «Заполнить тару».
- ✅ **`bundle-7a-4c-2a`** — `useContainer`, `container_id` в фильтре проб.
- ✅ **`bundle-7a-4c-2b`** — `ContainerPreviewDialog` (3 вкладки).
- ✅ **`bundle-7a-4c-2c`** — preview после save.
- ✅ **`receiving-3d-1`** — API-хуки приёмки.
- ✅ **`receiving-3d-2`** — `ReceiptCheckPage`.
- ✅ **`receiving-3d-3`** — интеграция, `/questions` удалён.
- ✅ **`3f-2`** — кнопка «Акт приёмки».
- ✅ **`2f-1`** — реестр тары: Н/З, ТИ, фильтры, edit, delete + 409.
- ✅ **`2f-2a`** — `SamplesGroupedList` (аккордеоны).
- ✅ **`2f-2b`** — `SampleEditDialog`.
- ✅ **`2f-2c`** — dev-логирование API (ТД-36).
- ✅ **`2f-3a`** — справочники (CRUD, `CatalogEntityDialog`, деактивация, 409).
- ✅ **`2f-4a`** — `/topology` (дерево + DataGrid, `TopologyEntityDialog`, `full_address`).
- ✅ **`2f-4b`** — `PalletDialog`.
- ✅ **`2f-4c-2`** — QR топологии в UI (иконки, batch).
- ✅ **`2f-5a-2`** — `ReceiptItemEditDialog`, отмена партии.
- ✅ **`2f-5b-fix`** — переход на `/receiving/:id/check` при `PARSED + questions_count > 0`.
- ✅ **`2f-5c-2`** — `PENDING_FILLING` в UI, фильтр, клик → `FillContainerDialog`.
- ✅ **`2f-5c-3`** — draft-поля в `ContainerEditDialog`.
- ✅ **`2f-7h`** — компактный реестр тары.
- ✅ **`2f-8a`** — `SamplesTreeTable`.
- ✅ **`2f-9a`** — пропуски и `RangeEditDialog`.
- ✅ **`2f-9b`** — выбранные пробы (`SELECTED`), чёрная галочка.
- ✅ **`2f-9c`** — `FillContainerDialog` для существующих тар.
- ✅ **`2f-10`** — `PlaceContainerDialog`.
- ✅ **`2f-11a`** — `CellContentsDialog`.
- ✅ **`2f-11b`** — `ContainerPreviewDialog` (фильтр, массовая смена статуса).
- ✅ **`2f-11c`** — переходы в Топологию (`?cell_id=`).
- ✅ **`2f-12b`** — `CreateInCellDialog` + force-удаление тары.
- ✅ **`2f-8`** — `/work-orders` (WorkOrderDialog, LinkWorkOrderDialog, WorkOrderContainersDialog).
- ✅ **`2f-8-fix (tsconfig)`** — убран `baseUrl`.
- ✅ **`2f-15`** — предпросмотр этикетки до создания.
- ✅ **`2f-14b`** — вкладка «История» в `ContainerPreviewDialog`.
- ✅ **`2f-17a`** — рефакторинг `FillContainerDialog` → `FillContainerContent`.
- ✅ **`2f-17c`** — `ContainerDetailDialog` (3 вкладки + кнопки), `ContainerPreviewDialog` (модалка), `AddToPrintBatchDialog` (новая/существующая), иконки печати по `print_batch_status`.
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

- ✅ **`bundle-1a` / `1b`** — Flutter init (из 1.2).
- ✅ **`bundle-2`** — API-клиент Dio + JWT.
- ✅ **`bundle-3a`** — `TokenStorage`, `AuthService`, модель `User`.
- ✅ **`bundle-3b`** — `AuthProvider`, экран логина, `AuthGate`.
- ✅ **`bundle-4a`** — `parseQrPayload`, модель `Container`, `ContainerService`.
- ✅ **`bundle-4b-1`** — камера в `AndroidManifest.xml`, геттеры.
- ✅ **`bundle-4b-2`** — сканер QR, `ContainerProvider`, `ContainerDetailScreen`.
- ✅ **`bundle-5`** — список проб, `SampleService`, pull-to-refresh.
- ✅ **`docs/2.x-mobile-update`** — CONTEXT, PLAN, PROGRESS.

### Что осталось (перенесено)

- Приёмка в mobile — отменена (в web).
- Поиск проб, инвентаризация — по требованию.

### Метрики

- Заходов: 8.
- «Не норм» на первом прогоне: 5 (NDK, IP без кавычек, `_qrPrefix`, конфликт `Container`, `ALLOWED_HOSTS`).
- **Итог: 32 юнит-теста.**

---

## Серия `feature/2.x-web`

**Дата:** 2026-10-10
**Ветка:** `feature/2.x-web` (влита в `main`, архив).
**Контекст:** React: Vite 8 + React 19 + TS + MUI 9 + Zustand + TanStack Query + React Router 7.

### Что закрыто

- ✅ **`bundle-1a`** — инициализация.
- ✅ **`bundle-1b`** — ESLint, Prettier, MUI-тема, `App.tsx`.
- ✅ **`bundle-2`** — `axios`, JWT-интерцептор, `tokenStorage`, тесты.
- ✅ **`bundle-3`** — `authStore`, `ProtectedRoute`, `isBootstrapping`.
- ✅ **`bundle-4`** — MUI sidebar + header.
- ✅ **`bundle-5`** — главная, 4 карточки, TanStack Query.
- ✅ **`bundle-6`** — реестр тары DataGrid.
- ✅ **`bundle-7`** — реестр проб DataGrid.
- ✅ **`bundle-8a`** — партии печати (список, детали, add/remove, mark-ready/printed/cancel, PDF).
- ✅ **`bundle-8b`** — bulk «В партию печати».
- ✅ **`bundle-9`** — справочники (просмотр).
- ✅ **`docs/2.x-web-closed`** — CONTEXT, PLAN, PROGRESS.

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
- ✅ **`bundle-3`** — `GET /storage/containers/{id}/label.pdf/`.
- ✅ **`bundle-4a`** — `PrintBatch` + `PrintBatchItem`.
- ✅ **`bundle-4b`** — API партии печати.
- ✅ **`bundle-4d-1`** — раскладка A4.
- ✅ **`bundle-4d-3`** — QR-сетка 8×11.
- ✅ **`bundle-4d-4`** — API печати партии.

### Метрики

- Заходов: 7.
- «Не норм»: 4.
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

- ✅ **`bundle-1`..`3a`** — справочники ResearchType, Site, Laboratory, ContainerComment.
- ✅ **`bundle-4`** — seeds.
- ✅ **`bundle-5`..`5a`** — Sample FK на ResearchType и Site.
- ✅ **`bundle-6a`** — Container: comment, comment_template, PENDING_PLACEMENT.
- ✅ **`bundle-6b`** — WorkOrder: site FK.
- ✅ **`bundle-7a`..`7b`** — модели + API приёмки.
- ✅ **`bundle-8a`** — Shipment: direction, статусы, рейс.
- ✅ **`bundle-8b`** — ContainerType: laboratory.

### Метрики

- Заходов: 13.
- Итог: 400 тестов (было 268).

---

## Серия `feature/1.2-mobile-init`

**Дата:** 2026-10-08
**Ветка:** `feature/1.2-mobile-init` (влита в `2.x-mobile` через merge 2026-10-10).

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
**Ветка:** влита в `main`, архив (commit `d693ffd`).

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