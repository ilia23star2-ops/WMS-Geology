# ISSUES.md — открытые проблемы

> Только открытые. Закрытые — в `PROGRESS.md`.
> Технический долг — в `PLAN.md`.

---

## Открытые

### И-1. `RULES.md` и `TEMPLATES.md` не покрывают проектную фазу

**Статус:** 🟡 ждёт дополнения в `TEMPLATES.md`

**Симптом:** В правилах описаны только кодовые заходы. Проектная
фаза (артефакт = документ) не формализована.

**Причина:** Шаблон `ai-development-template v1.0` ориентирован
на код.

**Что делать:** Добавить в `TEMPLATES.md` шаблон `API.md`.
Ввести в `PROJECT.md` раздел «Проектные заходы» (сделано).

**Файлы:** `docs/TEMPLATES.md`, `docs/PROJECT.md`.

---

### И-2. Не определён формат `legacy_data` для старых этикеток

**Статус:** 🔴 открыт

**Симптом:** Поле `Samples.legacy_data` (JSONB) описано, но
структура не зафиксирована.

**Причина:** Формат старых этикеток у разных лабораторий разный.

**Что делать:** Собрать образцы старых этикеток, определить
минимальный набор полей для JSONB, зафиксировать в `DATABASE.md`.

**Файлы:** `docs/DATABASE.md`.

---

### И-3. `.vscode/settings.json` — противоречие `.gitignore` и `PROJECT.md`

**Статус:** 🟡 открыт (ТД-19)

**Симптом:** В `.gitignore` есть исключение
`!.vscode/settings.json`, то есть файл **не игнорируется**. Но
`PROJECT.md` §Проектные правила (9) требует: «`.vscode/settings.json`
при появлении в `git status` — откатывать».

**Причина:** `.gitignore` и правило проекта расходятся.

**Что делать:** Выбрать одно:
- А) Убрать исключение из `.gitignore` — файл игнорируется.
- Б) Отменить правило в `PROJECT.md` — файл версионируется.

Пока — рекомендация А.

**Файлы:** `.gitignore`, `docs/PROJECT.md`.

---

## Решённые (архив)

### И-0. Git не работал через HTTPS (schannel)

**Статус:** 🟢 решено переходом на SSH через порт 443.И-4. `apps/samples/views.py` encrypt action — 4 бага (починено в 6f-1-pre)
Статус: 🟢 решено (2026-11-17)
Симптом: Кнопка «Зашифровать» отдавала 500 всем пользователям.
Причина: `log_audit` импортировался из `models` вместо `services`; отсутствовал импорт `transaction`; устаревшая константа `ORDER_TYPE_CODED`.
Решение: Исправлены импорты, добавлен `transaction`, обновлена константа на `TYPE_CODED`.
Файлы:`apps/samples/views.py`.

И-5. RBAC для encrypt — worker мог шифровать пробы
Статус: 🟢 решено (2026-11-17)
Симптом: Worker получал 200 OK при POST на `/samples/{id}/encrypt/`, хотя должен был получить 403.
Причина: `SampleViewSet.get_permissions()` перебивал `permission_classes=[IsManagerOrAdmin]` из `@action` и возвращал `IsWorkerOrHigher` для всех не-GET действий.
Решение: Добавлен `elif self.action == "encrypt"` в `get_permissions`.
Файлы:`apps/samples/views.py`.

И-6. Stale-тесты в `storage` и `samples`
Статус: 🟢 решено (2026-11-17)
Симптом: `test_sorting.py` ждал старую формулировку `reason`; `test_encryption.py` использовал несуществующую константу `WorkOrder.ORDER_TYPE_CODED`.
Причина: Тесты не обновлялись после изменений логики в сериях `2.x-sorting` и `2.x-lifecycle`.
Решение: Обновлены ассерты и константы в тестах.
Файлы:`apps/storage/tests/test_sorting.py`, `apps/samples/tests/test_encryption.py`.
