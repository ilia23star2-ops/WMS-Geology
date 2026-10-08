# DECISIONS.md — решения и глоссарий

> Здесь фиксируются принятые решения и термины проекта.
> Решение без причины — плохое решение. Причина обязательна.

---

## 1. Решения

### 1.1–1.34 (сводка)

Полные формулировки — в истории git. Кратко:

- **1.1–1.13** — базовые: название, стек, WorkOrders self-ref,
  Sample как единица, M:N проба↔Н/З, QR, Уровень 1 интеграции,
  фазы проекта, система разработки, SSH.
- **1.14–1.19** — инфраструктура: портативный PostgreSQL,
  `poetry run`, стандартный User, seeds ролей, Pallet «в пути»,
  PROTECT для Container.
- **1.20–1.30** — топология v2: 4 яруса A–D, «тихий» Pallet,
  QR на секции/ячейке/таре, PickList, soft-delete утилизации,
  MoveOperation, вместимость, штрих-код ЛИМС, InventoryIssue,
  керн, помощник сортировки.
- **1.31–1.34** — PostgreSQL: пересоздание миграций,
  CHECK `move_item`, Docker Compose, JWT + OpenAPI.

**Статус:** ✅ действуют.

---

### 1.35. 2026-10-08 — Справочники вместо строк

**Решение:** ввести справочники:
- `ResearchType` — тип исследования (`ШЛ`, `ХА`, `ИЗ`).
- `Site` — участок.
- `Laboratory` — лаборатория.
- `ContainerComment` — шаблоны комментариев к таре.

`Sample.research_type` (CharField) → **FK на `ResearchType`**.
`Sample.site` (CharField) → **FK на `Site`**.
Поле `Container` не меняется, добавляется комментарий.

**Причина:**
- Строки нельзя переименовать, они накапливают опечатки.
- Нельзя построить отчёт по типам — всё разное.
- Нет валидации на вводе.

**Статус:** ✅ действует.

---

### 1.36. 2026-10-08 — Редактор справочников: Django Admin → UI

**Решение:**
- **MVP (сейчас):** редактирование справочников через Django Admin.
- **Серия 1.3 (web):** отдельный UI для менеджера.

**Причина:**
- Django Admin работает «из коробки», не требует разработки UI.
- Быстрее запуститься.
- Красивый UI — задача для веб-приложения.

**Статус:** ✅ действует.

---

### 1.37. 2026-10-08 — Паттерны распознавания в справочниках

**Решение:** в справочниках хранить **списки паттернов** для распознавания:

