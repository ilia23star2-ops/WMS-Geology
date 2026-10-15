"""
Сервис импорта.

Старое (не тронуто, используется для `POST /import-sessions/upload/`):
- `build_receipt_from_parsed` — Receipt + ReceiptItem (без Container).
- `apply_import` — с фильтром по дате, дубликатом, статусами.

Импорт рейса (`POST /import-sessions/import-shipment/`):
- `apply_shipment_import` — рейс целиком:
  Shipment (INBOUND, SENT) + Receipt (site=None) +
  по одной ReceiptItem + Container на каждую **однозначную** тару.

Спорные ячейки (`multi_date_match`):
- В ячейке несколько дат, `target_date` входит. Непонятно, сколько
  из общего количества тар приходит именно в эту дату.
- По каждой такой ячейке:
  - `ReceiptItem` **не создаём**;
  - `Container` **не создаём**;
  - записываем `NEEDS_CONFIRMATION` в `parse_errors`.
- Кладовщик разбирает на экране сверки (`resolve-receipt-conflicts`).

`no_dates` / `target_date_not_matched` → `TARGET_DATE_MISSING`.

Сверка (`receipts/{id}/check/`, `3b-2`):
- `check_receipt` — батч отметок.

`container_type`:
- Заполняется при создании `ReceiptItem` в `apply_shipment_import`
  и `resolve_receipt_conflicts`.
- В legacy-импорте (`build_receipt_from_parsed`) — NULL.
"""

from dataclasses import replace
from datetime import date, datetime

from django.db import transaction
from django.utils import timezone

from apps.picking.models import Shipment
from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.receiving.parsers import ParsedWorkbook
from apps.samples.catalogs import ResearchType, Site
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


# Русские заголовки для UI.
TITLE_NEEDS_CONFIRMATION = "Требует уточнения"
TITLE_TARGET_DATE_MISSING = "Нет данных на дату"
TITLE_UNKNOWN_TYPE = "Неизвестный тип исследования"
TITLE_MISSING_CONTAINER_TYPE = "Не указан тип тары"
TITLE_MISSING_WORK_ORDER = "Не найдена колонка Н/З"
TITLE_DUPLICATE_DATE = "Дубль даты"
TITLE_OTHER = "Прочие ошибки"


# ============================================================
# Вспомогательные (общие для старого и нового импорта)
# ============================================================
def _to_iso(value) -> str:
    """Нормализует дату к ISO-строке (str | date | datetime)."""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def _is_conflict_cell(cell, target_date: date) -> bool:
    """Ячейка конфликтная, если у неё >1 дат и target входит."""
    return len(cell.dates) > 1 and target_date in cell.dates


def _detect_site(name: str) -> Site | None:
    """Определяет участок по названию листа/строки."""
    if not name:
        return None
    exact = (
        Site.objects.filter(code__iexact=name).first()
        or Site.objects.filter(name__iexact=name).first()
    )
    if exact:
        return exact
    norm = name.lower()
    for site in Site.objects.filter(is_active=True):
        for pattern in site.match_patterns or []:
            if pattern.lower() in norm:
                return site
    return None


def _get_or_create_work_order(
    order_number: str,
    site: Site | None,
    order_type: str = WorkOrder.TYPE_INCOMING,
) -> WorkOrder:
    """get_or_create WorkOrder. Если найден — обновляем site при NULL."""
    wo, created = WorkOrder.objects.get_or_create(
        order_number=order_number,
        order_type=order_type,
        defaults={"site": site},
    )
    if not created and site and not wo.site:
        wo.site = site
        wo.save(update_fields=["site"])
    return wo


def _filter_by_date(parsed: ParsedWorkbook, target: date) -> ParsedWorkbook:
    """Оставляет только ячейки с указанной датой."""
    new_sheets = []
    for sheet in parsed.sheets:
        new_rows = []
        for row in sheet.rows:
            kept_cells = [c for c in row.cells if target in c.dates]
            if kept_cells:
                new_rows.append(replace(row, cells=kept_cells))
        if new_rows:
            new_sheets.append(replace(sheet, rows=new_rows))
    return ParsedWorkbook(sheets=new_sheets, errors=list(parsed.errors))


