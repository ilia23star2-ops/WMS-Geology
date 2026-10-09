"""
Сервис импорта: ParsedWorkbook → Receipt + ReceiptItems.

Логика:
- Для каждого ParsedSheet создаётся один Receipt.
- Site определяется по sheet_name через `Site.match_patterns`.
- WorkOrder — get_or_create по order_number + order_type.
- ResearchType — по коду.
- На каждую (work_order, research_type) создаётся ReceiptItem
  с `expected_samples_count = containers_count`.

Сервис не занимается файлами и парсингом. Он принимает уже
готовый `ParsedWorkbook` и создаёт объекты в БД.
"""

from django.db import transaction

from apps.receiving.models import ImportSession, Receipt, ReceiptItem
from apps.receiving.parsers import ParsedWorkbook
from apps.samples.catalogs import ResearchType, Site
from apps.work_orders.models import WorkOrder


def _detect_site(name: str) -> Site | None:
    """
    Определяет участок по названию листа/строки.

    Ищем точное совпадение `Site.code` или `Site.name`, а затем —
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


def build_receipt_from_parsed(
    parsed: ParsedWorkbook,
    import_session: ImportSession,
    laboratory=None,
) -> tuple[list[Receipt], list[dict]]:
    """
    Создаёт по одному Receipt на каждый ParsedSheet.

    :param parsed: результат парсинга.
    :param import_session: сессия импорта (для обратной ссылки).
    :param laboratory: лаборатория (опц.).
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


@transaction.atomic
def apply_import(
    parsed: ParsedWorkbook,
    import_session: ImportSession,
    laboratory=None,
) -> tuple[list[Receipt], list[dict]]:
    """
    Применяет импорт: создаёт Receipt/ReceiptItem, обновляет
    ImportSession.

    Учитывает **и** ошибки парсера (`parsed.errors`), **и** ошибки
    сервиса (build_errors).

    Возвращает (Receipts, all_errors).
    """
    parser_errors = list(parsed.errors)
    receipts, build_errors = build_receipt_from_parsed(
        parsed=parsed,
        import_session=import_session,
        laboratory=laboratory,
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