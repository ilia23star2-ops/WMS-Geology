# PLAN.md — что делаем и что дальше

> Роадмап, ветки, техдолг, бэклог.
> Сюда идут все идеи «на будущее» — см. `RULES.md` §11.

**Дата обновления:** 2026-11-11

---

## Стратегия

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.**
2. **Mobile — по требованию.**
3. **Роли и права — после.**
4. **`Receipt`** — только для Excel и акта приёмки.

---

## Ближайший план

**План серии 2.x-lab-portal:**

| # | Заход | Что делает | Статус |
|---|---|---|---|
| 1 | backend | `UserProfile.laboratory`, `lab_worker`, `mark-received`, `current_holder` | ✅ |
| 2 | web: фильтр | `?my_lab=true`, вкладки «Все/Исх/Вх», кнопка «Принять», `current_holder` | ✅ |
| 3 | web: sidebar | `Sidebar` по роли, `create-return` action, «Вернуть остатки» | ✅ |


**Активная серия:** `feature/3.x-migration` (OCR, активна с 2026-11-13).
**Ветка:** `feature/3.x-migration`.
Серия `2f` — **закрыта полностью**.

**План серии 3.x-migration (OCR, активна):**

| # | Заход | Что делает | Статус |
|---|---|---|---|
| c-3.x-migration-1/2 | Mobile: Tesseract→сервер | Удалён локальный OCR, `scanner_screen` без OCR-ссылок | ✅ |
| c-3.x-migration-3 | Серверный OCR | Модели `OcrBatch`/`OcrTask`, `POST /api/v1/ocr/recognize/`, `ocr_runner.py` (EasyOCR на python312), warmup, smoke, 14 тестов | ✅ |
| c-3.x-migration-5a | Approve API | `POST /api/v1/ocr/tasks/{id}/approve/`, 4 эндпоинта, 8 тестов | ✅ |
| c-3.x-migration-5b | Web: экран проверки | `OcrReviewPage.tsx`, bbox-overlay, approve, 6 тестов | ✅ |
| c-3.x-migration-5c | Web: список батчей + sidebar + справочники в форме | `OcrBatchesPage.tsx`, `OcrBatchDetailPage.tsx`, пункт в sidebar, `useContainerTypes`/`useResearchTypes`/`useSites` в форме, placeholder `001-031` | ⬜ |

**План серии 3.x-offline:**

