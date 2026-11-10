# CONTEXT.md — где мы сейчас

Одна страница. Обновляется в конце каждой сессии.
ИИ читает третьим (после `RULES.md` и `PROJECT.md`).

**Дата обновления:** 2026-11-10

---

## Где мы

**Активная серия:** не выбрана. Следующая — `feature/2.x-rbac` (Роли и права).
**Ветка:** `main`.

**Текущий заход:** серия `feature/2.x-lab-portal` — ✅ закрыта и влита в `main`.
- Пачка 1: backend (`UserProfile.laboratory`, `lab_worker`, `mark-received`, `current_holder`).
- Пачка 2: web (`my_lab` filter, tabs, mark-received button, current_holder).
- Пачка 3: web (role-based sidebar, `create-return` action, «Вернуть остатки»).

**Backend: 892 теста.**
**Web: 24 юнит-теста.**
**Mobile: 227 юнит-тестов.**

**Серия `3.x-offline`** (долгоживущий бранч `fix/2.x-mobile-bundle-c-2`) — на паузе.
**Серия `2.x-lifecycle`** — закрыто 3/5 пачек.
**Серия `2.x-shipments`** — закрыта.
**Серия `2.x-smart-input`** — закрыта.
**Серия `2.x-web-v2`** — закрыта.

### Известные грабли
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

*(Списки готового кода backend/web/mobile — без изменений, кроме добавленного в "Где мы".)*

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