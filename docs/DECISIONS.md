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

### 1.51. 2026-10-08 — Ручной ввод доступен всегда

**Решение:** ручной ввод работает **независимо** от источника данных (QR, Excel, OCR, ЛИМС API).

**Причина:** реальность отличается от идеала; fallback и контроль качества; работает с уже хранящимися тарами.

**Где:** UI — серия 2.x.
**Статус:** ✅ действует.

### 1.52. 2026-10-08 — Портал для лабораторий (Уровень 2)

**Решение:** отдельный раздел веб-приложения для лабораторий-отправителей (создание рейса, сборка, печать, отправка).

**Статус:** ✅ действует (серия 2.0).

### 1.53. 2026-10-09 — Циклические импорты через строковые ссылки

**Решение:** при FK между приложениями, где один импортирует другого — строковые ссылки (`models.ForeignKey("samples.Site", ...)`).

**Причина:** `samples` импортирует `work_orders`, обратная ссылка невозможна без цикла.

**Где:** `backend/apps/*/models.py`.
**Статус:** ✅ действует.

### 1.54. 2026-10-09 — UniqueConstraint с NULL: `(name, laboratory)`

**Решение:** `ContainerType.UniqueConstraint(fields=["name", "laboratory"])`.

**Причина:** в Postgres `NULL <> NULL`, unique не блокирует дубликаты с `laboratory=NULL`.

**Где:** `backend/apps/storage/models.py`.
**Статус:** ✅ действует.

### 1.55. 2026-10-10 — Спецификация этикетки (модель 4d)

**Решение:** формат этикетки — сетка размеров (ширины `[110,130,150,180,210]`, высоты `[37,49,74,99,148]`), авто-выбор под содержимое. Шапка 28 мм с QR 25×25. Шрифт 10 pt.

**Причины:** один формат адаптивен; экономия бумаги; читаемый шрифт.

**Где:** `backend/apps/labels/services/label_service.py`.
**Статус:** ✅ действует.

### 1.56. 2026-10-10 — `PrintBatch`: soft-delete через `CANCELLED`

**Решение:** партия не удаляется физически, отмена — `status = CANCELLED`. `PRINTED` отменить нельзя.

**Причина:** история печати; единообразно с `Shipment` и `Sample`.

**Где:** `backend/apps/labels/models.py`.
**Статус:** ✅ действует.

### 1.57. 2026-10-10 — `PrintBatchItem.container` — PROTECT

**Решение:** при удалении тары из партии — `ProtectedError`. При удалении партии items каскадом, тара остаётся.

**Причина:** тару, по которой печатали, молча не удаляем.

**Где:** `backend/apps/labels/models.py`.
**Статус:** ✅ действует.

### 1.58. 2026-10-13 — Синхронизация статусов Sample ↔ Container — явный сервис

**Решение:** `sync_sample_status_for_container(container)` из сервисного слоя. Django signals не используем.

**Правила:** `ACTIVE → IN_STORAGE`, `PENDING_PLACEMENT → PENDING_PLACEMENT`, `IN_TRANSIT → IN_TRANSIT`. `DISPOSED`, `CONSUMED`, `SELECTED` не перезаписываются. Неизвестный → 0 без исключений.

**Уточнение (1.62):** для `PENDING_FILLING` маппинга нет.

**Уточнение (2f-9c):** `ISSUED` и `PENDING_DECRYPTION` удалены из `Sample.STATUS_CHOICES`.

**Где:** `backend/apps/samples/services.py`.
**Статус:** ✅ действует.

### 1.59. 2026-10-13 — Разделение bulk-create на два эндпоинта

**Решение:** `POST /storage/containers/bulk-create/` — только тары. `POST /storage/containers/{id}/fill-samples/` — пробы.

**Правила:** одна тара = один ТИ; повторное заполнение тем же ТИ разрешено; статус проб синхронизируется (1.58).

**Где:** `backend/apps/storage/`.
**Статус:** ✅ действует.

### 1.60. 2026-10-13 — Container: draft-поля + nullable `container_number`

**Решение:** `container_number` → nullable. +4 draft-поля: `draft_site`, `draft_research_type`, `draft_work_order_coded`, `draft_work_order_incoming`.

**Жизненный цикл:** заготовка (`bulk-create`) → заполнение (`fill-samples`) → размещение.