| # | Заход | Что делает | Статус |
|---|---|---|---|
| c-1 | SQLite | Таблицы `containers`, `samples`, DAO | ✅ |
| c-2 | SyncService (Pull) | Постраничная синхронизация | ✅ |
| c-3 | SyncQueue (Push) | Очередь, отправка | ✅ |
| c-4 | UI офлайн-режима | `SyncProvider`, `SyncScreen` | ✅ |
| c-4.5 | Deferred Offline Login | QR с base64-JSON | ✅ |
| c-4.6 | USB-режим | `adb reverse`, SQLite v4 | ✅ |
| c-6a-pre | Pre-existing fix | `log_audit(old_value)`, stale-тесты | ✅ |
| c-6a | Health + денормализация | `GET /health/`, `*_name` поля | ✅ |
| c-6b | Инкр. Pull (backend) | `?updated_since=` | ✅ |
| c-6c | Auto-detect сети | `NetworkProbe`, `AppConfig.resolve` | ✅ |
| c-6d-fix | ScanWindow | 220×220 | ✅ |
| c-6d-fix-3 | Landscape-fix | swap effectiveSize | ✅ |
| c-6g | `NetworkStatusProvider` | heartbeat 10 с + `NetworkBadge` | ✅ |
| c-6g-tap-ping | Тап на иконке → `pingNow()` | быстрый реконект | ✅ |
| c-6h | Блок синхронизации | disabled при офлайне | ✅ |
| c-6g-login | Иконка на Login | `NetworkBadge` | ✅ |
| c-7a | Карточка тары | 3 вкладки + адаптив | ✅ |
| c-7b | Форма шапки | `ContainerEditForm` | ✅ |
| c-7f | FillContainerContent | диапазоны, skip/selected | ✅ |
| c-7g | Вкладка «Пробы» | поиск, bulk, `SampleEditDialog` | ✅ |
| c-7h | История сканов | `Н/З · ТИ · номер` | ✅ |
| c-7d | PDF предпросмотр (online) | `ApiClient.download` + `open_filex` | ✅ |
| c-7f-1 | Offline-PDF: подготовка | ассеты, `LabelData` | ✅ |
| c-7f-2 | Offline-PDF: рендер | `pw.Text`, `pw.BarcodeWidget` | ✅ |
| c-7c | Разместить / Местоположение | `PlaceContainerDialog`, offline через `sync_queue` | ✅ |
| c-7-offline-catalog | Кэш справочников | SQLite v5, `CatalogDao` | ✅ |
| c-7e-1 | Fix `SampleService` офлайн | пустой кэш не ошибка | ✅ |
| c-7e-2 | Кэш истории тары | SQLite v6, `ContainerHistoryDao` | ✅ |
| c-7e-3 | Pre-fetch истории в Pull | `SyncService.pullAll` | ✅ |
| c-9-drawer | Drawer (гамбургер) | разделы как в вебе | ✅ |
| c-9-container-list | Реестр тары | фильтры, пагинация, офлайн-кэш | ✅ |
| c-9-container-list-order | Порядок в карточке | Н/З · ТИ крупно, Тип · номер | ✅ |
| c-9-overflow-fix | Overflow в реестре | `isExpanded`, `Wrap`, адаптив | ✅ |
| c-9-overflow-fix-2 | Overflow в bulk-статусе | `isExpanded`, отдельная строка | ✅ |
| c-9-container-create | Создание тары | `CreateContainersDialog`, `bulk-create` | ✅ |
| c-9-container-list-actions | Кнопка по статусу | Заполнить / Разместить / Местоположение | ✅ |
| c-9-fill-offline-2a | Офлайн-пробы | `fillSamples` offline, `PENDING_PLACEMENT` | ✅ |
| c-9-fill-offline-2a-fix | Номер + статус | `updateNumberLocal`, `updateStatusLocal` | ✅ |
| c-9-fill-offline-2b | Иконка несинхронизированных | SQLite v7 `pending_sync`, `cloud_off` | ✅ |
| c-9-fill-offline-2c-1 | Инфраструктура edit | `SyncQueueDao.updatePayload`, `_rebuildFillPayload` | ✅ |
| c-9-fill-offline-2c-2 | `SampleEditDialog` офлайн | read-only номер/справочники | ✅ |
| c-9-fill-offline-2c-3 | Офлайн серверных проб | `update`/`dispose`/`restore`/`delete` через `sync_queue` | ✅ |
| c-9-fill-offline-2c-3-fix-1 | Кэш при pending | `fetchByContainerId` отдаёт кэш | ✅ |
| c-9-fill-offline-2c-3-fix-2 | `_pending_sync` после Push | `onSuccess` в `SyncPusher`, `PushResult` | ✅ |
| c-9-fill-offline-2c-3-fix-3a | Reconcile при Pull | сброс флагов без записи в queue | ✅ |
| c-9-fill-offline-2c-3-fix-3b | Счётчик и SnackBar | `refresh()` после офлайн-операций | ✅ |
| c-9-fill-offline-2c-4 | Edit `sample_number` офлайн | `parseSampleInput` + пересборка | ✅ |
| c-9-auto-sync | Автосинхронизация | Push + Pull при возврате сети, SnackBar | ✅ |
| c-9-natural-sort | Natural sort | `TST6701 < TST6710` | ✅ |
| c-6b-updated-since-pull | `?updated_since=` в Pull | `_lastPullSince`, `PullStats` = изменённые | ✅ |
| c-8-catalog-create | Создание справочников офлайн | UI + `CatalogService.create` | ✅ |
| c-2d-2a | Офлайн-создание тары | SQLite v8 (`local_ref`), negative ID + `sync_queue`, маппинг ID после `bulk-create` | ✅ |
| c-2d-2a-fix-3 | Fix локального формата тары | `Container.fromJson` fallback на `*_id`, серверный формат JSON, история для negative-ID | ✅ |
| c-2d-2b | Офлайн-создание тары (UI) | Покрыто в `c-2d-2a` | ✅ |
| c-2d-2c | Офлайн-`fill-samples` / `bulk-place` на офлайн-тарах | `localRef` в queue, `remapEndpoint`, `processedIds` в `SyncPusher` | ✅ |
| c-2d-2c-fix-1 | Локальное размещение в UI | `updateLocationLocal` (`ACTIVE`, адрес) при offline | ✅ |
| c-2d-2c-fix-2 | Полный путь локации | `NamedCatalog.fullAddress`, `PlaceContainerDialog` → `fullAddress ?? label` | ✅ |
| c-8b | Офлайн-редактирование шапки тары | `ContainerService.update` → `sync_queue` PATCH + `updateFieldsLocal` | ✅ |
| c-8b-fix-1 | UI шапки тары | `useSafeArea`, sticky «Сохранить» вне `ListView` | ✅ |
| c-8b-fix-2 | Офлайн-редактирование (фикс) | `update` ловит все не-4xx → `sync_queue`; payload с `*_name`; лейблы без «черновик» | ✅ |
| c-8b-fix-3 | ТД-66: `ContainerEditForm` при `_catalogsError` | Dropdown'ы disabled, текстовые поля сохраняются | ✅ |
| c-8b-fix-4 | Окно редактирования шапки выше | `(screen − insets) × 0.95`, без Padding+SizedBox | ✅ |
| c-8b-status | Ручная смена статуса тары | Dropdown в `ContainerEditForm` (5 значений), офлайн через `sync_queue` | ✅ |
| c-2f-comment-web | Веб: комментарий тары | `ContainerDetailDialog` (шапка) + `ContainersPage` (колонка) | ✅ |
| c-8-catalog-create-offline | Офлайн-создание справочников | `CatalogService.create` → `sync_queue` + local→server маппинг | ⬜ |
| c-9-overflow-fix-4 | Landscape: клавиатура над окном шапки | `Padding` + `(H - insets) * 0.95` | ✅ |
| c-8d | Mobile: Размещение тары | ✅ (закрыто в `c-7c`) | ✅ |
| c-5 | Файловая синхронизация | Sneakernet через флешку | ⏸ отложено |