# ============================================================
# СТАРЫЙ импорт: Receipt + ReceiptItem (без Container)
# ============================================================
def build_receipt_from_parsed(
    parsed: ParsedWorkbook,
    import_session: ImportSession,
    laboratory=None,
    expected_date: date | None = None,
) -> tuple[list[Receipt], list[dict]]:
    """Создаёт по одному Receipt на каждый ParsedSheet."""
    created_receipts: list[Receipt] = []
    errors: list[dict] = []

    for sheet_index, sheet in enumerate(parsed.sheets, start=1):
        site = _detect_site(sheet.sheet_name)
        if site is None:
            errors.append({
                "title": "Участок не найден",
                "sheet": sheet.sheet_name,
                "error": f"Участок не найден: {sheet.sheet_name}",
            })
            continue

        receipt = Receipt.objects.create(
            receipt_number=f"ИМП-{import_session.pk}-{sheet_index}",
            laboratory=laboratory,
            site=site,
            expected_date=expected_date,
            status=Receipt.STATUS_EXPECTED,
            comment=f"Импорт из файла {import_session.file.name}",
        )

        for row in sheet.rows:
            wo = _get_or_create_work_order(row.work_order_number, site)

            for cell in row.cells:
                rt = ResearchType.objects.filter(
                    code__iexact=cell.research_type_code,
                ).first()
                if rt is None:
                    errors.append({
                        "title": TITLE_UNKNOWN_TYPE,
                        "sheet": sheet.sheet_name,
                        "work_order": row.work_order_number,
                        "error": (
                            f"Тип исследования не найден: "
                            f"{cell.research_type_code}"
                        ),
                    })
                    continue

                ReceiptItem.objects.create(
                    receipt=receipt,
                    container=None,
                    container_type=None,
                    expected_container_number="",
                    expected_work_order_number=row.work_order_number,
                    expected_research_type_code=rt.code,
                    expected_site_code=site.code,
                    expected_samples_count=cell.containers_count,
                    work_order=wo,
                    research_type=rt,
                    site=site,
                    status=ReceiptItem.STATUS_EXPECTED,
                )

        created_receipts.append(receipt)

    return created_receipts, errors


# ============================================================
# СТАРЫЙ импорт: применение
# ============================================================
def _make_duplicate_error(
    target_date: date,
    existing: Receipt,
) -> dict:
    """Стандартная структура ошибки-дубликата."""
    return {
        "title": TITLE_DUPLICATE_DATE,
        "error": "DUPLICATE_DATE",
        "message": (
            f"Партия за {target_date.strftime('%d.%m.%Y')} уже существует. "
            f"Выберите: перезаписать / создать новую / отмена."
        ),
        "existing_receipt_id": existing.pk,
        "existing_receipt_number": existing.receipt_number,
        "expected_date": target_date.isoformat(),
    }


@transaction.atomic
def apply_import(
    parsed: ParsedWorkbook,
    import_session: ImportSession,
    target_date: date | None = None,
    duplicate_action: str = "cancel",
    laboratory=None,
) -> tuple[list[Receipt], list[dict]]:
    """Применяет СТАРЫЙ импорт: Receipt/ReceiptItem без Container."""
    parser_errors = list(parsed.errors)

    if target_date is not None:
        parsed = _filter_by_date(parsed, target_date)

    if target_date is not None:
        existing = Receipt.objects.filter(
            expected_date=target_date,
        ).first()
        if existing:
            if duplicate_action == "cancel":
                duplicate_error = _make_duplicate_error(target_date, existing)
                all_errors = parser_errors + [duplicate_error]
                import_session.parse_errors = all_errors
                import_session.status = ImportSession.STATUS_ERROR
                import_session.save(
                    update_fields=["parse_errors", "status"],
                )
                return [], all_errors
            elif duplicate_action == "overwrite":
                existing.delete()

    receipts, build_errors = build_receipt_from_parsed(
        parsed=parsed,
        import_session=import_session,
        laboratory=laboratory,
        expected_date=target_date,
    )
    all_errors = parser_errors + build_errors

    import_session.parse_errors = all_errors
    if receipts and not all_errors:
        import_session.status = ImportSession.STATUS_APPLIED
        import_session.receipt = receipts[0]
    elif receipts:
        import_session.status = ImportSession.STATUS_PARSED
        import_session.receipt = receipts[0]
    else:
        import_session.status = ImportSession.STATUS_ERROR
    import_session.save(update_fields=["parse_errors", "status", "receipt"])

    return receipts, all_errors