**Где:** `backend/apps/storage/models.py`, миграция `0005_*`.
**Статус:** ✅ действует. **Уточнение 1.61:** `unique` снят. **Уточнение 1.69:** draft-поля обновляются из запроса.

### 1.61. 2026-10-15 — `Container.container_number` без глобальной уникальности

**Решение:** снять `unique=True` (миграция `storage/0006_*`).

**Семантика:** номер тары — метка внутри группы (Н/З × ТИ). Идентификатор — `id`. В QR `WMSG:CONTAINER:<id>`.

**Что не сделали:** составной `UniqueConstraint((Н/З, ТИ, номер))` отвергнут — draft-поля обнуляются/обновляются, привязка через `ReceiptItem` не всегда возможна.

**Где:** `backend/apps/storage/models.py`, миграция `storage/0006_*`.
**Статус:** ✅ действует.

### 1.62. 2026-10-16 — Новый статус `Container.STATUS_PENDING_FILLING`

**Решение:** статус «Ожидает заполнения» — тара создана (bulk-create или check_receipt), но пробы не положены.

**Семантика:** `PENDING_FILLING → PENDING_PLACEMENT → ACTIVE`.

**Что не делаем:** маппинг `PENDING_FILLING → Sample.status` не задаём (проб нет).

**Миграция:** `storage/0008_*` + data-migration (старые `PENDING_PLACEMENT` без проб → `PENDING_FILLING`).

**Где:** `backend/apps/storage/models.py`, `apps/storage/services/bulk_create.py`, `apps/receiving/services/import_service.py`.
**Статус:** ✅ действует.

### 1.63. 2026-10-16 — PDF QR топологии (Section, Cell)

**Решение:** автогенерация `qr_code` для `Section`/`Cell` в `save()`. Отдельный PDF-рендер (A4, сетка 2×3, QR 65×65, адрес под QR).

**Эндпоинты:** `GET /storage/sections/{id}/qr.pdf/`, `GET /storage/cells/{id}/qr.pdf/`, `POST /storage/sections/qr-batch/`.

**Где:** `backend/apps/storage/models.py`, `apps/storage/services/qr_topology.py`, `apps/storage/views.py`.
**Статус:** ✅ действует.

### 1.64. 2026-10-16 — Каскадное удаление `ReceiptItem`

**Решение:** `DELETE /receipt-items/{id}/` удаляет строку с тарой и пробами, одной транзакцией. `ProtectedError` → 409.

**Причина:** атомарность; защита для «настоящих» связей.

**Где:** `backend/apps/receiving/views.py`.
**Статус:** ✅ действует.

### 1.65. 2026-10-27 — Force-удаление тары

**Решение:** `DELETE /storage/containers/{id}/?force=true` — принудительно, с пробами. 409 если `PrintBatchItem`.

**Где:** `backend/apps/storage/views.py`, `web/src/api/containers.ts`.
**Статус:** ✅ действует.

### 1.66. 2026-10-27 — Статус `Sample.STATUS_SELECTED`

**Решение:** пробы «Выбранные» → `SELECTED`. Защищён от перезаписи (1.58). На этикетке — чёрная галочка.

**Где:** `backend/apps/samples/models.py`, `apps/samples/services.py`, `apps/labels/services/label_service.py`.
**Статус:** ✅ действует.

### 1.67. 2026-10-27 — Создание тары прямо в ячейке

**Решение:** `POST /storage/containers/create-in-cell/` — три операции в одной транзакции.

**Где:** `backend/apps/storage/views.py`, `serializers.py::CreateInCellSerializer`.
**Статус:** ✅ действует.

### 1.68. 2026-10-27 — Переиспользование ID (BigAutoField)

**Решение:** ID не переиспользуются (стандартный `BigAutoField`).

**Причина:** защита от путаницы (старый QR с ID 150 может случайно отсканироваться после переиспользования).

**Статус:** ✅ норма.

### 1.69. 2026-10-27 — `fill-samples` обновляет draft-поля из запроса

**Решение:** draft-поля обновляются значениями из запроса (не обнуляются, не «как были»).

**Причина:** повторное заполнение тары (тот же ТИ, другой диапазон) — draft-поля должны быть актуальны.

**Где:** `backend/apps/storage/views.py`.
**Статус:** ✅ действует.

### 1.70. 2026-10-27 — Аудит операций с тарой

**Решение:** `AuditLog` через явный `log_audit()` (не signals). 6 действий в `ContainerViewSet` (`CREATE`, `UPDATE`, `DELETE`, `FILL_SAMPLES`, `PLACE`, `CREATE_IN_CELL`). Snapshot — 6 полей. `GET /storage/containers/{id}/history/`.