**Снятые с плана после аудита (2026-11-10):**
- **`c-8a`** — все PATCH-эндпоинты есть на бэке.
- **`c-8c`** — `SampleService.update/dispose/restore/deleteSample` с `sync_queue` в `c-9-fill-offline-2c-3`.
- **`c-8d`** — `bulkPlace` с `sync_queue` в `c-7c`.
- **`c-8e`** — Auto-sync USB: `NetworkStatusProvider` реагирует на `isOnline: false → true`.

**Сборка на рабочем ПК:** `work-pc-setup/setup.ps1` (обязателен после `git reset --hard`), `export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`, `flutter run --android-skip-build-dependency-validation`, `adb reverse` вручную.

**Стек mobile:** Flutter 3.47 + Dart 3.13 + Dio 5 + Provider 6 + sqflite + mobile_scanner 7.4.2.

---

## Следующие серии (план)

| # | Серия | Что делает | Заходов |
| 0 | `feature/2.x-lifecycle` | Статусы Container/Sample: DISPOSED, is_disposable, parent_*, шифрование | 5 — ✅ закрыта |
| 0 | `feature/2.x-lifecycle-4` | Шифрование и перекладывание проб | 2 — ✅ закрыта |
| 0 | `feature/2.x-pool` | Пул (буфер) для тар/проб: собрать в пул, потом переместить/выбрать | 4–6 |
| 0 | `feature/2.x-shipments` | Отправка (OUTBOUND): модель тар в рейсе, UI, автогенерация номера | 5 — ✅ закрыта |
| 0 | `feature/2.x-smart-input` | Контекстные подсказки (Н/З, ТИ, диапазон) | 3–4 — ✅ закрыта |
|---|---|---|---|
| 1 | `feature/2.x-lab-portal` | Портал лабораторий | 5–7 |
| 2 | `feature/2.x-lifecycle` | Пересмотр статусов Container и Sample | 5–7 |
| 3 | `feature/2.x-sorting` | Помощник сортировки | 3–4 |
| 4 | `feature/3.x-migration` | Миграция старых этикеток (OCR) | 4–5 — 🟡 активна |
| 5 | `feature/3.x-lims` | Прямая интеграция с ЛИМС (Уровень 3) | 5–7 |
| 6 | `feature/3.x-deploy` | Сборка web + backend в installer | 3–5 |
| 7 | `feature/2.x-rbac` | Роли и права | 5–7 |