```python
class Site(models.Model):
    code = CharField(50, unique)
    name = CharField(200)
    match_patterns = JSONField()  # ["TST", "Тест"]
    is_active = BooleanField(default=True)

class Laboratory(models.Model):
    code = CharField(50, unique)
    name = CharField(200)
    prefixes = JSONField()  # ["TAA-A", "TAA-B"]
    is_active = BooleanField(default=True)
Причина:

Один участок может иметь несколько обозначений в разных Н/З.

Одна лаборатория может использовать разные префиксы.

Паттерны меняются независимо от самого участка/лаборатории.

Статус: ✅ действует.

1.38. 2026-10-08 — Автоопределение участка по паттернам Н/З
Решение: при приёмке система автоматически определяет участок
по названию Н/З:

python
def detect_site(work_order_number):
    for site in Site.objects.filter(is_active=True):
        for pattern in site.match_patterns:
            if pattern.lower() in work_order_number.lower():
                return site
При конфликте (несколько паттернов подходят) — самый длинный
паттерн побеждает. Если длины равны — ручной выбор.

Если не найдено — предложить пользователю:

Выбрать участок из списка.

Создать новый.

Добавить паттерн к существующему.

Автосохранение без спроса запрещено — иначе справочник засорится.

Статус: ✅ действует.

1.39. 2026-10-08 — Автоопределение лаборатории по префиксу
Решение: при приёмке система определяет лабораторию по префиксу
номера пробы (из Laboratory.prefixes).

python
def detect_laboratory(sample_number):
    for lab in Laboratory.objects.filter(is_active=True):
        for prefix in lab.prefixes:
            if sample_number.startswith(prefix):
                return lab
Если префикс не найден — нешифрованная проба (префикс участка).
Если похож на лабораторный, но не найден — спросить пользователя.

Статус: ✅ действует.

1.40. 2026-10-08 — Формат номера пробы: prefix / middle / sequence
Решение: хранить полный номер как строку + разобранные части:

python
class Sample(models.Model):
    sample_number = CharField(100)
    is_encrypted = BooleanField()
    number_prefix = CharField(50)      # "TAA-A" или "TST"
    number_middle = CharField(50)      # "34076001" или "124"
    number_sequence = CharField(20)    # "001", "01", "7021"
Правило парсинга: «от известного к неизвестному».

Префикс — из справочника (точно).

Middle — по правилу (5 цифр для партии, переменная для скважины).

Sequence — остаток (переменная длина: 2, 3, 4 цифры).

Причина:

Длина sequence переменная — парсить позиционно нельзя.

Хранить разобранное — быстро искать и группировать.

Статус: ✅ действует.

1.41. 2026-10-08 — Приёмка: оба Н/З на этикетке
Решение: на этикетке тары — входящий и текущий Н/З. При приёмке
оба вводятся в систему, связываются через WorkOrder.linked_order.

В форме приёмки — чекбокс «Входящий Н/З», который раскрывает
поле. Если у текущего Н/З уже есть linked_order — поле заполняется
автоматически.

Причина:

Данные на этикетке — источник истины.

linked_order — уже готовая связь (решение 1.3).

Статус: ✅ действует.

1.42. 2026-10-08 — Отказ от SampleDecryption на приёмке
Решение: отдельную таблицу соответствия шифрованных и нешифрованных
проб не создаём в MVP. Данные на этикетке (вх. Н/З + тек. Н/З +
префикс лаборатории) достаточны для связывания пробы с участком
и Н/З.

На будущее: расшифровку скважины можно получить от ЛИМС.
Место — в Sample.legacy_data (JSONB). Отдельная таблица — если
реально понадобится.

Причина:

На этикетке всё есть.

Лишняя сущность = лишний код.

Статус: ✅ действует.

1.43. 2026-10-08 — UX ручного ввода: партия → группа тары → скважины
Решение: форма ручного ввода состоит из трёх уровней:

Уровень 1. Партия:

Текущий Н/З (с подсказками).

Чекбокс «Входящий Н/З» → поле входящего.

Тип исследования (из справочника или новый).

Кол-во тары.

Автоопределённый участок и лаборатория — read-only.

Уровень 2. Группа тары — сворачиваемая шапка с Н/З + ТИ + кол-во.

Уровень 3. Тара:

Шапка тары — авто (участок, Н/З, ТИ, номер тары).

Кол-во проб.

Строки скважин с диапазоном.

Кнопка «Добавить скважину».

Кнопка «Комментарий», «Предпросмотр», «Сохранить».

Кнопка «Сохранить» активна только когда счётчики сходятся.

Статус: ✅ действует.

1.44. 2026-10-08 — Приёмка: статусы проб
Решение: каждая проба в партии имеет статус:

PRESENT — физически есть, в списках есть.

SELECTED — физически нет, но в списках есть (отобрана
на доп. исследования).

MISSING — физически нет, в списках нет.

Счётчик на приёмке:

text
Итого = диапазон − отсутствующие − выбранные
При расхождении с заявленным «Кол-во» — красный фон,
подсветка конкретной скважины.

Статус: ✅ действует.

1.45. 2026-10-08 — Формат этикетки
Решение: этикетка 20 × 12 см (2 на A4). Структура:

text
┌──────────────────────────────┐
│ ШАПКА         │   QR-код     │
│ Участок       │   #ID тары   │
│ Н/З вх + тек  │              │
│ Тип           │              │
│ Тара          │              │
├──────────────────────────────┤
│ СПИСОК ПРОБ                  │
│  ☐  1. Проба1                │
│  ☐  2. Проба2                │
│  ...                         │
└──────────────────────────────┘
Раскладка:

Шапка — верхний левый угол.

QR + ID — верхний правый угол.

Список проб — ниже.

Чекбокс слева от каждого образца — для физической отметки
«выбрано» при отборе.

Авто-масштаб:

Мало проб (≤ 15) — 1 колонка, обычный шрифт.

Средне (16–60) — 2 колонки, авто-масштаб.

Много (> 60) — разбить на несколько этикеток.

Порог разбиения уточняется эмпирически при тестовой печати.

Пустая тара — этикетку не печатаем, показываем предупреждение
«Введите пробы».

Статус: ✅ действует.

1.46. 2026-10-08 — QR + короткий ID тары
Решение: на этикетке и при печати только QR — печатать
QR + короткий ID рядом.

Формат:

text
┌─────────┐
│  [QR]   │
│  #12345 │
└─────────┘
Причина:

20 QR на листе A4 — все визуально одинаковы.

При наклейке после печати человек видит, какой QR для какой тары.

Если QR потерялся — по ID найти тару в системе.

Статус: ✅ действует.

1.47. 2026-10-08 — Статус PENDING_PLACEMENT
Решение: Container.status получает новый статус
PENDING_PLACEMENT.

При ручном вводе тары без указания места → PENDING_PLACEMENT.
При приёмке с известным местом → сразу ACTIVE.

Отдельный раздел «Ожидает размещения» — список тар
PENDING_PLACEMENT. Выбрать несколько → «Разместить» → указать
ячейку/зону.

Причина: старые тары оцифровываются массово, размещение —
отдельным шагом.

Статус: ✅ действует.

1.48. 2026-10-08 — Массовая печать: корзина → PDF
Решение: механизм массовой печати:

Выбрать тары (чекбоксами).

«В корзину печати».

Открыть корзину → выбрать «Этикетки» или «Только QR».

Система рассчитывает раскладку на A4.

Кнопка «Печать» → PDF.

Скачать / распечатать.

Модель: PrintBatch + PrintBatchItem.

MVP или серия 2.0 — решим позже.

Статус: ✅ действует.

1.49. 2026-10-08 — Excel: формат их (не наш)
Решение: парсим существующий формат лабораторий, не навязываем
свой.

Структура:

Один файл = одна лаборатория.

Один лист = один участок.

Строки = Н/З.

Столбцы = типы исследования (ШЛ, ХА, ИЗ).

Ячейки = количество тары.

Дата — правый столбец (напротив каждого Н/З).

Загрузка: менеджер вручную загружает файл через UI.
Детали импорта — обсуждаем отдельно перед реализацией.

Причина:

Навязывать формат — переговоры, время.

Их формат уже существует.

Статус: ✅ действует.

1.50. 2026-10-08 — Акт приёмки
Решение: при расхождении с Excel или с этикеткой система формирует
«Акт приёмки» — PDF-документ.

Содержимое:

От кого / кому.

Партия, дата, лаборатория, участок.

Что приехало.

Список того, что НЕ приехало — внизу.

Подписи.

Печать + отправка отправителю (или подписание на месте).

Причина:

Формальная фиксация расхождений.

Материал для разбирательства с лабораторией.

Статус: ✅ действует.

1.51. 2026-10-08 — Ручной ввод доступен всегда
Решение: ручной ввод работает независимо от источника данных
(QR, Excel, OCR, ЛИМС API). Даже если данные пришли автоматически,
пользователь может поправить.

Причина:

Реальность отличается от идеала.

Ручной ввод — fallback и контроль качества.

Работает с уже хранящимися тарами при оцифровке.

Статус: ✅ действует.

1.52. 2026-10-08 — Портал для лабораторий (Уровень 2 интеграции)
Решение: отдельный раздел веб-приложения для лабораторий-отправителей.

Возможности:

Логин по аккаунту лаборатории (создаёт наш админ).

Создание рейса: название (автогенерируется, редактируется), дата,
откуда, куда.

Сборка рейса:

Импорт из ЛИМС — копипаст текстовой выгрузки, парсинг блоков.

Ручной ввод — форма с общим списком проб на один или
несколько типов.

Авторазбивка по тарам (одинаковая для каждого выбранного ТИ).

Просмотр и редактирование тары.

Печать этикеток (одна / массово).

Сопроводительный документ + чек-лист для машины.

Смена статусов (только вперёд, с защитой).

Статусы рейса (в UI на русском):

Технический	Русский	Кто меняет
DRAFT	Черновик	Лаборатория
ASSEMBLED	Собран	Лаборатория
SENT	Отправлен	Лаборатория
RECEIVED	Принят	Наш кладовщик
PARTIALLY_RECEIVED	Принят с расхождениями	Наш кладовщик
RETURNED	Возвращён	Наш кладовщик
CANCELLED	Отменён	Лаборатория / админ
LOST	Утерян	Только админ
Обратный поток: Shipment.direction:

OUTBOUND — мы → лаборатория.

INBOUND — лаборатория → мы.

Справочник тары лаборатории: ContainerType.laboratory_id (FK, nullable):

NULL — общий тип, доступен всем.

Иначе — только этой лаборатории.

Импорт из ЛИМС — формат:

Копипаст текста в поле.

Разбиение на блоки: пустая строка + Н/З — новый блок.

Внутри блока: Н/З (одно или два), тара (тип + номер),
тип исследования, участок (опц.), список проб.

Список проб: строка = п/п + пробел + номер пробы, например
2 TST1234001.

Уточнение терминологии (навески):

Проба в системе = навеска физически.

Один номер может повторяться для разных типов исследования.

Sample.sample_number не уникален.

«Логическая проба» как сущность в системе отсутствует.

Границы MVP (серия 2.0):

✅ Логин, создание рейса, сборка, разбивка, печать, отправка.

✅ Обратный поток (OUTBOUND) + подтверждение получения.

❌ Email-уведомления.

❌ Интеграция с ЛИМС API (только копипаст).

❌ Мобильное приложение для лабораторий.

Причина: Уровень 2 интеграции (1.9) — даём лабораториям наш
инструмент. Данные в нашем формате → приёмка = сканирование →
замкнутый цикл.

Статус: ✅ действует (серия 2.0).

2. Что не делаем и почему
Не используем SampleParts.

Не храним две колонки для Н/З.

Не заставляем лаборатории использовать наш формат.

Не переклеиваем старые этикетки.

Не используем закрытые лицензии.

Не создаём кастомную модель User.

Не используем Django fixtures для seeds.

Не запускаем Django-команды через кнопку «Run» в VS Code.

Не клеим QR на поддоны и пробы в MVP.

Не удаляем пробы физически.

Не блокируем размещение при превышении вместимости.

Не реализуем bin packing и учёт веса в MVP.

Не реализуем логику керна в MVP.

Не патчим миграции v1 через 0002.

Не требуем не-NULL сразу для pallet/container в move item.

Не используем session-based auth для API.

Не пишем OpenAPI вручную.

Не создаём SampleDecryption на MVP. (1.42)

Не парсим номер пробы позиционно — только «от префикса».

Не навязываем свой формат Excel. (1.49)

Не используем pillow 10.4 — не поддерживает Python 3.14.
Версия 11.3.

Не навязываем лабораториям наш UI сразу — они получают Портал,
но ручной ввод с нашей стороны всегда доступен (1.51).

Не храним email-уведомления в MVP Портала лабораторий.

3. Глоссарий
Данные
Термин	Что значит
Проба (Sample)	Физическая единица хранения. В системе = навеска.
Навеска	То же, что Проба. Физический кусок, отделённый для исследования.
Наряд-заказ (Н/З)	Группа проб. INCOMING / CODED.
Входящий Н/З	Название до шифровки.
Зашифрованный Н/З	Название после шифровки.
Тип исследования (ТИ)	ResearchType. ШЛ, ХА, ИЗ.
Участок (Site)	Место отбора проб.
Лаборатория (Laboratory)	Откуда пришла проба.
Тара (Container)	Физический контейнер.
Поддон (Pallet)	«Тихий» объект. OneToOne с ячейкой.
Ячейка (Cell)	Место на ярусе. 1 поддон.
Секция	Пролёт с 4 ярусами A–D.
Скважина (Well)	Источник пробы.
Партия (Receipt)	Группа тары, приехавшая одной машиной.
Рейс (Shipment)	Отправка. INBOUND (лаб→мы) / OUTBOUND (мы→лаб).
Процесс
Термин	Что значит
Приёмка	Поступление тары.
Двухфазная приёмка	Excel → предзаполнение → подтверждение.
Акт приёмки	PDF с расхождениями.
Формирование поддона	Сбор тар на поддон.
Выборка (picking)	Извлечение проб по списку.
Отправка (shipment)	Группа проб в лабораторию (или от неё).
Утилизация	Soft-delete (DISPOSED).
Инвентаризация	Сверка физического наличия.
Расхождение (issue)	Проблема по инвентаризации.
Помощник по сортировке	Рекомендация места.
Префикс	Код участка или лаборатории в номере пробы.
Партия (шифр)	5 цифр в шифрованном номере пробы.
Порядковый номер (sequence)	Последние цифры номера пробы.
Портал лаборатории	Веб-раздел для лабораторий-отправителей.
Инфраструктура
Термин	Что значит
Docker Compose	PG в контейнере (домашний ПК).
Портативный PostgreSQL	PG без установки (рабочий ПК).
poetry run	Запуск в venv.
JWT	JSON Web Token.
drf-spectacular	Генератор OpenAPI 3.
UI
Термин	Что значит
Дашборд	Главный экран.
Сканер	Экран сканирования.
Виртуальный вид секции	Ярусы A–D и ячейки.
Корзина печати	Пул тар для массовой печати.
Рабочая область рейса	Основной экран сборки рейса.
4. Что НЕ значат эти термины
«Часть пробы» — не используется. Есть навеска.

«Логическая проба» — не сущность в системе.

«Ячейка» — не слот на 3 поддона. 1 поддон.

«Поддон» — «тихий» объект, без QR и pallet_code.

«Наряд-заказ» — входящий и зашифрованный — разные строки.

«Проба» — не уникальна по номеру. Один номер × разные типы.

«User» — Django-овский.

«Справочник» — редактируемый через Admin, не жёсткий choices.

«Префикс» — не часть sequence. Это якорь номера.

«Партия в номере» — не Receipt. Это 5-цифровой шифр в номере пробы.

«Рейс» — не одна тара. Это отправка (может быть много тар).

text

---

### **Заменить полностью** — `docs/DATABASE.md`

```markdown
# DATABASE.md — схема данных

