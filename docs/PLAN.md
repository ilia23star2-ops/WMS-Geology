# PLAN.md — что делаем и что дальше

> Роадмап, ветки, техдолг, бэклог.
> Сюда идут все идеи «на будущее» — см. `RULES.md` §11.

**Дата обновления:** 2026-11-02

---

## Стратегия

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.** Всё, что можно проверить в браузере.
2. **Mobile — по требованию.** Сканирование QR, камера, физические манипуляции.
3. **Роли и права — после.** Серия `2.x-rbac` — отложено.
4. **`Receipt`** — только для Excel и акта приёмки.

---

## Ближайший план

**Активная серия:** `feature/3.x-offline` (мобильный офлайн).
**Долгоживущий бранч:** `fix/2.x-mobile-bundle-c-2`.
Серия `2f` — **закрыта полностью** (история в `PROGRESS.md`).

**План серии 3.x-offline:**

| # | Заход | Что делает | Статус |
|---|---|---|---|
| c-1 | SQLite | Таблицы `containers`, `samples`, DAO | ✅ |
| c-2 | SyncService (Pull) | Постраничная синхронизация (50/стр) | ✅ |
| c-3 | SyncQueue (Push) | Очередь изменений, отправка | ✅ |
| c-4 | UI офлайн-режима | `SyncProvider`, `SyncScreen`, кнопка | ✅ |
| c-4.5 | Deferred Offline Login | QR с base64-JSON, pending-токены | ✅ |
| c-4.6 | USB-режим | `adb reverse`, `--dart-define`, SQLite v4, fallback DAO | ✅ |
| c-6a-pre | Pre-existing fix | `log_audit(old_value)`, `UserProfile.__str__`, stale-тесты | ✅ |
| c-6a | Backend: Health + денормализация | `GET /health/` + имена вместо ID | ✅ |
| c-6b | Backend: Инкр. Pull | `?updated_since=` для containers/samples | ✅ |
| c-6c | Mobile: Auto-detect | `NetworkProbe` + `AppConfig.resolve` | ✅ |
| c-6d-fix | Mobile: ScanWindow | Мёртвая зона 220×220, `corners` + `BoxFit.cover` | ✅ |
| c-6d-fix-3 | Mobile: Landscape-fix | swap effectiveSize при rotated corners | ✅ |
| c-6e | Mobile: Баннер pending | «N изменений ожидают синхронизации» + бейдж сети | ⬜ **следующий** |
| c-7a | Карточка тары | 3 вкладки (Пробы / Редактирование / История) + кнопки | ⬜ |
| c-7b | Список проб | Поиск, фильтр, тап → карточка | ⬜ |
| c-7c | Список тары | Поиск, фильтр, тап → карточка | ⬜ |
| c-7d | Просмотр ячейки | По QR-коду → содержимое (тары, поддоны) | ⬜ |
| c-7e | WorkOrders | Полный CRUD: список, создание, связывание, сводка | ⬜ |
| c-7f | Offline-печать | Создание партии + PDF через Dart `pdf` + просмотр | ⬜ |
| c-8a | Backend: PATCH статусов | Эндпоинты для `sync_queue` (тара, проба) | ⬜ |
| c-8b | Mobile: Смена статуса тары | `PENDING_FILLING` → `PENDING_PLACEMENT` → `ACTIVE` | ⬜ |
| c-8c | Mobile: Смена статуса пробы | `IN_STORAGE` → `SELECTED` → `DISPOSED` | ⬜ |
| c-8d | Mobile: Размещение тары | В ячейку / на пол через `sync_queue` | ⬜ |
| c-8e | Mobile: Auto-sync USB | Push → Pull, автотриггер при подключении | ⬜ |
| c-5 | Файловая синхронизация | Sneakernet через флешку (`.json.gz` + `token_hash`) | ⏸ отложено |

**Сборка на рабочем ПК:** `work-pc-setup/setup.ps1` (обязателен после `git reset --hard`), затем `export FLUTTER_STORAGE_BASE_URL=https://storage.flutter-io.cn`, затем `flutter run --android-skip-build-dependency-validation` (см. DECISIONS 1.73).

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