---

## Требует обсуждения (серия `2.x-lifecycle`)

**1. Статусы тары:** ✅ решение 1.109. `PENDING_FILLING` / `PENDING_PLACEMENT` / `ACTIVE` / `IN_TRANSIT` / `ISSUED`.

**2. Статусы пробы:** ✅ решение 1.110. `IN_STORAGE`, `IN_TRANSIT`, `CONSUMED`, `DISPOSED`, `PENDING_PLACEMENT`, `SELECTED`.

**3. Отправка в лабораторию:** тара едет с пробами или пробы перекладываются?

**4. Возврат:** ✅ решение 1.116. новый объект или обновление старого?

**5. Наряд-заказ:** ✅ решение 1.117. что с Н/З после отправки всех проб?

**6. Шифрование номеров:** ✅ решение 1.118. `legacy_data` / отдельно?

**7. Преемственность:** ✅ решение 1.119. `parent_container_id`?

**8. Кто меняет статусы?** ✅ решение 1.120.

**9. Приёмка ↔ отправка:** ✅ решение 1.121. кто ставит `RECEIVED`?

**10. Происхождение пробы:** ✅ решение 1.111. хранить ли `origin_laboratory_id` (на уровне `Container` или `Sample`)? Для шифрованных — по префиксу, для нешифрованных — сейчас теряется.

**12. Шифрование (1.118):** бэкенд готов (,  action). Ждем решения по UI и бизнес-логике. Источник: серия .

**11. Пул (буфер) для тар/проб:** что это — UI-буфер (localStorage) или persisted (БД)? Что можно класть (тары, пробы, и то и другое)? Как использовать (перемещение, выборка, bulk-операции)? Отдельная страница или drawer? Источник: обсуждение 2026-11-06 в `2.x-lifecycle`.

---

## Запланированные фичи