## Общее

- **СУБД:** PostgreSQL 16+ (портативный / Docker).
- **Кодировка:** UTF-8.
- **Временная зона:** UTC (хранение), локальная (отображение).
- **Версия схемы:** 4.
- **Миграции:** Django migrations в `backend/apps/*/migrations/`.

## История версий

- **v1** — базовые модели (серия 1.0).
- **v2** — топология A–D, «тихий» Pallet, ContainerType (серия 1.0a).
- **v3** — справочники, структура номера пробы, приёмка (серия 1.3).
- **v4** — Портал лабораторий: `Shipment.direction`, расширенные
  статусы, `ContainerType.laboratory_id`, `Receipt.shipment_id`.

## Изменения v3 → v4

Решения **1.52** из `docs/DECISIONS.md`:

- `ContainerType.laboratory_id` (FK, nullable).
- `Shipment.direction` (`INBOUND` / `OUTBOUND`).
- `Shipment` — расширенные поля (`site_id`, `laboratory_id`,
  `shipment_date`, `driver_name`, `vehicle_number`, `assembled_at`,
  `sent_at`, `received_at`, `cancelled_at`, `cancelled_by_id`,
  `cancel_reason`) и расширенный набор статусов.
- `Receipt.shipment_id` (FK, nullable) — рейс-источник.