# ============================================================
# НОВЫЙ импорт: Shipment + Receipt + ReceiptItem + Container
# ============================================================
def _generate_shipment_number(target_year: int) -> str:
    """Генерирует `Р-{year}-{NNN}` (3 цифры, от 001)."""
    prefix = f"Р-{target_year}-"
    last = (
        Shipment.objects
        .filter(shipment_number__startswith=prefix)
        .order_by("-shipment_number")
        .values_list("shipment_number", flat=True)
        .first()
    )
    if last is None:
        n = 1
    else:
        try:
            n = int(last.rsplit("-", 1)[-1]) + 1
        except (ValueError, IndexError):
            n = 1

    for _ in range(1000):
        candidate = f"{prefix}{n:03d}"
        if not Shipment.objects.filter(
            shipment_number=candidate,
        ).exists():
            return candidate
        n += 1
    raise RuntimeError("Не удалось сгенерировать номер рейса.")


def _get_or_create_container_type(name: str) -> ContainerType:
    """get_or_create типа тары по имени (laboratory=NULL)."""
    ct, _ = ContainerType.objects.get_or_create(
        name=name,
        laboratory=None,
    )
    return ct


def _collect_pending_questions(
    parsed: ParsedWorkbook,
    target_date: date,
) -> list[dict]:
    """Собирает вопросы `NEEDS_CONFIRMATION` (`multi_date_match`)."""
    questions: list[dict] = []
    for sheet in parsed.sheets:
        for row in sheet.rows:
            for cell in row.cells:
                if _is_conflict_cell(cell, target_date):
                    questions.append({
                        "code": "NEEDS_CONFIRMATION",
                        "title": TITLE_NEEDS_CONFIRMATION,
                        "reason": "multi_date_match",
                        "sheet": sheet.sheet_name,
                        "work_order": row.work_order_number,
                        "research_type": cell.research_type_code,
                        "container_type": cell.container_type_name,
                        "containers_count": cell.containers_count,
                        "raw_dates": [d.isoformat() for d in cell.dates],
                        "target_date": target_date.isoformat(),
                        "message": (
                            f"В ячейке несколько дат, включая "
                            f"{target_date.strftime('%d.%m.%Y')}. "
                            f"Уточните, сколько тар приходит "
                            f"в эту дату."
                        ),
                    })
    return questions


def _collect_date_missing_errors(
    parsed: ParsedWorkbook,
    target_date: date,
) -> list[dict]:
    """Собирает информационные записи `TARGET_DATE_MISSING`."""
    errors: list[dict] = []
    for sheet in parsed.sheets:
        for row in sheet.rows:
            for cell in row.cells:
                dates = cell.dates
                if not dates:
                    errors.append({
                        "code": "TARGET_DATE_MISSING",
                        "title": TITLE_TARGET_DATE_MISSING,
                        "reason": "no_dates",
                        "sheet": sheet.sheet_name,
                        "work_order": row.work_order_number,
                        "research_type": cell.research_type_code,
                        "container_type": cell.container_type_name,
                        "containers_count": cell.containers_count,
                        "raw_dates": [],
                        "target_date": target_date.isoformat(),
                        "message": "На выбранную дату информации нет.",
                    })
                elif target_date not in dates:
                    errors.append({
                        "code": "TARGET_DATE_MISSING",
                        "title": TITLE_TARGET_DATE_MISSING,
                        "reason": "target_date_not_matched",
                        "sheet": sheet.sheet_name,
                        "work_order": row.work_order_number,
                        "research_type": cell.research_type_code,
                        "container_type": cell.container_type_name,
                        "containers_count": cell.containers_count,
                        "raw_dates": [d.isoformat() for d in dates],
                        "target_date": target_date.isoformat(),
                        "message": "На выбранную дату информации нет.",
                    })
    return errors