- [ ] **PostGIS** для координат скважин.
- [ ] **Карта склада** в mobile.
- [ ] **Экспорт отчётов** в Excel/CSV/PDF.
- [x] **Офлайн-режим mobile** — `c-1`..`c-9-auto-sync`.
- [x] **PDF предпросмотр mobile** — `c-7d`, `c-7f-1`, `c-7f-2`.
- [x] **Разместить в mobile** — `c-7c`.
- [x] **Кэш справочников в mobile** — `c-7-offline-catalog`.
- [x] **Кэш истории тары в mobile** — `c-7e-2`, `c-7e-3`.
- [x] **Реестр тары в mobile** — `c-9-container-list` + `c-9-container-list-actions`.
- [x] **Создание тары в mobile (онлайн)** — `c-9-container-create`.
- [x] **Офлайн-редактирование проб** — `c-9-fill-offline-2c-1..2c-4`.
- [x] **Автосинхронизация** — `c-9-auto-sync`.
- [x] **Natural sort проб** — `c-9-natural-sort`.
- [x] **Инкрементальный Pull** — `c-6b-updated-since-pull`.
- [x] **Тап-пинг сети** — `c-6g-tap-ping`.
- [x] **Создание справочников офлайн** — `c-8-catalog-create`.
- [x] **Офлайн-создание тары** — `c-2d-2a` + `c-2d-2a-fix-3`.
- [x] **Офлайн-`fill-samples` / `bulk-place` на офлайн-тарах** — `c-2d-2c` + fixes.
- [x] **Офлайн-редактирование шапки тары** — `c-8b` + `c-8b-fix-1` + `c-8b-fix-2` + `c-8b-fix-3`.
- [x] **Веб: комментарий в карточке и реестре тары** — `c-2f-comment-web`.
- [ ] **Офлайн-создание справочников через `sync_queue`** — `c-8-catalog-create-offline`.
- [x] **OCR старых этикеток** через `google_ml_kit`.
- [ ] **Роли и права** детализированные.
- [ ] **Дашборд с виджетами** под каждую роль.
- [ ] **Помощник по сортировке** — bin packing.

- [ ] **Помощник оптимизации расположения (Топология).** Алгоритм построения плана перемещений с минимальным количеством шагов. Генерация чек-листа с возможностью сканирования для подтверждения. Источник: идея от 2026-11-10.
- [ ] **Логика керна**.
- [ ] **Загрузка файлов**: MEDIA_ROOT.
- [ ] **Сопроводительный документ** при печати партии.
- [x] **Акт приёмки** (PDF).
- [ ] **Печать на A5**.
- [ ] **Тёмная тема** web/mobile.
- [ ] **Экран отправки** в web (Shipment OUTBOUND).
- [ ] **Экран инвентаризации** в web/mobile.
- [x] **Н/З: создание и редактирование** в web.
- [ ] **Десктоп-сборка** (installer с авто-запуском backend).

---

## Технический долг