**Причина:** прозрачность «кто, когда, что».

**Где:** `backend/apps/users/services.py`, `apps/users/serializers.py`, `apps/storage/views.py`.

**Регресс и фикс:** в `c-6a-pre` параметр `old_value` был случайно удалён из `log_audit`. Восстановлен, `AuditLog.old_value` снова заполняется (diff UPDATE/DELETE).

**Статус:** ✅ действует.

### 1.71. 2026-10-27 — `print_batch_status` в `ContainerSerializer`

**Решение:** `print_batch_status` — статус последней не-`CANCELLED` партии печати. 4 значения: `null` / `DRAFT` / `READY` / `PRINTED`. `prefetch_related(Prefetch(...))` для N+1.

**Где:** `backend/apps/storage/serializers.py`, `apps/storage/views.py`.
**Статус:** ✅ действует.

### 1.72. 2026-10-27 — `ContainerDetailDialog`: единое окно тары

**Решение:** клик по таре открывает диалог с шапкой, кнопками `[Предпросмотр] [Разместить / Местоположение]` и 3 вкладками (Пробы / Редактирование / История).

**Где:** `web/src/components/ContainerDetailDialog.tsx`, `ContainerPreviewDialog.tsx`, `AddToPrintBatchDialog.tsx`, `ContainersPage.tsx`, `CellContentsDialog.tsx`.
**Статус:** ✅ действует.

### 1.73. 2026-10-29 — Изоляция настроек сборки для рабочего ПК (Proxy Bypass)

**Решение:** изолированный набор настроек, **не коммитится**. Компоненты:
1. `work-pc-setup/` — сертификаты, `maven-local`, `setup.ps1`.
2. `local.properties` в `mobile/android/`.
3. `~/.gradle/gradle.properties` — `org.gradle.java.home`.
4. Флаг `--android-skip-build-dependency-validation`.
5. `FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`.
6. `wms-bundle/install_bundle.ps1`.

**Причина:** прокси `Polymetal.ru` блокирует `dl.google.com` и `plugins.gradle.org`; изоляция позволяет вернуть Flutter SDK одной командой.

**Уточнение 2026-11-02 (после `c-6c`):** после `git reset --hard` на рабочем ПК `setup.ps1` **обязателен** — теряются сертификаты, `maven-local`, `aapt2FromMavenOverride`, NDK source.properties, Kotlin heap. В `mobile/android/gradle.properties` дополнительно нужны `aapt2FromMavenOverride`, `kotlin.incremental=false`, `kotlin.compiler.execution.strategy=in-process`, `org.gradle.parallel=false`, `org.gradle.workers.max=2`.

**Где:** `work-pc-setup/`, `mobile/android/local.properties`, `~/.gradle/gradle.properties`.
**Статус:** ✅ действует (только рабочий ПК).

### 1.74. 2026-10-30 — JSON + gzip для файловой синхронизации

**Решение:** для sneakernet (`c-5`, отложено) — `.json.gz`, структура `{version, kind, token_hash, user, expires_at, data}`.

**Причина:** не зависит от схемы БД; gzip; проверка `token_hash`.

**Статус:** ✅ действует (спецификация для `c-5`).

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
**Статус:** ✅ действует (реализовано в `c-6b`).

### 1.77. 2026-10-30 — Offline-печать этикеток на Mobile

**Решение:** генерация PDF на клиенте (Dart `pdf`) без сервера.

**Причина:** мобилка должна работать без сервера; печать после оцифровки.

**Где:** `mobile/lib/services/label_service.dart` (план `c-7f`).
**Статус:** ✅ действует (спецификация для `c-7f`).

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

**Цена:** 2 с задержки на старте, если сеть есть (параллельно, приемлемо). Если сети нет — 2 с таймаут.

**Где:** `mobile/lib/services/network_probe.dart`, `mobile/lib/config.dart::AppConfig.resolve`, `mobile/lib/main.dart`.
**Статус:** ✅ действует (реализовано в `c-6c`).

### 1.81. 2026-11-02 — ScanWindow: `_pickBarcodeInScanWindow` + landscape swap

**Решение:** два механизма фильтрации области сканирования:
1. `scanWindow` в `MobileScanner` — native-ограничение (если работает).
2. `_pickBarcodeInScanWindow` в `_onDetect` — ручной фильтр по центру `corners` → `BoxFit.cover`.

