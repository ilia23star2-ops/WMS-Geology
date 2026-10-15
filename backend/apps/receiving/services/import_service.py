"""
Сервис импорта.

Старое (не тронуто, используется для `POST /import-sessions/upload/`):
- `build_receipt_from_parsed` — Receipt + ReceiptItem (без Container).
- `apply_import` — с фильтром по дате, дубликатом, статусами.

Импорт рейса (`POST /import-sessions/import-shipment/`):
- `apply_shipment_import` — рейс целиком:
  Shipment (INBOUND, SENT) + Receipt (site=None) +
  ReceiptItem на каждую тару + пустой Container
  (status=IN_TRANSIT, draft-поля).

Спорные ячейки:
- `multi_date_match` (несколько дат, target входит) →
  `code=NEEDS_CONFIRMATION` (вопрос, разбор вручную).
- `no_dates` / `target_date_not_matched` →
  `code=TARGET_DATE_MISSING`, сообщение
  «На выбранную дату информации нет» (информационная запись,
  рейс не создаётся, если это единственное содержимое).

Разбор вопросов (`POST /import-sessions/{id}/resolve-questions/`):
- `resolve_import_questions` — принимает распределение тар по датам
  для каждого вопроса, создаёт `Container` + `ReceiptItem`
  только для `target_date`, помечает вопрос `resolved: true`.
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
    """
    Оставляет только ячейки с указанной датой.

    Ячейка без дат — пропускается (непонятно, к какой дате).
    Ячейка с несколькими датами — берётся, если target входит
    в список (спорный случай, фиксируется в errors на уровне
    сервиса).

    Листы без подходящих ячеек отбрасываются.
    """
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
    """
    Генерирует `Р-{year}-{NNN}` (3 цифры, от 001). Пропускает занятые.
    """
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
    """
    Собирает вопросы `NEEDS_CONFIRMATION`.

    Только один случай: `multi_date_match` — в ячейке несколько дат,
    и `target_date` входит в список. Нужно уточнить, сколько именно
    тар приходит в эту дату.
    """
    questions: list[dict] = []
    for sheet in parsed.sheets:
        for row in sheet.rows:
            for cell in row.cells:
                dates = cell.dates
                if len(dates) > 1 and target_date in dates:
                    questions.append({
                        "code": "NEEDS_CONFIRMATION",
                        "reason": "multi_date_match",
                        "sheet": sheet.sheet_name,
                        "work_order": row.work_order_number,
                        "research_type": cell.research_type_code,
                        "container_type": cell.container_type_name,
                        "containers_count": cell.containers_count,
                        "raw_dates": [d.isoformat() for d in dates],
                        "target_date": target_date.isoformat(),
                        "message": (
                            f"В ячейке несколько дат, включая "
                            f"{target_date.strftime('%d.%m.%Y')}. "
                            f"Н/З {row.work_order_number}, тип "
                            f"{cell.research_type_code}, "
                            f"{cell.container_type_name} × "
                            f"{cell.containers_count}. "
                            f"Нужно уточнить, сколько именно тар "
                            f"приходит в эту дату."
                        ),
                    })
    return questions


def _collect_date_missing_errors(
    parsed: ParsedWorkbook,
    target_date: date,
) -> list[dict]:
    """
    Собирает информационные записи `TARGET_DATE_MISSING`.

    Случаи:
    - `no_dates` — в ячейке нет ни одной даты;
    - `target_date_not_matched` — даты есть, но `target_date`
      не входит.

    Рейс в этих случаях не создаётся (если больше нечего создавать),
    но кладовщик видит в отчёте, что на выбранную дату информации нет.
    """
    errors: list[dict] = []
    for sheet in parsed.sheets:
        for row in sheet.rows:
            for cell in row.cells:
                dates = cell.dates
                if not dates:
                    errors.append({
                        "code": "TARGET_DATE_MISSING",
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
    """
    Создаёт рейс целиком:

    1. `Shipment` (direction=INBOUND, status=SENT, site=None).
    2. `Receipt` (site=None, shipment=shipment).
    3. По одной `ReceiptItem` на каждую тару (expected_samples_count=1).
    4. По одному пустому `Container` (status=IN_TRANSIT, draft-поля,
       container_number=None).
    5. Спорные ячейки (`multi_date_match`) → `NEEDS_CONFIRMATION`.
    6. Ячейки без дат / с датами, не включающими `target_date` →
       `TARGET_DATE_MISSING` (информационно, рейс не создаётся,
       если это единственное содержимое).

    :param target_date: обязательна.
    :param shipment_number: если не задан — генерируется.
    :returns: (Shipment | None, errors).
    """
    # 1. Вопросы и «нет данных» — по ИСХОДНОМУ parsed (до фильтра).
    questions = _collect_pending_questions(parsed, target_date)
    date_missing_errors = _collect_date_missing_errors(parsed, target_date)
    parser_errors = list(parsed.errors)

    # 2. Фильтр по дате.
    filtered = _filter_by_date(parsed, target_date)

    # 3. СУХОЙ ПРОГОН: собираем, что надо создать.
    to_create: list[tuple[Site, str, ResearchType, str, int]] = []
    build_errors: list[dict] = []

    for sheet in filtered.sheets:
        site = _detect_site(sheet.sheet_name)
        if site is None:
            build_errors.append({
                "sheet": sheet.sheet_name,
                "error": f"Участок не найден: {sheet.sheet_name}",
            })
            continue

        for row in sheet.rows:
            for cell in row.cells:
                rt = ResearchType.objects.filter(
                    code__iexact=cell.research_type_code,
                ).first()
                if rt is None:
                    build_errors.append({
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

    # 4. Если нечего создавать И нет вопросов — ERROR.
    #    Если есть вопросы — создаём рейс с 0 контейнерами (PARSED).
    #    `date_missing_errors` сами по себе рейс не создают.
    if not to_create and not questions:
        import_session.parse_errors = all_errors
        import_session.status = ImportSession.STATUS_ERROR
        import_session.save(update_fields=["parse_errors", "status"])
        return None, all_errors

    # 5. Запись в одной транзакции.
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

    # 6. Обновление сессии — вне транзакции записи.
    #    `date_missing_errors` не влияют на статус:
    #    они информационные, не блокируют APPLIED.
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
# РАЗБОР ВОПРОСОВ: `POST /import-sessions/{id}/resolve-questions/`
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
    """
    Проверяет корректность запроса на разбор до применения.

    Возвращает список ошибок (пустой — всё ок).
    """
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
    """
    Применяет разбор вопросов `NEEDS_CONFIRMATION`.

    :param import_session: сессия импорта (должна быть в PARSED).
    :param resolutions: список словарей
        `{"question_index": int, "distribution": [
            {"date": "YYYY-MM-DD", "containers_count": int}, ...]}`.
    :returns: (количество созданных Container, список ошибок).
    """
    parse_errors = list(import_session.parse_errors or [])
    questions = _questions_in(parse_errors)
    if not questions:
        return 0, [{"error": "В сессии нет вопросов NEEDS_CONFIRMATION."}]

    receipt = import_session.receipt
    if receipt is None:
        return 0, [{"error": "У сессии нет связанного Receipt."}]

    # 1. Валидация.
    validation_errors = _collect_validation_errors(
        parse_errors, resolutions,
    )
    if validation_errors:
        return 0, validation_errors

    # 2. Применяем.
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

        # 3. Помечаем вопрос.
        q["resolved"] = True
        q["resolved_at"] = timezone.now().isoformat()
        q["resolved_distribution"] = [
            {
                "date": _to_iso(d["date"]),
                "containers_count": d["containers_count"],
            }
            for d in r["distribution"]
        ]

    # 4. Обновляем parse_errors и статус.
    import_session.parse_errors = parse_errors

    all_questions = _questions_in(parse_errors)
    all_resolved = [q for q in all_questions if q.get("resolved")]
    if all_questions and len(all_resolved) == len(all_questions):
        import_session.status = ImportSession.STATUS_APPLIED

    import_session.save(update_fields=["parse_errors", "status"])

    return created_count, []