@transaction.atomic
def apply_shipment_import(
    parsed: ParsedWorkbook,
    import_session: ImportSession,
    *,
    target_date: date,
    laboratory=None,
    shipment_number: str | None = None,
    sent_by=None,
) -> tuple[Shipment | None, list[dict]]:
    """Создаёт рейс целиком (см. модульный докстринг)."""
    questions = _collect_pending_questions(parsed, target_date)
    date_missing_errors = _collect_date_missing_errors(parsed, target_date)
    parser_errors = list(parsed.errors)

    filtered = _filter_by_date(parsed, target_date)

    to_create: list[tuple[Site, str, ResearchType, str, int]] = []
    build_errors: list[dict] = []

    for sheet in filtered.sheets:
        site = _detect_site(sheet.sheet_name)
        if site is None:
            build_errors.append({
                "title": "Участок не найден",
                "sheet": sheet.sheet_name,
                "error": f"Участок не найден: {sheet.sheet_name}",
            })
            continue

        for row in sheet.rows:
            for cell in row.cells:
                if _is_conflict_cell(cell, target_date):
                    continue
                rt = ResearchType.objects.filter(
                    code__iexact=cell.research_type_code,
                ).first()
                if rt is None:
                    build_errors.append({
                        "title": TITLE_UNKNOWN_TYPE,
                        "sheet": sheet.sheet_name,
                        "work_order": row.work_order_number,
                        "error": (
                            f"Тип исследования не найден: "
                            f"{cell.research_type_code}"
                        ),
                    })
                    continue
                to_create.append((
                    site,
                    row.work_order_number,
                    rt,
                    cell.container_type_name,
                    cell.containers_count,
                ))

    all_errors = (
        parser_errors
        + build_errors
        + questions
        + date_missing_errors
    )

    if not to_create and not questions:
        import_session.parse_errors = all_errors
        import_session.status = ImportSession.STATUS_ERROR
        import_session.save(update_fields=["parse_errors", "status"])
        return None, all_errors

    with transaction.atomic():
        if not shipment_number:
            shipment_number = _generate_shipment_number(target_date.year)

        shipment = Shipment.objects.create(
            shipment_number=shipment_number,
            direction=Shipment.DIRECTION_INBOUND,
            laboratory=laboratory,
            site=None,
            shipment_date=target_date,
            status=Shipment.STATUS_SENT,
            sent_by=sent_by,
            note=f"Импорт из файла {import_session.file.name}",
        )

        receipt = Receipt.objects.create(
            receipt_number=f"ПР-{shipment.pk}",
            laboratory=laboratory,
            site=None,
            shipment=shipment,
            expected_date=target_date,
            status=Receipt.STATUS_EXPECTED,
            comment=f"Импорт из файла {import_session.file.name}",
        )

        for site, wo_number, rt, ct_name, count in to_create:
            wo = _get_or_create_work_order(wo_number, site)
            ct = _get_or_create_container_type(ct_name)

            for _ in range(count):
                container = Container.objects.create(
                    container_number=None,
                    container_type=ct,
                    status=Container.STATUS_IN_TRANSIT,
                    draft_site=site,
                    draft_research_type=rt,
                    draft_work_order_coded=wo_number,
                    draft_work_order_incoming="",
                )
                ReceiptItem.objects.create(
                    receipt=receipt,
                    container=container,
                    container_type=ct,
                    expected_container_number="",
                    expected_work_order_number=wo_number,
                    expected_research_type_code=rt.code,
                    expected_site_code=site.code,
                    expected_samples_count=1,
                    work_order=wo,
                    research_type=rt,
                    site=site,
                    status=ReceiptItem.STATUS_EXPECTED,
                )

    status_relevant = parser_errors + build_errors + questions

    import_session.parse_errors = all_errors
    import_session.receipt = receipt
    import_session.status = (
        ImportSession.STATUS_APPLIED
        if not status_relevant
        else ImportSession.STATUS_PARSED
    )
    import_session.save(update_fields=["parse_errors", "status", "receipt"])

    return shipment, all_errors