## Изменения v2 → v3

Решения **1.35 – 1.51**:

- Новые справочники: `ResearchTypes`, `Sites`, `Laboratories`,
  `ContainerComments`.
- `Samples.research_type` → FK на `ResearchTypes`.
- `Samples.site` → FK на `Sites`.
- `Samples` + `number_prefix`, `number_middle`, `number_sequence`,
  `is_encrypted`.
- `Containers` + `comment`, `comment_template_id`, статус
  `PENDING_PLACEMENT`.
- `WorkOrders` + `site_id` (FK).
- Новые: `Receipts`, `ReceiptItems`, `ImportSessions`.

---

## Таблицы

### Справочники

#### `ResearchTypes`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `code` | VARCHAR(20) UNIQUE | `ШЛ`, `ХА`, `ИЗ` |
| `name` | VARCHAR(100) | «Шлифы», «Хим. анализ» |
| `description` | TEXT | |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `code`.

#### `Sites`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `code` | VARCHAR(50) UNIQUE | `TST` |
| `name` | VARCHAR(200) | «Тестовый участок» |
| `match_patterns` | JSONB | `["TST", "Тест"]` |
| `description` | TEXT | |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `code`.

#### `Laboratories`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `code` | VARCHAR(50) UNIQUE | `ЛАБ-1` |
| `name` | VARCHAR(200) | «Лаборатория 1» |
| `prefixes` | JSONB | `["TAA-A", "TAA-B"]` |
| `description` | TEXT | |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `code`.