| # | Задача | Приоритет | Когда |
|---|---|---|---|
| ТД-6 | Формат `legacy_data` (JSONB) | высокий | перед 3.x-migration |
| ТД-11 | Формат ШК ЛИМС | высокий | перед 3.x-lims |
| ТД-13 | `django-cors-headers` | средний | ✅ закрыто (corsheaders) |
| ТД-14 | Throttling / rate limiting | средний | ✅ закрыто (drf throttling) |
| ТД-16 | `MEDIA_ROOT` | средний | ✅ закрыто (urls.py + settings) |
| ТД-21/35 | Web: code-splitting | средний | когда жалобы на скорость |
| ТД-34 | Web: `console.error` в catch | низкий | ✅ закрыто (console.warn / debug) |
| ТД-37 | `TopologyPage` — N+1 в `CellPalletChip` | низкий | если ячеек >30 |
| ТД-38 | UI-защита удаления (CASCADE vs PROTECT) | средний | ✅ закрыто (перехват 409) |
| ТД-42 | `setup.ps1` — обновить при смене Gradle/AGP | средний | при обновлении Flutter |
| ТД-43 | Offline-токен: таймер истечения на мобилке | низкий | UX-полировка |
| ТД-44 | AGP 8.11.1 / Kotlin 2.2.20 — deprecated, апгрейд | низкий | когда Flutter потребует |
| ТД-45 | `c-5` файловая синхронизация (sneakernet) | средний | если понадобится |
| ТД-46 | Денормализация сериализаторов | высокий | ✅ `c-6a` |
| ТД-47 | Инкрементальный Pull (`updated_since`) | высокий | ✅ `c-6b` + `c-6b-updated-since-pull` |
| ТД-48 | Auto-detect сети (health-пинг) | высокий | ✅ `c-6c` |
| ТД-49 | Offline-печать этикеток (Dart PDF) | высокий | ✅ `c-7f-1` + `c-7f-2` |
| ТД-50 | `setup.ps1` — не пишет `\n` в конец файлов и BOM в `source.properties` | средний | при следующей правке `setup.ps1` |
| ТД-51 | `c-6f` (`NetworkMonitor` lifecycle) откачен, `c-6g` — упрощённый | низкий | при первом баг-репорте |
| ТД-52 | `Barcode.scaleCorners` — не учитывает rotation, не используем | низкий | если плагин исправит |
| ТД-53 | Mobile: `SampleEditDialog` — нет права выбора `well`, `depth` | низкий | при необходимости |
| ТД-54 | Mobile: `c-7e` — кэш истории (SQLite `container_history`) | высокий | ✅ `c-7e-2` + `c-7e-3` |
| ТД-55 | В `c-7b-fix` и `c-7h-fix-2` — дозакоммит недостающих файлов | ✅ | 1.90 |
| ТД-56 | Синхронизация констант PDF | средний | ✅ закрыто (api config) |
| ТД-57 | Offline-place: `SyncPusher` отправляет очередь по одной операции; при массовом офлайне — батчинг | низкий | при жалобах на скорость синхронизации |
| ТД-58 | Pull больших справочников (сотни ячеек) — батчинг / пагинация | низкий | при жалобах на скорость Sync |
| ТД-59 | Pull истории = N запросов. Backend batch-эндпоинт `GET /audit-logs/?entity_type=Container&updated_since=…` | средний | когда тар станет сотни/тысячи |
| ТД-60 | Offline-справочники: если сервер не отдал поле-родителя в JSON, `catalogParentId` = null, офлайн-каскад пустой | низкий | при первом баг-репорте офлайн-каскада |
| ТД-61 | UI-проверка overflow после `c-9-overflow-fix-4` (3.5 px, 7.2 px) — не воспроизвелось | низкий | при следующем overflow |
| ТД-62 | `SyncProvider._lastPullSince` в памяти. При перезапуске — полный Pull | низкий | при жалобах на «первый Pull долго» |
| ТД-63 | Mobile: `SampleDao.getByContainerId` сортирует после декодирования JSON (naturalCompare) | низкий | при жалобах на скорость |
| ТД-64 | `ContainerService.bulkCreate` офлайн-ветка не покрыта unit-тестом (нет DI на `ContainerDao.saveAll`) | низкий | при первом баге офлайн-создания |
| ТД-65 | `_defaultOnSuccess` `pending_sync` для `fill-samples` / `bulk-place` на negative-ID | ✅ | закрыто в `c-2d-2c` |
| ТД-66 | `c-8b-fix-3`: `ContainerEditForm._catalogsError` блокирует сохранение шапки | ✅ | закрыто в `c-8b-fix-3` |
| ТД-67 | `ContainersPage.tsx` — `as any` | низкий | ✅ закрыто (поле comment добавлено) |
| ТД-68 | `api_client.dart` классифицирует `unknown` | низкий | ✅ закрыто (isNetworkError = true) |
| ТД-69 | `mark_received` docstring | низкий | ✅ закрыто (удален при рефакторинге) |
| ТД-72 | `mark_received` и `is_superuser` | низкий | ✅ закрыто (см. DECISIONS 1.122) |
| ТД-73 | Django Admin для users | средний | ✅ закрыто (admin.py создан) |