# ============================================================
# РАЗБОР КОНФЛИКТОВ РЕЙСА (3b-1): `receipts/{id}/conflicts/`
# ============================================================
def _compute_suggested_count(
    question: dict,
    current_receipt: Receipt,
) -> int:
    """Остаток тар по истории `MATCHED`-строк за те же даты."""
    total = int(question.get("containers_count", 0) or 0)
    wo_number = question.get("work_order", "")
    rt_code = question.get("research_type", "")
    sheet_name = question.get("sheet", "")
    raw_dates = question.get("raw_dates") or []

    if not (wo_number and rt_code and raw_dates):
        return total

    site = _detect_site(sheet_name)
    if site is None:
        return total

    try:
        dates = [date.fromisoformat(d) for d in raw_dates]
    except (ValueError, TypeError):
        return total

    used = (
        ReceiptItem.objects
        .filter(
            expected_work_order_number=wo_number,
            expected_research_type_code=rt_code,
            site=site,
            status=ReceiptItem.STATUS_MATCHED,
            receipt__expected_date__in=dates,
        )
        .exclude(receipt=current_receipt)
        .count()
    )

    return max(0, total - used)


def _all_questions(parse_errors: list[dict]) -> list[dict]:
    """Все вопросы (разобранные и нет)."""
    return [e for e in parse_errors if e.get("code") == "NEEDS_CONFIRMATION"]


def get_unresolved_conflicts(receipt: Receipt) -> list[dict]:
    """Неразобранные `NEEDS_CONFIRMATION` для Receipt."""
    import_session = ImportSession.objects.filter(receipt=receipt).first()
    if import_session is None:
        return []
    parse_errors = list(import_session.parse_errors or [])
    result: list[dict] = []
    for idx, e in enumerate(parse_errors):
        if e.get("code") != "NEEDS_CONFIRMATION":
            continue
        if e.get("resolved"):
            continue
        result.append({
            **e,
            "question_index": idx,
            "suggested_count": _compute_suggested_count(e, receipt),
        })
    return result


def count_questions(receipt: Receipt) -> tuple[int, int]:
    """Возвращает (total, resolved) по всем вопросам Receipt."""
    import_session = ImportSession.objects.filter(receipt=receipt).first()
    if import_session is None:
        return 0, 0
    parse_errors = list(import_session.parse_errors or [])
    questions = _all_questions(parse_errors)
    resolved = [q for q in questions if q.get("resolved")]
    return len(questions), len(resolved)