**1. Статусы тары:** `PENDING_FILLING` / `PENDING_PLACEMENT` / `ACTIVE` / `IN_TRANSIT` / `ISSUED` — семантика `IN_TRANSIT` и `ISSUED` размыта.

**2. Статусы пробы:** `IN_STORAGE`, `IN_TRANSIT`, `CONSUMED`, `DISPOSED`, `PENDING_PLACEMENT` — семантика размыта.

**3. Отправка в лабораторию:** тара едет с пробами или пробы перекладываются?

**4. Возврат:** новый объект или обновление старого? Кто решает?

**5. Наряд-заказ:** что с Н/З после отправки всех проб?

**6. Шифрование номеров:** где хранить соответствие (`legacy_data` / отдельно)?

**7. Преемственность:** нужна ли связь «новый Container = перерождение старого»?

**8. Кто меняет статусы:** кладовщик / система / менеджер?

**9. Приёмка ↔ отправка:** кто ставит `RECEIVED`? `PARTIALLY_RECEIVED` — реальный сценарий?

---

## Запланированные фичи

- [ ] **PostGIS** для координат скважин.
- [ ] **Карта склада** в мобильном приложении.
- [ ] **Экспорт отчётов** в Excel/CSV/PDF.
- [x] **Офлайн-режим** мобильного приложения (SQLite) — `c-1`..`c-4.6`.
- [x] **Healthcheck + денормализация** — `c-6a`.
- [x] **Инкрементальный Pull** — `c-6b`.
- [x] **Auto-detect сети** — `c-6c`.
- [x] **ScanWindow 220×220 (portrait + landscape)** — `c-6d-fix` + `c-6d-fix-3`.
- [ ] **OCR старых этикеток** через `google_ml_kit`.
- [ ] **Роли и права** детализированные.
- [ ] **Дашборд с виджетами** под каждую роль.
- [ ] **Помощник по сортировке** — полный уровень (bin packing).
- [ ] **Логика керна** (керновый поддон — только в керновую ячейку).
- [ ] **Загрузка файлов**: MEDIA_ROOT, валидация размера.
- [ ] **Сопроводительный документ** при печати партии.
- [x] **Акт приёмки** (PDF с расхождениями).
- [ ] **Печать на A5**.
- [ ] **Тёмная тема** web/mobile.
- [ ] **Экран отправки** в web (Shipment OUTBOUND).
- [ ] **Экран инвентаризации** в web и mobile.
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
| ТД-38 | `2f-4a` UI-защита удаления (CASCADE vs PROTECT) | средний | до продакшена |
| ТД-42 | `work-pc-setup/setup.ps1` — обновить при смене Gradle/AGP | средний | при обновлении Flutter |
| ТД-43 | Offline-токен: таймер истечения на мобилке | низкий | UX-полировка |
| ТД-44 | AGP 8.11.1 / Kotlin 2.2.20 — deprecated, апгрейд при возможности | низкий | когда Flutter потребует |
| ТД-45 | `c-5` файловая синхронизация (sneakernet) | средний | если понадобится работа без USB/сети |
| ТД-46 | Денормализация сериализаторов | высокий | ✅ `c-6a` |
| ТД-47 | Инкрементальный Pull (`updated_since`) | высокий | ✅ `c-6b` |
| ТД-48 | Auto-detect сети (health-пинг) | высокий | ✅ `c-6c` |
| ТД-49 | Offline-печать этикеток (Dart PDF) | высокий | `c-7f` |
| ТД-50 | `setup.ps1` — не пишет `\n` в конец файлов и BOM в `source.properties` | средний | при следующей правке `setup.ps1` |
| ТД-51 | `c-6d-fix-3` landscape-swap — оставить как есть, пока не будет бага | низкий | при первом баг-репорте |
| ТД-52 | `Barcode.scaleCorners` — не учитывает rotation, не используем | низкий | если плагин исправит |

---

## Отложено (🔮)

- Интеграция с LIMS лабораторий напрямую (Уровень 3).
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