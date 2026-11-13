"""Патч SmartInputSuggestionsView: + work_orders_incoming.

Идемпотентно.
Одноразовая утилита захода c-3.x-migration-5d-fix.
"""
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
VIEWS = BACKEND / "apps" / "storage" / "views.py"


def patch(text: str) -> str:
    if "from apps.work_orders.models import WorkOrder" not in text:
        anchor = '        from apps.samples.models import Sample\n'
        if anchor in text:
            text = text.replace(
                anchor,
                anchor + '        from apps.work_orders.models import WorkOrder\n',
                1,
            )
            print("[views.py] + import WorkOrder (локальный)")
        else:
            print("[views.py] ? anchor 'from apps.samples.models import Sample' не найден")
    else:
        print("[views.py] = import WorkOrder (уже есть)")

    if "work_orders_incoming" not in text:
        anchor = (
            '        work_orders = list(\n'
            '            qs.exclude(current_work_order__isnull=True)\n'
            '            .values_list("current_work_order__order_number", flat=True)\n'
            '            .order_by().distinct()[:20]\n'
            '        )\n'
        )
        addition = (
            '\n        work_orders_incoming = list(\n'
            '            WorkOrder.objects.filter(order_type="INCOMING")\n'
            '            .values_list("order_number", flat=True)\n'
            '            .order_by("-created_at")\n'
            '            .distinct()[:20]\n'
            '        )\n'
        )
        if anchor in text:
            text = text.replace(anchor, anchor + addition, 1)
            print("[views.py] + work_orders_incoming")
        else:
            print("[views.py] ? anchor work_orders не найден")
    else:
        print("[views.py] = work_orders_incoming (уже есть)")

    if '"work_orders_incoming": work_orders_incoming' not in text:
        anchor = '"work_orders": work_orders,'
        if anchor in text:
            text = text.replace(
                anchor,
                anchor + '\n                "work_orders_incoming": work_orders_incoming,',
                1,
            )
            print("[views.py] + response.work_orders_incoming")
        else:
            print("[views.py] ? anchor response work_orders не найден")
    else:
        print("[views.py] = response.work_orders_incoming (уже есть)")

    return text


def main():
    original = VIEWS.read_text(encoding="utf-8")
    patched = patch(original)
    if patched == original:
        print("Ничего не изменилось.")
        return
    VIEWS.write_text(patched, encoding="utf-8")
    print("OK")


if __name__ == "__main__":
    main()