@transaction.atomic
def resolve_receipt_conflicts(
    receipt: Receipt,
    conflicts: list[dict],
) -> tuple[int, list[dict]]:
    """
    Разбирает конфликты `Receipt`.

    :param conflicts: `[{"question_index": int, "containers_count": int}]`.
    :returns: (создано `ReceiptItem`, список ошибок).
    """
    import_session = ImportSession.objects.filter(receipt=receipt).first()
    if import_session is None:
        return 0, [{"error": "У партии нет связанной сессии импорта."}]

    parse_errors = list(import_session.parse_errors or [])

    # 1. Валидация.
    errors: list[dict] = []
    seen: set[int] = set()

    for c in conflicts:
        idx = c["question_index"]
        count = c["containers_count"]

        if idx in seen:
            errors.append({
                "question_index": idx,
                "error": "Дубликат question_index в запросе.",
            })
            continue
        seen.add(idx)

        if idx < 0 or idx >= len(parse_errors):
            errors.append({
                "question_index": idx,
                "error": "Индекс вне диапазона parse_errors.",
            })
            continue

        q = parse_errors[idx]
        if q.get("code") != "NEEDS_CONFIRMATION":
            errors.append({
                "question_index": idx,
                "error": "Эта запись — не вопрос NEEDS_CONFIRMATION.",
            })
            continue

        if q.get("resolved"):
            errors.append({
                "question_index": idx,
                "error": "Вопрос уже разобран.",
            })
            continue

        if count < 0:
            errors.append({
                "question_index": idx,
                "error": "Количество не может быть отрицательным.",
            })
            continue

        total = int(q.get("containers_count", 0) or 0)
        if count > total:
            errors.append({
                "question_index": idx,
                "error": (
                    f"Указано больше, чем заявлено в файле ({total})."
                ),
            })
            continue

    if errors:
        return 0, errors

    # 2. Применяем.
    created_count = 0

    for c in conflicts:
        idx = c["question_index"]
        count = c["containers_count"]
        q = parse_errors[idx]

        site = _detect_site(q.get("sheet", ""))
        if site is None:
            return 0, [{
                "question_index": idx,
                "error": f"Участок не найден: {q.get('sheet')}",
            }]

        rt = ResearchType.objects.filter(
            code__iexact=q["research_type"],
        ).first()
        if rt is None:
            return 0, [{
                "question_index": idx,
                "error": (
                    f"Тип исследования не найден: {q['research_type']}"
                ),
            }]

        ct = _get_or_create_container_type(q["container_type"])
        wo = _get_or_create_work_order(q["work_order"], site)

        for _ in range(count):
            ReceiptItem.objects.create(
                receipt=receipt,
                container=None,
                container_type=ct,
                expected_container_number="",
                expected_work_order_number=q["work_order"],
                expected_research_type_code=rt.code,
                expected_site_code=site.code,
                expected_samples_count=1,
                work_order=wo,
                research_type=rt,
                site=site,
                status=ReceiptItem.STATUS_EXPECTED,
            )
            created_count += 1

        q["resolved"] = True
        q["resolved_at"] = timezone.now().isoformat()
        q["resolved_count"] = count

    # 3. Сохраняем.
    import_session.parse_errors = parse_errors

    questions = _all_questions(parse_errors)
    all_resolved = (
        all(q.get("resolved") for q in questions)
        if questions else True
    )
    if (
        questions
        and all_resolved
        and import_session.status == ImportSession.STATUS_PARSED
    ):
        import_session.status = ImportSession.STATUS_APPLIED

    import_session.save(update_fields=["parse_errors", "status"])

    return created_count, []


# ============================================================
# РАЗБОР ВОПРОСОВ (legacy): `POST /import-sessions/{id}/resolve-questions/`
# ============================================================
def _questions_in(parse_errors: list[dict]) -> list[dict]:
    """Все вопросы из parse_errors (по коду)."""
    return [
        e for e in parse_errors
        if e.get("code") == "NEEDS_CONFIRMATION"
    ]


