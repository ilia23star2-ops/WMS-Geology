# PLAN.md — что делаем и что дальше

> Роадмап, ветки, техдолг, бэклог.
> Сюда идут все идеи «на будущее» — см. `RULES.md` §11.

**Дата обновления:** 2026-11-03

---

## Стратегия

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.**
2. **Mobile — по требованию.**
3. **Роли и права — после.**
4. **`Receipt`** — только для Excel и акта приёмки.

---

## Ближайший план

**Активная серия:** `feature/3.x-offline` (мобильный офлайн).
**Долгоживущий бранч:** `fix/2.x-mobile-bundle-c-2`.
Серия `2f` — **закрыта полностью**.

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
| c-2d-2a | Офлайн-создание тары | SQLite v8 (`local_ref`), negative ID + `sync_queue`, маппинг ID после `bulk-create` (`remapAllLocalRefs`, `ContainerDao.remapId`, `SampleDao.remapContainerId`) | ✅ |
| c-2d-2a-fix-3 | Fix локального формата тары | `Container.fromJson` fallback на `*_id`, серверный формат JSON (`container_type` / `draft_site` / `draft_research_type`), история для negative-ID не зовёт сервер | ✅ |
| c-2d-2b | Офлайн-создание тары (UI) | Покрыто в `c-2d-2a` (SnackBar «офлайн», `pending_sync`, реестр) | ✅ |
| c-2d-2c | Офлайн-`fill-samples` / `bulk-place` на офлайн-тарах | `local_ref` в queue, маппинг в payload | ⬜ |
| c-8a | Backend: PATCH статусов | Эндпоинты для `sync_queue` | ⬜ |
| c-8b | Mobile: Смена статуса тары | через `sync_queue` | ⬜ |
| c-8c | Mobile: Смена статуса пробы | `IN_STORAGE` → `SELECTED` → `DISPOSED` | ⬜ |
| c-8d | Mobile: Размещение тары | ✅ (закрыто в `c-7c`) | ✅ |
| c-8e | Mobile: Auto-sync USB | Push → Pull, автотриггер | ⬜ |
| c-5 | Файловая синхронизация | Sneakernet через флешку | ⏸ отложено |

**Сборка на рабочем ПК:** `work-pc-setup/setup.ps1` (обязателен после `git reset --hard`), `export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`, `flutter run --android-skip-build-dependency-validation`, `adb reverse` вручную.

**Стек mobile:** Flutter 3.47 + Dart 3.13 + Dio 5 + Provider 6 + sqflite + mobile_scanner 7.4.2.

---

## Следующие серии (план)

| # | Серия | Что делает | Заходов |
|---|---|---|---|
| 1 | `feature/2.x-lab-portal` | Портал лабораторий | 5–7 |
| 2 | `feature/2.x-lifecycle` | Пересмотр статусов Container и Sample | 5–7 |
| 3 | `feature/2.x-sorting` | Помощник сортировки | 3–4 |
| 4 | `feature/3.x-migration` | Миграция старых этикеток (OCR) | 4–5 |
| 5 | `feature/3.x-lims` | Прямая интеграция с ЛИМС (Уровень 3) | 5–7 |
| 6 | `feature/3.x-deploy` | Сборка web + backend в installer | 3–5 |
| 7 | `feature/2.x-rbac` | Роли и права | 5–7 |

---

## Требует обсуждения (серия `2.x-lifecycle`)

**1. Статусы тары:** `PENDING_FILLING` / `PENDING_PLACEMENT` / `ACTIVE` / `IN_TRANSIT` / `ISSUED`.

**2. Статусы пробы:** `IN_STORAGE`, `IN_TRANSIT`, `CONSUMED`, `DISPOSED`, `PENDING_PLACEMENT`, `SELECTED`.

**3. Отправка в лабораторию:** тара едет с пробами или пробы перекладываются?

**4. Возврат:** новый объект или обновление старого?

**5. Наряд-заказ:** что с Н/З после отправки всех проб?

**6. Шифрование номеров:** `legacy_data` / отдельно?

**7. Преемственность:** `parent_container_id`?

**8. Кто меняет статусы?**

**9. Приёмка ↔ отправка:** кто ставит `RECEIVED`?

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
- [ ] **Офлайн-`fill-samples` / `bulk-place` на офлайн-тарах** — `c-2d-2c` (`local_ref` в queue, маппинг в payload).
- [ ] **OCR старых этикеток** через `google_ml_kit`.
- [ ] **Роли и права** детализированные.
- [ ] **Дашборд с виджетами** под каждую роль.
- [ ] **Помощник по сортировке** — bin packing.
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
| ТД-13 | `django-cors-headers` | средний | перед прод |
| ТД-14 | Throttling / rate limiting | средний | перед прод |
| ТД-16 | `MEDIA_ROOT` | средний | серия 2.x |
| ТД-21/35 | Web: code-splitting | средний | когда жалобы на скорость |
| ТД-34 | Web: `console.error` в catch | низкий | при доработке UI |
| ТД-37 | `TopologyPage` — N+1 в `CellPalletChip` | низкий | если ячеек >30 |
| ТД-38 | UI-защита удаления (CASCADE vs PROTECT) | средний | до продакшена |
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
| ТД-55 | В `c-7b-fix` и `c-7h-fix-2` — дозакоммит недостающих файлов. В `CONTEXT` §«Mobile» — правило: перед `git add` — `git status --short \| grep "mobile/lib"` | ✅ | 1.90 |
| ТД-56 | Синхронизация констант `label_service.py` ↔ `label_pdf_generator.dart` (порт 1:1). При изменении серверного рендера — править оба | средний | при первом изменении серверного рендера |
| ТД-57 | Offline-place: `SyncPusher` отправляет очередь по одной операции; при массовом офлайне — батчинг | низкий | при жалобах на скорость синхронизации |
| ТД-58 | Pull больших справочников (сотни ячеек) — батчинг / пагинация | низкий | при жалобах на скорость Sync |
| ТД-59 | Pull истории = N запросов. Backend batch-эндпоинт `GET /audit-logs/?entity_type=Container&updated_since=…` | средний | когда тар станет сотни/тысячи |
| ТД-60 | Offline-справочники: если сервер не отдал поле-родителя в JSON, `catalogParentId` = null, офлайн-каскад пустой | низкий | при первом баг-репорте офлайн-каскада |
| ТД-61 | UI-проверка overflow после `c-9-overflow-fix-4` (3.5 px, 7.2 px) — не воспроизвелось; следить при новых экранах | низкий | при следующем overflow |
| ТД-62 | `SyncProvider._lastPullSince` в памяти. При перезапуске приложения — полный Pull. Персистить (`shared_preferences`) | низкий | при жалобах на «первый Pull долго» |
| ТД-63 | Mobile: `SampleDao.getByContainerId` сортирует после декодирования JSON (naturalCompare). Для больших тар — natural sort в SQL | низкий | при жалобах на скорость |
| ТД-64 | `ContainerService.bulkCreate` офлайн-ветка не покрыта unit-тестом: `ContainerDao.saveAll` уходит в `AppDatabase.instance` (нет DI). Нужен `saveContainers` в конструктор | низкий | при первом баге офлайн-создания |
| ТД-65 | `_defaultOnSuccess` не снимает `pending_sync` для `fill-samples` / `bulk-place` на negative-ID до `c-2d-2c` (там будет `local_ref`) | низкий | закрывается в `c-2d-2c` |

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
| **`feature/3.x-offline`** | **—** | **активная** (бранч `fix/2.x-mobile-bundle-c-2`) |