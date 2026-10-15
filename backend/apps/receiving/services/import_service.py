"""
Сервис импорта.

Старое (не тронуто, используется для `POST /import-sessions/upload/`):
- `build_receipt_from_parsed` — Receipt + ReceiptItem (без Container).
- `apply_import` — с фильтром по дате, дубликатом, статусами.

Новое (receiving-1b, `POST /import-shipment/`):
- `apply_shipment_import` — рейс целиком:
  Shipment (INBOUND, SENT) + Receipt (site=None) +
  ReceiptItem на каждую тару + пустой Container
  (status=IN_TRANSIT, draft-поля).
- Спорные ячейки (несколько дат, нет дат, target не совпал)
  уходят в `ImportSession.parse_errors` с `code=NEEDS_CONFIRMATION`.
"""

from dataclasses import replace
from datetime import date

from django.db import transaction

from apps.picking.models import Shipment
from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.receiving.parsers import ParsedWorkbook
from apps.samples.catalogs import ResearchType, Site
from apps.storage.models import Container, ContainerType
from apps.work_orders.models import WorkOrder


# ============================================================
# Вспомогательные (общие для старого и нового импорта)
# ============================================================
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
    сервиса — TODO receiving-1b).

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
    Собирает «вопросы» по спорным ячейкам:

    - `no_dates` — в ячейке нет ни одной даты;
    - `multi_date_match` — в ячейке несколько дат, target входит;
    - `target_date_not_matched` — в ячейке есть даты, но target
      не входит.

    Все вопросы кладутся в `parse_errors` с
    `code=NEEDS_CONFIRMATION`.
    """
    questions: list[dict] = []
    for sheet in parsed.sheets:
        for row in sheet.rows:
            for cell in row.cells:
                dates = cell.dates
                base = {
                    "code": "NEEDS_CONFIRMATION",
                    "sheet": sheet.sheet_name,
                    "work_order": row.work_order_number,
                    "research_type": cell.research_type_code,
                    "container_type": cell.container_type_name,
                    "containers_count": cell.containers_count,
                }
                if not dates:
                    questions.append({
                        **base,
                        "reason": "no_dates",
                        "raw_dates": [],
                        "message": (
                            f"Ячейка без даты. Н/З {row.work_order_number}, "
                            f"тип {cell.research_type_code}, "
                            f"{cell.container_type_name} × "
                            f"{cell.containers_count}. "
                            f"Уточните дату."
                        ),
                    })
                elif len(dates) > 1 and target_date in dates:
                    questions.append({
                        **base,
                        "reason": "multi_date_match",
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
                elif target_date not in dates:
                    questions.append({
                        **base,
                        "reason": "target_date_not_matched",
                        "raw_dates": [d.isoformat() for d in dates],
                        "target_date": target_date.isoformat(),
                        "message": (
                            f"В ячейке нет {target_date.strftime('%d.%m.%Y')}. "
                            f"Н/З {row.work_order_number}, тип "
                            f"{cell.research_type_code}, "
                            f"{cell.container_type_name} × "
                            f"{cell.containers_count}. "
                            f"Ячейка пропущена — уточните вручную."
                        ),
                    })
    return questions


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
    5. Спорные ячейки → в `parse_errors` с
       `code=NEEDS_CONFIRMATION`.

    :param target_date: обязательна.
    :param shipment_number: если не задан — генерируется.
    :returns: (Shipment | None, errors).
    """
    # 1. Вопросы — по ИСХОДНОМУ parsed (до фильтра по дате).
    questions = _collect_pending_questions(parsed, target_date)
    parser_errors = list(parsed.errors)

    # 2. Фильтр по дате.
    filtered = _filter_by_date(parsed, target_date)

    # 3. СУХОЙ ПРОГОН: собираем, что надо создать.
    #    Только Resolvable-элементы (site + research_type найдены).
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

    all_errors = parser_errors + build_errors + questions

    # 4. Если нечего создавать И нет вопросов — ERROR.
    #    Если есть вопросы — создаём рейс с 0 контейнерами (PARSED).
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
    import_session.parse_errors = all_errors
    import_session.receipt = receipt
    import_session.status = (
        ImportSession.STATUS_APPLIED
        if not all_errors
        else ImportSession.STATUS_PARSED
    )
    import_session.save(update_fields=["parse_errors", "status", "receipt"])

    return shipment, all_errors