#### `ContainerComments`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `text` | VARCHAR(500) | «Повреждена», «Влажная» |
| `sort_order` | INT DEFAULT 100 | |
| `is_active` | BOOLEAN DEFAULT TRUE | |

**Уникальность:** `text`.

---

### Пользователи

#### `Roles`, `Users` (Django auth_user), `UserProfiles`, `AuditLogs`

Без изменений (v1).

---

### Топология склада

#### `Rooms`, `Racks`, `Sections`, `Tiers`, `Cells`

Без изменений (v2).

- `Sections.qr_code` — обязателен.
- `Cells.qr_code` — обязателен.
- `Cells.cell_type` — `STANDARD` / `CORE`.

#### `Pallets` (Вариант A)

Без изменений (v2):

- OneToOne с `Cell`.
- Без `qr_code`, без `pallet_code`, без `position_in_cell`.
- `pallet_type`, `capacity_override` (JSONB).
- Статусы: `ACTIVE / EMPTY / IN_TRANSIT`.

#### `ContainerTypes`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | VARCHAR(100) | «Коробка», «Ящик» |
| **`laboratory_id`** | **INT FK → Laboratories NULL** | **NEW в v4** — NULL = общий |
| `size_class` | VARCHAR(10) | `S / M / L / XL` |
| `max_on_standard_pallet` | INT DEFAULT 10 | |
| `is_core` | BOOLEAN DEFAULT FALSE | |
| `description` | TEXT | |