| ТД-75 | Сквозная валидация (Data Integrity Checker): ловить ситуации, когда Container.status = PENDING_PLACEMENT, но у него есть ячейка (это баг логики). | средний | при следующей ревизии домена |
| ТД-74 | Механизм сквозной валидации статусов (Data Integrity Checker). Проверка соответствия статусов проб статусам тары при сохранении или фоновой задачей. | средний | при следующей ревизии домена |
| ТД-78 | `apps/ocr/services/`: 4 «спящих» файла (`auto_detector.py`, `mark_detector.py`, `ocr_engine.py`, `sample_parser.py`) + `services/models.py` — старый OCR-пайплайн, не используется `views.py`. Решить: удалить или интегрировать. | средний | при следующей ревизии OCR |
| ТД-79 | `ocr_runner.py`: путь `python_exe = r"D:\\Dev\\python312\\python.exe"` захардкожен. На домашнем ПК / Linux не заведётся. Вынести в `settings.OCR_PYTHON_EXE` + `.env`. | высокий | перед выездом за пределы рабочего ПК |
| ТД-81 | Web: `npm run build` (`tsc --noEmit`) падает на MUI 9 breaking changes в pre-existing файлах: `PoolPage.tsx`, `ShipmentsPage.tsx`, `TopologyPage.tsx`, `ContainersPage.tsx`, `SamplesTreeTable.tsx`. Типы `<Grid item>`/`<Grid container>`, `Stack justifyContent`/`alignItems` в prop-позиции, unused `CircularProgress`/`PlaylistAddCheckIcon`. Dev (`npm run dev` через vite esbuild) работает. | высокий | при следующей ревизии web |
| ТД-80 | Расхождение формата `sample_number` в трёх местах: `DATABASE.md` — `TAA-A34076001-001` (с дефисом); реальный код `fill_container_with_samples` — `prefix + middle + sequence` без дефисов → `TAA-A34076001001`; web-форма `OcrReviewPage` строит `sequence_digits` из длины `sequence_to` (`1-3` → digits=1 → `TAA-A340760011`, `001-003` → digits=3 → `TAA-A34076001001`). Синхронизировать: править `DATABASE.md`, добавить дефис в код или явно описать поведение в UI. | средний | при следующей ревизии `samples` |


---

## Отложено (🔮)

- Интеграция с LIMS лабораторий (Уровень 3).
- IGSN как внешний идентификатор.
- Цифровой двойник склада (3D).
- Роботизированное перемещение (AGV).

---

## Архив серий

| Серия | Дата закрытия | Ветка |
|---|---|---|
| `feature/0.1-foundation` | 2026-10-07 | docs → `main` |
| `feature/0.2-prep-code` | 2026-10-07 | docs → `main` |
| `feature/1.0-backend-init` | 2026-10-07 | влита в `main` |
| `feature/1.0a-topology-v2` | 2026-10-07 | влита в `main` |
| `feature/1.1-backend-api` | 2026-10-07 | влита в `main` |
| `feature/1.2-mobile-init` | 2026-10-08 | влита в `2.x-mobile` |
| `feature/1.3-backend-v2` | 2026-10-09 | влита в `main` |
| `feature/2.0-excel-parser` | 2026-10-09 | влита в `main` |
| `feature/2.1-label-generator` | 2026-10-10 | влита в `main` |
| `feature/2.x-web` | 2026-10-10 | влита в `main` |
| `feature/2.x-mobile` | 2026-10-12 | влита в `main` |
| `feature/2.x-web-v2` | 2026-10-27 | влита в `main` |
| `feature/2.x-lab-portal` | 2026-11-10 | влита в `main` |
| **`feature/3.x-offline`** | **—** | **активная** (бранч `fix/2.x-mobile-bundle-c-2`) |- **ТД-75.** Сквозная валидация (Data Integrity Checker): ловить ситуации, когда Container.status = PENDING_PLACEMENT, но у него есть ячейка (это баг логики).
- **ТД-76.** Автоматическая оптимизация расположения в Топологии (план перемещений с минимальным количеством шагов + чек-лист со сканированием).
- **ТД-77.** Глобальное сохранение состояния (State Persistence). При навигации между страницами фильтры, выделенные строки и позиция скролла должны сохраняться (через Zustand или URL параметры). Касается всего приложения.