def _collect_validation_errors(
    parse_errors: list[dict],
    resolutions: list[dict],
) -> list[dict]:
    """Проверяет корректность запроса на разбор до применения."""
    errors: list[dict] = []
    seen: set[int] = set()

    for r in resolutions:
        idx = r["question_index"]
        if idx in seen:
            errors.append({
                "question_index": idx,
                "error": "Дубликат question_index в запросе.",
            })
            continue
        seen.add(idx)

        if idx < 0 or idx >= len(parse_errors):
            errors.append({
                "question_index": idx,
                "error": "Индекс вне диапазона parse_errors.",
            })
            continue

        q = parse_errors[idx]
        if q.get("code") != "NEEDS_CONFIRMATION":
            errors.append({
                "question_index": idx,
                "error": "Эта запись — не вопрос NEEDS_CONFIRMATION.",
            })
            continue

        if q.get("resolved"):
            errors.append({
                "question_index": idx,
                "error": "Вопрос уже разобран.",
            })
            continue

        total = sum(
            d["containers_count"] for d in r["distribution"]
        )
        expected = q.get("containers_count", 0)
        if total != expected:
            errors.append({
                "question_index": idx,
                "error": (
                    f"Сумма распределения {total} не совпадает "
                    f"с количеством тар в вопросе ({expected})."
                ),
            })
            continue

        target_date_iso = q.get("target_date")
        if not target_date_iso:
            errors.append({
                "question_index": idx,
                "error": "В вопросе нет target_date.",
            })
            continue

        if not any(
            _to_iso(d["date"]) == target_date_iso
            for d in r["distribution"]
        ):
            errors.append({
                "question_index": idx,
                "error": (
                    f"В distribution отсутствует target_date "
                    f"{target_date_iso}."
                ),
            })

    return errors


@transaction.atomic
def resolve_import_questions(
    import_session: ImportSession,
    resolutions: list[dict],
) -> tuple[int, list[dict]]:
    """Legacy: разбор через `distribution` по датам."""
    parse_errors = list(import_session.parse_errors or [])
    questions = _questions_in(parse_errors)
    if not questions:
        return 0, [{"error": "В сессии нет вопросов NEEDS_CONFIRMATION."}]

    receipt = import_session.receipt
    if receipt is None:
        return 0, [{"error": "У сессии нет связанного Receipt."}]

    validation_errors = _collect_validation_errors(
        parse_errors, resolutions,
    )
    if validation_errors:
        return 0, validation_errors

    created_count = 0

    for r in resolutions:
        idx = r["question_index"]
        q = parse_errors[idx]
        target_date_iso = q["target_date"]

        site = _detect_site(q.get("sheet", ""))
        if site is None:
            return 0, [{
                "question_index": idx,
                "error": f"Участок не найден: {q.get('sheet')}",
            }]

        rt = ResearchType.objects.filter(
            code__iexact=q["research_type"],
        ).first()
        if rt is None:
            return 0, [{
                "question_index": idx,
                "error": f"Тип исследования не найден: {q['research_type']}",
            }]

        ct = _get_or_create_container_type(q["container_type"])
        wo = _get_or_create_work_order(q["work_order"], site)

        target_count = next(
            d["containers_count"]
            for d in r["distribution"]
            if _to_iso(d["date"]) == target_date_iso
        )

        for _ in range(target_count):
            container = Container.objects.create(
                container_number=None,
                container_type=ct,
                status=Container.STATUS_IN_TRANSIT,
                draft_site=site,
                draft_research_type=rt,
                draft_work_order_coded=q["work_order"],
                draft_work_order_incoming="",
            )
            ReceiptItem.objects.create(
                receipt=receipt,
                container=container,
                container_type=ct,
                expected_container_number="",
                expected_work_order_number=q["work_order"],
                expected_research_type_code=rt.code,
                expected_site_code=site.code,
                expected_samples_count=1,
                work_order=wo,
                research_type=rt,
                site=site,
                status=ReceiptItem.STATUS_EXPECTED,
            )
            created_count += 1

        q["resolved"] = True
        q["resolved_at"] = timezone.now().isoformat()
        q["resolved_distribution"] = [
            {
                "date": _to_iso(d["date"]),
                "containers_count": d["containers_count"],
            }
            for d in r["distribution"]
        ]

    import_session.parse_errors = parse_errors

    all_questions = _questions_in(parse_errors)
    all_resolved = [q for q in all_questions if q.get("resolved")]
    if all_questions and len(all_resolved) == len(all_questions):
        import_session.status = ImportSession.STATUS_APPLIED

    import_session.save(update_fields=["parse_errors", "status"])

    return created_count, []