**Уникальность:** `(name, laboratory_id)`.
**Правило:** `laboratory_id = NULL` → общий тип; иначе — только этой
лаборатории.

#### `Containers`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `container_number` | VARCHAR(100) UNIQUE | |
| `container_type_id` | INT FK → ContainerTypes (PROTECT) | |
| `qr_code` | TEXT UNIQUE NULL | `WMSG:CONTAINER:<id>` |
| `pallet_id` | INT FK → Pallets NULL | |
| `floor_room_id` | INT FK → Rooms NULL | |
| `position_on_pallet` | INT NULL | |
| `comment` | TEXT | |
| `comment_template_id` | INT FK → ContainerComments NULL | |
| `status` | VARCHAR(50) | `ACTIVE / PENDING_PLACEMENT / IN_TRANSIT / ISSUED` |
| `created_at` | TIMESTAMPTZ | |

**CHECK:** `pallet_id` и `floor_room_id` не заданы одновременно.

---

### Пробы и Н/З

#### `Wells`

Без изменений (v1).

#### `WorkOrders`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `order_number` | VARCHAR(100) | |
| `order_type` | VARCHAR(20) | `INCOMING` / `CODED` |
| `linked_order_id` | INT FK → WorkOrders NULL | self-ref |
| `site_id` | INT FK → Sites NULL | |
| `status` | VARCHAR(50) | |
| `description` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Уникальность:** `(order_number, order_type)`.
**CHECK:** `id <> linked_order_id`.