**Проблема:**
- Native `scanWindow` в `mobile_scanner 7.4.2` на Android не ограничивает область (issue #633).
- `BarcodeCapture.rotation` в 7.4.2 не существует (попытка `c-6d-fix-2` откачена).
- `Barcode.scaleCorners` не учитывает landscape (тоже откатано).

**Landscape-фикс (`c-6d-fix-3`):** в ландшафте `capture.size` остаётся портретным (1440×1920), а `corners` приходят в rotated системе (1920×1440). `mapImageToWidgetFrame` делает swap effectiveSize, если `widget landscape + image portrait`.

**DetectionSpeed:** `normal` (не `noDuplicates`) — иначе после reject тот же QR не сработает, даже если его занести в рамку. Дублирующую обработку блокирует флаг `_handled`.

**Где:** `mobile/lib/utils/scan_window.dart`, `mobile/lib/screens/scanner_screen.dart`.
**Статус:** ✅ действует (реализовано в `c-6d-fix` + `c-6d-fix-3`).

### 1.82. 2026-11-02 — `NetworkStatusProvider` (heartbeat `/health/` 10 с)

**Решение:** вместо откаченного `c-6f` (`NetworkMonitor` с `WidgetsBindingObserver`) — упрощённый `NetworkStatusProvider`:
- `Timer.periodic(interval=10s)` → `GET /health/` текущего `AppConfig.apiHost` (2 с таймаут).
- При неудаче — `NetworkProbe.resolve()` (auto-detect заново).
- При смене хоста — `onBaseUrlChanged(url)` → `ApiClient.dio.options.baseUrl = url`.
- При `--dart-define=API_HOST` — только статус, без swap.

**Причина:**
- `WidgetsBindingObserver` в `NetworkMonitor` давал регресс (конфликт lifecycle).
- Heartbeat 10 с — компромисс между «свежестью» и батареей.
- `NetworkBadge` читает `isOnline` через `context.select`, перерисовывается без перезахода.

**Где:** `mobile/lib/providers/network_status_provider.dart`, `mobile/lib/widgets/network_badge.dart`, `mobile/lib/main.dart`.
**Статус:** ✅ действует.

### 1.83. 2026-11-02 — Синхронизация запрещена при офлайне / pendingOffline

**Решение:** кнопка «Синхронизация» на `HomeScreen` и все действия на `SyncScreen` (Pull / Push / SyncAll / RetryErrors) `disabled`, если `!NetworkStatusProvider.isOnline` **или** `AuthProvider.isPendingOffline`.

**Причина:**
- `AuthProvider.isOffline` обновляется только при `initialize` / `login` / `logout` — стареет. `NetworkStatusProvider.isOnline` — свежий (heartbeat 10 с).
- Pending-offline — пользователь ещё не подтверждён JWT, синхронизация невозможна.

**UI:**
- `HomeScreen`: `Consumer2<SyncProvider, NetworkStatusProvider>`, `blocked = !net.isOnline || auth.isPendingOffline`, иконка `cloud_off`, текст «Синхронизация (нет связи)», tooltip.
- `SyncScreen`: `_OfflineBanner` (красный Card) сверху, все кнопки `disabled`.

**Где:** `mobile/lib/screens/home_screen.dart`, `mobile/lib/screens/sync_screen.dart`.
**Статус:** ✅ действует.

### 1.84. 2026-11-02 — Иконка сети на `LoginScreen`

**Решение:** `NetworkBadge` в `AppBar.actions` `LoginScreen` — видно статус до входа. `AppBar` прозрачный (`elevation: 0`, `backgroundColor: Colors.transparent`), карточка логина не сдвигается.

**Причина:** до ввода пароля пользователь должен знать, есть ли связь с сервером (особенно на работе с USB).

**Тест:** `widget_test.dart` обёрнут в `MultiProvider` с `NetworkStatusProvider` (иначе `ProviderNotFoundException`).

**Где:** `mobile/lib/screens/login_screen.dart`, `mobile/test/widget_test.dart`.
**Статус:** ✅ действует.

### 1.85. 2026-11-02 — Адаптив карточки тары (портрет / ландшафт)

**Решение:** `ContainerDetailScreen` использует `LayoutBuilder` и два layout'а:
- **Портрет** (`maxWidth < maxHeight`): `AppBar` + `TabBar.bottom`, шапка в `SliverToBoxAdapter` (`NestedScrollView`) — растягивается на натуральную высоту, при скролле уезжает. `TabBarView` в body.
- **Ландшафт** (`maxWidth > maxHeight`): `Row`, слева панель ~40% ширины (`clamp 320..460`) со шапкой (скроллится независимо), справа `TabBar` + `TabBarView` на всю высоту.
- Кнопки `[Предпросмотр] [Разместить]` — в `bottomNavigationBar` + `SafeArea`, не уходят под системный бар.

**Причина:**
- `SliverAppBar.flexibleSpace` ограничивает шапку toolbar+tabbar → 216 px, шапка обрезается и наезжает на вкладки.
- В ландшафте `~600 px` высоты, шапка сверху съедала всё.
- `RefreshIndicator` на `Column` не работал (нет scrollview) — убран, вместо него кнопка `[Обновить]` в `AppBar.actions`.

**Где:** `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.86. 2026-11-02 — Форма шапки тары в bottom sheet

**Решение:** кнопка ✏ в `AppBar.actions` открывает `showModalBottomSheet` с `ContainerEditForm`. Вкладка «Редактирование» занята `FillContainerContent` (как в вебе), форма шапки не дублирует.

**Поля формы:** `container_number`, `container_type`, `comment`, `position_on_pallet`, `draft_site`, `draft_research_type`, `draft_work_order_coded`, `draft_work_order_incoming`. Справочники — `CatalogService`.

**Причина:**
- В вебе форма шапки — отдельный `ContainerEditDialog`, не в карточке. Mobile объединяет: 3 вкладки как в вебе + форма шапки через карандаш.
- Bottom sheet (а не dialog) — удобнее в портрете на планшете (max 85% высоты, скролл).

**Где:** `mobile/lib/widgets/container_edit_form.dart`, `mobile/lib/screens/container_detail_screen.dart`.
**Статус:** ✅ действует.

### 1.87. 2026-11-02 — `FillContainerContent` на mobile (Dart-порт веба)

**Решение:** вкладка «Редактирование» = Dart-порт `FillContainerContent.tsx`:
- `parseSampleInput` — Dart-порт парсера диапазонов (`TAA-A34076001-031`, `TST124001-005`, `TAA-A34076001`).
- `buildSampleNumbers` — полные номера.
- `RangeEditDialog` — skip / selected.
- `parseIntRanges` / `formatIntRanges` — `"2, 4-7"` ↔ `[2,4,5,6,7]`.
- Submit: `SampleService.fillSamples` + `deleteSample` для удалённых.

**`wellName`:** если `draftWorkOrderIncoming` пуст → `middle` (нешифрованная); иначе → `null` (шифрованная).

**Причина:** паритет с web. Один и тот же UX заполнения тары.

**Где:** `mobile/lib/utils/sample_range_parser.dart`, `mobile/lib/utils/int_ranges.dart`, `mobile/lib/widgets/fill_container_content.dart`, `mobile/lib/widgets/range_edit_dialog.dart`.
**Статус:** ✅ действует.

### 1.88. 2026-11-02 — Вкладка «Пробы» как в вебе

**Решение:** вкладка «Пробы» `ContainerDetailScreen`:
- поиск (номер пробы / скважина);
- чекбоксы (индивидуальные + «все»);
- bulk-статус: dropdown `SampleStatus` + кнопка [Применить] (последовательный `PATCH`, ошибки — SnackBar);
- `SampleStatusChip` — цветной чип статуса (success/warning/info/error по статусу);
- ✏ у каждой пробы → `SampleEditDialog` (edit / dispose / restore / delete).

**`SampleEditDialog`:** поля `sample_number`, `research_type`, `site`, `status`. Действия `dispose` / `restore` / `delete` через `SampleService`. Отдаёт `true` — родитель перезагружает список и историю.

**`SampleStatusChip`:** цвета — `IN_STORAGE` green, `IN_TRANSIT` blue, `CONSUMED`/`PENDING_PLACEMENT` orange, `DISPOSED` red, `SELECTED` / `unknown` surface.

**Причина:** паритет с `ContainerDetailDialog.tsx` (вкладка «Пробы»).

**Где:** `mobile/lib/models/sample.dart` (`sampleStatusToApi`), `mobile/lib/services/sample_service.dart` (`fetchById`, `update`, `dispose`, `restore`), `mobile/lib/widgets/sample_status_chip.dart`, `mobile/lib/widgets/sample_edit_dialog.dart`, `mobile/lib/screens/container_detail_screen.dart`, `mobile/lib/widgets/fill_container_content.dart`.
**Статус:** ✅ действует.

### 1.89. 2026-11-02 — История сканов с `Н/З · ТИ · номер`

**Решение:** `ScanHistoryService` хранит `List<ScanHistoryEntry>` (JSON-строки) в `shared_preferences` (ключ `scan_history_entries`). Чип на главной:
- `<Н/З> · <ТИ> · <номер>` — полный;
- `<Н/З> · <ТИ>` — заготовка без номера;
- `<номер>` — без Н/З и ТИ;
- `Тара #ID` — fallback (старый формат).

**Миграция:** при первом чтении, если `scan_history_entries` пуст, но есть старый `scan_history_ids` (`List<int>`) → преобразуются в `ScanHistoryEntry` с fallback-label, старый ключ удаляется.

**Порядок полей (c-7h-fix):** именно `Н/З · ТИ · номер`, не наоборот.

**Причина:** «Тара #185» бесполезен в UI. Снимок из `Container` (`draftWorkOrderCoded`, `draftResearchTypeName`, `containerNumber`) сразу показывает контекст.

**Где:** `mobile/lib/models/scan_history_entry.dart`, `mobile/lib/services/scan_history_service.dart`, `mobile/lib/screens/home_screen.dart`, `mobile/lib/screens/scanner_screen.dart`.
**Статус:** ✅ действует.

### 1.90. 2026-11-02 — Правило: перед `git add` — `git status --short`

**Решение:** при выдаче закрывающего блока с `git add` **перед** `git add` выполнять:

```bash
git status --short | grep "mobile/lib"
Все M (modified) и ?? (untracked) из mobile/lib/* включать в git add явными именами. mobile/android/* и tools/ — не включать (правило 15).

Причина:

Дважды за сессию (c-7b, c-7h) файлы остались uncommitted — flutter analyze и flutter test проходили (файлы физически на диске), но git clone с нуля ломался.

Дозакоммиты c-7b-fix / c-7h-fix-2 — некрасивая история.

Где: чек-лист перед закрытием захода; в CONTEXT.md §«Mobile» — уже добавлено.
Статус: ✅ действует.

1.91. 2026-11-02 — Не выдавать код следующего захода, пока текущий не закоммичен
Решение: перед выдачей кода следующего захода — проверка:

bash
git status --short | grep "mobile/lib"
Пусто — можно выдавать. M / ?? из mobile/lib/* — сначала закоммитить, потом выдавать.

Причина: за сессию три случая (c-7b, c-7d, c-7h) смешавшихся или не закоммиченных файлов. flutter analyze / flutter test проходят (файлы физически на диске), но git clone с нуля ломается; история обрастает дозакоммитами (c-7b-fix, c-7h-fix-2).

Отличается от 1.90: 1.90 — проверка перед git add (закрытие захода), чтобы всё mobile/lib/* попало в коммит. 1.91 — проверка перед выдачей кода нового захода, чтобы предыдущий был закрыт.

Где: чек-лист перед каждым заходом; CONTEXT.md §«Правила текущей сессии» — обновлено.
Статус: ✅ действует.

2. Что не делаем и почему
Не используем SampleParts — разделение вне WMS.

Не храним две колонки для Н/З — не масштабируется.

Не заставляем лаборатории использовать наш формат.

Не переклеиваем старые этикетки.

Не используем закрытые лицензии в ядре.

Не создаём кастомную модель User.

Не используем Django fixtures для seeds.

Не запускаем Django-команды через кнопку «Run» в VS Code.

Не клеим QR на поддоны и пробы в MVP.

Не удаляем пробы физически без явного DELETE с обработкой ProtectedError.

Не блокируем размещение при превышении вместимости.

Не реализуем bin packing и учёт веса в MVP.

Не реализуем логику керна в MVP.

Не патчим миграции v1 через 0002.

Не используем session-based auth для API.

Не пишем OpenAPI вручную.

Не создаём SampleDecryption на MVP.

Не парсим номер пробы позиционно.

Не навязываем свой формат Excel.

Не используем pillow 10.4 (11.3).

Не полагаемся на сортировку кириллицы в БД.

Не импортируем модели напрямую при циклах.

Не печатаем ID под QR (внутри payload).

Не масштабируем шрифт этикетки вниз — 10 pt всегда.

Не разрываем этикетку между листами A4.

Не используем A5 как лист печати.

Не используем Django signals для sync-логики (1.58).

Не используем Django signals для аудита (1.70).

Не создаём тару с обязательным container_number в bulk-create (1.60).

Не считаем container_number глобально уникальным (1.61).

Не задаём маппинг PENDING_FILLING → Sample.status (1.62).

Не используем полные этикетки тары для QR секций/ячеек (1.63).

Не обнуляем draft-поля после fill-samples (1.69).

Не используем baseUrl в tsconfig.json (TS ≥4.4).

Не пишем аудит через Django signals (1.70).

Не считаем print_batch_status = CANCELLED (1.71).

Не коммитим сертификаты прокси и локальные Maven-пути (1.73).

Не делаем автоматическое слияние конфликтов синхронизации — last write wins.

Не хардкодим IP в config.dart — только String.fromEnvironment или probe (1.80).

Не пишем healthcheck в /api/v1/ — вне, без авторизации (1.78).

Не принимаем ?updated_since= без таймзоны — naive → 400 (1.79).

Не используем Barcode.scaleCorners — не учитывает landscape (1.81).

Не полагаемся на native scanWindow — фильтруем вручную (1.81).

Не используем WidgetsBindingObserver для heartbeat сети (был регресс в c-6f, 1.82).

Не разрешаем синхронизацию при isPendingOffline (1.83).

Не держим форму шапки в вкладке «Редактирование» — там FillContainerContent как в вебе (1.86).

Не дублируем ТИ / Н/З под каждой пробой — они в шапке тары (1.85, c-7f-fix).

Не храним историю сканов как List<int> — только ScanHistoryEntry с JSON (1.89).

Не выдаём git add без git status --short | grep "mobile/lib" (1.90).

Не выдаём код нового захода, пока предыдущий не закоммичен (1.91).

3. Глоссарий
Данные
Термин	Что значит
Проба (Sample)	Физическая единица хранения = навеска.
Навеска	То же, что Проба.
Наряд-заказ (Н/З)	Группа проб. INCOMING / CODED.
Тип исследования (ТИ)	ResearchType. ШЛ, ХА, ИЗ.
Участок (Site)	Место отбора проб.
Лаборатория (Laboratory)	Откуда пришла проба.
Тара (Container)	Физический контейнер.
Тара-заготовка	Container без container_number, с draft-полями, PENDING_FILLING.
Draft-поля тары	draft_site, draft_research_type, draft_work_order_coded, draft_work_order_incoming.
Тип тары (ContainerType)	Общий или для конкретной лаборатории.
Поддон (Pallet)	«Тихий» объект. OneToOne с ячейкой.
Ячейка (Cell)	Место на ярусе. 1 поддон.
Секция	Пролёт с 4 ярусами A–D.
Скважина (Well)	Источник пробы.
Партия (Receipt)	Группа тары, приехавшая одной машиной.
Рейс (Shipment)	Отправка. INBOUND / OUTBOUND.
Партия печати (PrintBatch)	Корзина тар для массовой печати.
Группа (Н/З × ТИ)	Контекст, внутри которого номер тары уникален.
AuditLog	Журнал значимых действий. log_audit() (1.70).
print_batch_status	Статус последней не-CANCELLED партии печати (1.71).
Health-эндпоинт	GET /health/ — 200 без авторизации (1.78).
Процесс
Термин	Что значит
Шифровка	Присвоение Н/З нового названия.
Приёмка	Поступление тары.
Двухфазная приёмка	Excel → предзаполнение → подтверждение.
Акт приёмки	PDF с расхождениями (1.50).
Формирование поддона	Сбор тар на поддон.
Выборка (picking)	Извлечение проб по списку.
Отправка (shipment)	Группа проб.
Утилизация	Soft-delete (DISPOSED).
Инвентаризация	Сверка физического наличия.
Расхождение (issue)	Проблема по инвентаризации.
Помощник по сортировке	Рекомендация места.
Префикс	Код участка или лаборатории в номере пробы.
Партия (шифр)	5 цифр в шифрованном номере.
Порядковый номер (sequence)	Последние цифры номера пробы.
Портал лаборатории	Веб-раздел для лабораторий.
Продолжение этикетки	Вторая этикетка без шапки.
Sync-сервис	Явная функция синхронизации статусов (1.58).
Аудит	Журнал действий с объектом (1.70).
Deferred Offline Login	Вход по QR без сети (1.75).
Offline-печать	PDF на мобилке без сервера (1.77).
Auto-detect сети	Probe /health/ → выбор apiBaseUrl (1.80).
ScanWindow	Мёртвая зона 220×220 (1.81).
Incremental Pull	?updated_since= (1.79).
NetworkStatusProvider	Heartbeat /health/ 10 с, isOnline, auto-switch (1.82).
NetworkBadge	Иконка cloud_done / cloud_off / vpn_key в AppBar (1.82).
ContainerEditForm	Форма шапки тары в bottom sheet (1.86).
FillContainerContent (mobile)	Вкладка «Редактирование» — диапазоны + skip/selected + удаление (1.87).
ScanHistoryEntry	Снимок истории сканов Н/З · ТИ · номер (1.89).
SampleEditDialog (mobile)	Диалог редактирования пробы (edit / dispose / restore / delete) (1.88).
SampleStatusChip	Цветной чип статуса пробы (1.88).
LabelData (offline)	Модель для offline-рендера PDF этикетки (1.77, c-7f-1).
label_pdf_generator	Offline-рендер PDF на Dart, порт label_service.py (1.77, c-7f-2).
Инфраструктура
Термин	Что значит
Docker Compose	PG в контейнере (домашний ПК).
Портативный PostgreSQL	PG без установки (рабочий ПК).
poetry run	Запуск в venv.
JWT	JSON Web Token.
drf-spectacular	Генератор OpenAPI 3.
fpdf2	Генерация PDF (Python).
Proxy Bypass	Набор настроек рабочего ПК (1.73).
adb reverse	Проброс порта ПК на планшет через USB.
FLUTTER_STORAGE_BASE_URL	Зеркало engine-артефактов Flutter.
UI
Термин	Что значит
Дашборд	Главный экран.
Сканер	Экран сканирования.
Виртуальный вид секции	Ярусы A–D и ячейки.
Корзина печати	Пул тар для массовой печати.
Единое окно тары	ContainerDetailDialog (1.72).
Модалка предпросмотра	ContainerPreviewDialog (1.72).
SyncScreen	Экран ручной синхронизации.
4. Что НЕ значат эти термины
«Часть пробы» — не используется. Есть навеска.

«Логическая проба» — не сущность в системе.

«Ячейка» — не слот на 3 поддона. 1 поддон.

«Поддон» — «тихий» объект, без QR.

«Наряд-заказ» — входящий и зашифрованный — разные строки.

«Проба» — не уникальна по номеру.

«User» — Django-овский.

«Справочник» — редактируемый, не жёсткий choices.

«Префикс» — не часть sequence.

«Партия в номере» — не Receipt.

«Рейс» — не одна тара.

«ContainerType.laboratory = NULL» — не «без лаборатории», а «общий тип».

«Тара-заготовка» — не «пустая тара физически». Это Container без container_number.

«Container.container_number» — не уникален глобально (1.61).

«PENDING_FILLING» — состояние в системе (1.62).

«Draft-поля тары» — обновляются актуальными значениями (1.69).

«baseUrl в tsconfig.json» — не используется.

«AuditLog» — не Django signals, только явные вызовы (1.70).

«print_batch_status» — не «все партии», только последняя не-CANCELLED (1.71).

«ContainerDetailDialog» — не «редактор», а просмотр + действия (1.72).

«Proxy Bypass» — не «взлом прокси». Легальная настройка (1.73).

«Deferred Offline Login» — не «вход без пароля», а отложенная синхронизация токена.

«Health-эндпоинт» — не «API v1». Вне /api/v1/, без авторизации (1.78).

«?updated_since=» — не «фильтр для Web». Только для Mobile Pull (1.79).

«Auto-detect» — не «выбор по IP-адресу в коде», а probe /health/ (1.80).

«ScanWindow» — не «native-ограничение», а _pickBarcodeInScanWindow (1.81).

«NetworkStatusProvider» — не NetworkMonitor (тот откачен, 1.82).

«FillContainerContent» на mobile — не диалог, а вкладка (1.87). В вебе — тоже без Dialog, вынесен (2f-17a).

«ScanHistoryEntry» — не полный Container, только снимок (1.89).

«ContainerEditForm» — не «редактор вкладки», а bottom sheet (1.86).

«Н/З · ТИ · номер» — именно в этом порядке (c-7h-fix).