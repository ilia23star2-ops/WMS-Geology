"""
Сервис импорта: ParsedWorkbook → Receipt + ReceiptItems.

Логика:
- Для каждого ParsedSheet создаётся один Receipt.
- Если задан `target_date` — импортируются только строки этой даты,
  `Receipt.expected_date = target_date`.
- Проверка дубликата: если Receipt с такой `expected_date` уже есть,
  поведение зависит от `duplicate_action`:
    - `cancel` (по умолчанию) — вернуть ошибку, ничего не создавать;
    - `overwrite` — удалить существующий Receipt, создать новый;
    - `create` — создать ещё один Receipt (несколько за одну дату).
- Site определяется по sheet_name через `Site.match_patterns`.
- WorkOrder — get_or_create по order_number + order_type.
- ResearchType — по коду.
- На каждую (work_order, research_type) создаётся ReceiptItem
  с `expected_samples_count = containers_count`.
"""

from dataclasses import replace
from datetime import date

from django.db import transaction

from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.receiving.parsers import ParsedWorkbook
from apps.samples.catalogs import ResearchType, Site
from apps.work_orders.models import WorkOrder


# ============================================================
# Вспомогательные
# ============================================================
def _detect_site(name: str) -> Site | None:
    """
    Определяет участок по названию листа/строки.

    Сначала — точное совпадение `Site.code` или `Site.name`, затем —
    по паттернам `match_patterns`.
    """
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
    """get_or_create WorkOrder. Если найден — при необходимости
    обновляем site."""
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
    Оставляет только строки с указанной датой.

    Листы без подходящих строк отбрасываются. Ошибки парсера
    сохраняются (они не привязаны к дате).
    """
    new_sheets = []
    for sheet in parsed.sheets:
        rows = [r for r in sheet.rows if r.date == target]
        if rows:
            new_sheets.append(replace(sheet, rows=rows))
    return ParsedWorkbook(sheets=new_sheets, errors=list(parsed.errors))


# ============================================================
# Создание Receipt + ReceiptItem
# ============================================================
def build_receipt_from_parsed(
    parsed: ParsedWorkbook,
    import_session: ImportSession,
    laboratory=None,
    expected_date: date | None = None,
) -> tuple[list[Receipt], list[dict]]:
    """
    Создаёт по одному Receipt на каждый ParsedSheet.

    :param parsed: результат парсинга.
    :param import_session: сессия импорта (для обратной ссылки).
    :param laboratory: лаборатория (опц., временно не используется).
    :param expected_date: дата привоза (сохраняется в Receipt).
    :returns: (список Receipt, список ошибок).
    """
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
# Применение импорта
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
    """
    Применяет импорт: создаёт Receipt/ReceiptItem, обновляет
    ImportSession.

    :param target_date: если задан — берутся только строки с этой
        датой, `Receipt.expected_date = target_date`.
    :param duplicate_action: 'cancel' | 'overwrite' | 'create'.
        Только при `target_date != None`.
    :returns: (Receipts, all_errors).
    """
    parser_errors = list(parsed.errors)

    # 1. Фильтр по дате.
    if target_date is not None:
        parsed = _filter_by_date(parsed, target_date)

    # 2. Проверка дубликата.
    duplicate_error: dict | None = None
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
            # 'create' — просто продолжаем, создадим ещё один.

    # 3. Создание Receipt/ReceiptItem.
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