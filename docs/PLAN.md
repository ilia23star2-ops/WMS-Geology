# PLAN.md — что делаем и что дальше

> Роадмап, ветки, техдолг, бэклог.
> Сюда идут все идеи «на будущее» — см. `RULES.md` §11.

**Дата обновления:** 2026-11-02

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
| c-2 | SyncService (Pull) | Постраничная синхронизация (50/стр) | ✅ |
| c-3 | SyncQueue (Push) | Очередь изменений, отправка | ✅ |
| c-4 | UI офлайн-режима | `SyncProvider`, `SyncScreen` | ✅ |
| c-4.5 | Deferred Offline Login | QR с base64-JSON | ✅ |
| c-4.6 | USB-режим | `adb reverse`, SQLite v4, fallback DAO | ✅ |
| c-6a-pre | Pre-existing fix | `log_audit(old_value)`, `UserProfile.__str__`, stale-тесты | ✅ |
| c-6a | Health + денормализация | `GET /health/`, `*_name` поля | ✅ |
| c-6b | Инкр. Pull | `?updated_since=` | ✅ |
| c-6c | Mobile: Auto-detect | `NetworkProbe`, `AppConfig.resolve` | ✅ |
| c-6d-fix | Mobile: ScanWindow | 220×220 (native не работает, corners) | ✅ |
| c-6d-fix-3 | Mobile: Landscape-fix | swap effectiveSize | ✅ |
| c-6g | Mobile: NetworkStatusProvider | heartbeat `/health/` 10 с + иконка | ✅ |
| c-6h | Mobile: блок синхронизации | disabled при `!isOnline` / `pendingOffline` | ✅ |
| c-6g-login | Mobile: иконка на Login | `NetworkBadge` в AppBar | ✅ |
| c-7a | Карточка тары | 3 вкладки + адаптив (портрет / ландшафт) | ✅ |
| c-7b | Форма шапки | `ContainerEditForm` + `CatalogService` в bottom sheet | ✅ |
| c-7f | FillContainerContent | диапазоны, skip/selected, удаление | ✅ |
| c-7g | Вкладка «Пробы» | поиск, чекбоксы, bulk, чипы, `SampleEditDialog` | ✅ |
| c-7h | История сканов | `Н/З · ТИ · номер` (`ScanHistoryEntry`) | ✅ |
| c-7d | PDF предпросмотр | `label.pdf` через `url_launcher` | ⬜ **следующий** |
| c-7c | Разместить | `PlaceContainerDialog` (каскад), `bulk-place` | ⬜ |
| c-7e | Кэш истории | SQLite `container_history` (v5), fallback в `fetchHistory` | ⬜ |
| c-8a | Backend: PATCH статусов | Эндпоинты для `sync_queue` | ⬜ |
| c-8b | Mobile: Смена статуса тары | `PENDING_FILLING` → `PENDING_PLACEMENT` → `ACTIVE` | ⬜ |
| c-8c | Mobile: Смена статуса пробы | `IN_STORAGE` → `SELECTED` → `DISPOSED` | ⬜ |
| c-8d | Mobile: Размещение тары | В ячейку / на пол через `sync_queue` | ⬜ |
| c-8e | Mobile: Auto-sync USB | Push → Pull, автотриггер | ⬜ |
| c-5 | Файловая синхронизация | Sneakernet через флешку (`.json.gz`) | ⏸ отложено |

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
- [x] **Офлайн-режим mobile** — `c-1`..`c-4.6`, `c-6a`..`c-6h`, `c-7a`..`c-7h`.
- [ ] **PDF предпросмотр mobile** — `c-7d`.
- [ ] **Разместить в mobile** — `c-7c`.
- [ ] **Кэш истории** — `c-7e`.
- [ ] **OCR старых этикеток** через `google_ml_kit`.
- [ ] **Роли и права** детализированные.
- [ ] **Дашборд с виджетами** под каждую роль.
- [ ] **Помощник по сортировке** — bin packing.
- [ ] **Логика керна**.
- [ ] **Загрузка файлов**: MEDIA_ROOT, валидация размера.
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
| ТД-42 | `work-pc-setup/setup.ps1` — обновить при смене Gradle/AGP | средний | при обновлении Flutter |
| ТД-43 | Offline-токен: таймер истечения на мобилке | низкий | UX-полировка |
| ТД-44 | AGP 8.11.1 / Kotlin 2.2.20 — deprecated, апгрейд | низкий | когда Flutter потребует |
| ТД-45 | `c-5` файловая синхронизация (sneakernet) | средний | если понадобится |
| ТД-46 | Денормализация сериализаторов | высокий | ✅ `c-6a` |
| ТД-47 | Инкрементальный Pull (`updated_since`) | высокий | ✅ `c-6b` |
| ТД-48 | Auto-detect сети (health-пинг) | высокий | ✅ `c-6c` |
| ТД-49 | Offline-печать этикеток (Dart PDF) | высокий | `c-7f` (отложено) |
| ТД-50 | `setup.ps1` — не пишет `\n` в конец файлов и BOM в `source.properties` | средний | при следующей правке `setup.ps1` |
| ТД-51 | `c-6f` (`NetworkMonitor` lifecycle) откачен, `c-6g` — упрощённый | низкий | при первом баг-репорте |
| ТД-52 | `Barcode.scaleCorners` — не учитывает rotation, не используем | низкий | если плагин исправит |
| ТД-53 | Mobile: `SampleEditDialog` — нет права выбора `well`, `depth` | низкий | при необходимости |
| ТД-54 | Mobile: `c-7e` — кэш истории (SQLite `container_history`) | высокий | следующий после `c-7c` |
| ТД-55 | В `c-7b-fix` и `c-7h-fix-2` — дозакоммит недостающих файлов. В `CONTEXT` §«Mobile» — правило: перед `git add` — `git status --short \| grep "mobile/lib"` | ✅ | 1.90 |

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