#### `Samples`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `sample_number` | VARCHAR(100) | полный номер, как есть (**не уникален**) |
| `is_encrypted` | BOOLEAN | шифрованная или нет |
| `number_prefix` | VARCHAR(50) | `TAA-A` или `TST` |
| `number_middle` | VARCHAR(50) | `34076001` или `124` |
| `number_sequence` | VARCHAR(20) | `001`, `01`, `7021` |
| `research_type_id` | INT FK → ResearchTypes (PROTECT) | |
| `well_id` | INT FK → Wells NULL | |
| `depth_from` | NUMERIC(10,2) NULL | |
| `depth_to` | NUMERIC(10,2) NULL | |
| `site_id` | INT FK → Sites NULL | |
| `container_id` | INT FK → Containers (PROTECT) NOT NULL | |
| `current_work_order_id` | INT FK → WorkOrders NULL | |
| `status` | VARCHAR(50) | `IN_STORAGE / IN_TRANSIT / ISSUED / CONSUMED / DISPOSED / PENDING_DECRYPTION` |
| `receipt_item_id` | INT FK → ReceiptItems NULL | |
| `qr_code` | TEXT UNIQUE NULL | |
| `legacy_data` | JSONB NULL | |
| `disposed_at` | TIMESTAMPTZ NULL | |
| `disposed_by_id` | INT FK → User NULL | |
| `disposal_reason` | TEXT | |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | |

**Индексы:** `sample_number`, `number_prefix`, `number_middle`,
`research_type`, `container`, `current_work_order`, `site`, `status`.

#### `SampleWorkOrders`

Без изменений (v2).

---

### Приёмка

#### `Receipts`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `receipt_number` | VARCHAR(100) UNIQUE | `ПР-2026-001` |
| `laboratory_id` | INT FK → Laboratories NULL | |
| `site_id` | INT FK → Sites NULL | |
| **`shipment_id`** | **INT FK → Shipments NULL** | **NEW в v4** — рейс-источник |
| `excel_file` | FILE NULL | исходный Excel |
| `imported_at` | TIMESTAMPTZ NULL | |
| `imported_by_id` | INT FK → User NULL | |
| `received_at` | TIMESTAMPTZ NULL | |
| `received_by_id` | INT FK → User NULL | |
| `expected_date` | DATE NULL | |
| `status` | VARCHAR(50) | `EXPECTED / IN_PROGRESS / CONFIRMED / CANCELLED` |
| `comment` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Индексы:** `receipt_number`, `status`, `expected_date`.

#### `ReceiptItems`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `receipt_id` | INT FK → Receipts (CASCADE) | |
| `container_id` | INT FK → Containers NULL | |
| `expected_container_number` | VARCHAR(100) | |
| `expected_work_order_number` | VARCHAR(100) | |
| `expected_research_type_code` | VARCHAR(20) | |
| `expected_site_code` | VARCHAR(50) NULL | |
| `expected_samples_count` | INT NULL | |
| `actual_container_number` | VARCHAR(100) NULL | |
| `actual_samples_count` | INT NULL | |
| `scanned_barcodes` | JSONB NULL | |
| `status` | VARCHAR(50) | `EXPECTED / MATCHED / DISCREPANCY / MISSING / EXTRA / PENDING_DECRYPTION` |
| `work_order_id` | INT FK → WorkOrders NULL | |
| `research_type_id` | INT FK → ResearchTypes NULL | |
| `site_id` | INT FK → Sites NULL | |
| `note` | TEXT | |

**Индексы:** `receipt`, `status`.

#### `ImportSessions`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `file` | FILE | загруженный Excel |
| `file_format` | VARCHAR(20) | `XLSX / CSV` |
| `uploaded_at` | TIMESTAMPTZ | |
| `uploaded_by_id` | INT FK → User NULL | |
| `status` | VARCHAR(50) | `PARSING / PARSED / ERROR / APPLIED` |
| `parse_errors` | JSONB | |
| `receipt_id` | INT FK → Receipts NULL | |

---

### Выборка и отправка

#### `PickLists`, `PickListItems`

Без изменений (v2).

#### `Shipments`

