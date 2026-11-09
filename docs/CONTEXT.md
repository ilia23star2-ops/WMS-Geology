# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-09

---

## Где мы

**Активная серия:** `feature/2.x-lab-portal` — портал лабораторий.
**Ветка:** `feature/2.x-lab-portal`.

**Текущий заход:** пачки 1 и 2 (backend + web фильтр) — ✅ закрыты.
Следующий: пачка 3 (web: `Sidebar` по роли, `create-return` action, «Вернуть остатки»).

**Backend: 892 теста.**
**Web: 24 юнит-теста.**
**Mobile: 227 юнит-тестов.**

**Серия `3.x-offline`** (долгоживущий бранч `fix/2.x-mobile-bundle-c-2`) — на паузе. Остался `c-8-catalog-create-offline` (отложен).
**Серия `2.x-lifecycle`** — закрыто 3/5 пачек. Пачка 4 (перекладывание, шифрование) отложена — реализуется в рамках портала.
**Серия `2.x-shipments`** — закрыта полностью (OUTBOUND рейсы).
**Серия `2.x-smart-input`** — закрыта.
**Серия `2.x-web-v2`** — закрыта.

### Что готово (backend) для портала
- `UserProfile.laboratory` (FK → `samples.Laboratory`, `SET_NULL`).
- Роль `lab_worker`.
- `POST /shipments/{id}/mark-received/` (DRAFT/ASSEMBLED/SENT → RECEIVED).
- `can_mark_received` в `ShipmentSerializer`.
- `current_holder` в `ContainerSerializer`, `SampleSerializer`, `ShipmentContainerItemSerializer`.

### Что готово (web) для портала
- Вкладки «Все / Исходящие / Входящие» в `ShipmentsPage`.
- Фильтр «Только доступные для приёма» (на фронтенде по `can_mark_received`).
- Кнопка «Принять» (и в списке, и в деталях рейса).
- Колонка «Где сейчас» (`current_holder`) в деталях рейса.

### Что дальше (пачка 3 — web)
- `Sidebar` по роли: скрыть «Приёмку», «Топологию», «Справочники» для `lab_worker`.
- Кнопка «Вернуть остатки» (action `create-return`) в деталях рейса (OUTBOUND, если рейс в статусе RECEIVED/PARTIALLY_RECEIVED).
- Список возвращённых тар/проб.

### Известные грабли
- **`c-8b-status`** — смена статуса тары (mobile, офлайн) — ✅.
- **Web:** `ContainersPage.tsx` — `(row as any).comment` — ТД-67.
- **Admin:** `users/admin.py` не зарегистрирован (ТД-73) — `UserProfile`/`Role` не видны в Django Admin. Не влияет на API.
- **`mark_received` docstring:** побит (ТД-69).
- **`mark_received` проверяет роль:** `admin`/`manager`, `is_superuser` не проверяется (ТД-72, решено оставить).

---

## Стратегия разработки

> **Web — основной клиент. Mobile — по требованию.**

1. **Web-фичи — первый приоритет.**
2. **Mobile — по требованию.**
3. **Роли и права — после.**
4. **`Receipt`** — только для Excel и акта приёмки.

---

## Что готово

*(Списки готового кода backend/web/mobile — без изменений с прошлой итерации, кроме добавленного в "Где мы".)*

---

## Известные грабли

*(Инфраструктура, Django, API, домен, Web, Mobile, Рабочий ПК — без изменений.)*

---

## Не трогать

- `RULES.md`, `TEMPLATES.md`.
- Утверждённые решения в `DECISIONS.md`.
- Файл `.env` (только `.env.example`).
- Ветка `fix/2.x-mobile-bundle-c-2` (WIP).
- `work-pc-setup/`, `wms-bundle/`, `D:\Dev\maven-local`, `D:\Dev\android-sdk\ndk\28.2.13676358`.

---

## Порядок чтения для нового ИИ

1. `RULES.md`
2. `PROJECT.md`
3. `CONTEXT.md` (этот файл)
4. `PLAN.md`