| Поле | Тип | Описание |
|---|---|---|
| `id` | SERIAL PK | |
| `shipment_number` | VARCHAR(100) UNIQUE | `Р-2026-001` / `ОТ-2026-001` |
| **`direction`** | **VARCHAR(20)** | **NEW в v4** — `INBOUND` / `OUTBOUND` |
| `destination` | VARCHAR(200) | |
| **`laboratory_id`** | **INT FK → Laboratories NULL** | **NEW в v4** |
| **`site_id`** | **INT FK → Sites NULL** | **NEW в v4** |
| **`shipment_date`** | **DATE NULL** | **NEW в v4** |
| **`driver_name`** | **VARCHAR(200)** | **NEW в v4** |
| **`vehicle_number`** | **VARCHAR(50)** | **NEW в v4** |
| **`status`** | **VARCHAR(50)** | **NEW в v4** — расширен |
| **`assembled_at`** | **TIMESTAMPTZ NULL** | **NEW в v4** |
| **`sent_at`** | **TIMESTAMPTZ NULL** | **NEW в v4** |
| **`received_at`** | **TIMESTAMPTZ NULL** | **NEW в v4** |
| **`cancelled_at`** | **TIMESTAMPTZ NULL** | **NEW в v4** |
| **`cancelled_by_id`** | **INT FK → User NULL** | **NEW в v4** |
| **`cancel_reason`** | **TEXT** | **NEW в v4** |
| `sent_by_id` | INT FK → User NULL | |
| `note` | TEXT | |
| `created_at` | TIMESTAMPTZ | |

**Статусы:**
`DRAFT / ASSEMBLED / SENT / RECEIVED / PARTIALLY_RECEIVED /
RETURNED / CANCELLED / LOST`.

**Направления:**
- `INBOUND` — лаборатория → мы. Порождает `Receipt` при приёмке.
- `OUTBOUND` — мы → лаборатория. Лаборатория подтверждает получение.

**Индексы:** `shipment_number`, `direction`, `status`,
`laboratory_id`, `-created_at`.

#### `ShipmentItems`

Без изменений (v2).

---

### Пул перемещений

#### `MoveOperations`, `MoveOperationItems`

Без изменений (v2).

---

### Инвентаризация

#### `InventorySessions`, `InventoryScans`, `InventoryIssues`

Без изменений (v2).

---

### Отложено (серия 2.0+)

#### `PrintBatches`, `PrintBatchItems`

Для массовой печати этикеток и QR (решение 1.48).

#### `SampleDecryption`

Таблица соответствия шифрованных и нешифрованных проб (решение 1.42).
Пока не создаём — есть `Sample.legacy_data` (JSONB).

---

## Соглашения

- **Именование таблиц:** PascalCase во множественном числе.
- **Именование полей:** snake_case.
- **Timestamp:** `TIMESTAMPTZ` везде. Хранение в UTC.
- **JSONB:** `legacy_data`, `match_patterns`, `prefixes`,
  `scanned_barcodes`, `parse_errors`, `capacity_override`.
- **CHECK-constraints:** `condition=` (Django 5.2+).
- **CASCADE / PROTECT / SET_NULL:** явно указано у каждого FK.
- **Справочники:** `PROTECT` на FK из реальных данных.

## План миграций v4

### Шаг 1: `ContainerTypes.laboratory_id`

1. Добавить `laboratory_id` (FK, nullable).
2. Существующие типы — `NULL` (общие).

### Шаг 2: `Shipments` — расширение

1. Добавить `direction` (default `OUTBOUND` для существующих).
2. Добавить `laboratory_id`, `site_id`, `shipment_date`,
   `driver_name`, `vehicle_number`, `assembled_at`, `sent_at`,
   `received_at`, `cancelled_at`, `cancelled_by_id`, `cancel_reason`.
3. Изменить `status` — добавить новые значения.

### Шаг 3: `Receipts.shipment_id`

1. Добавить `shipment_id` (FK, nullable).

## Бэкапы

Без изменений.

## Что НЕ хранится

- Расшифровка проб (до появления ЛИМС-выгрузки).
- Печатные корзины (до серии 2.0).