"""
Сервисы приложения labels для партий печати.
"""

from datetime import datetime

from apps.labels.models import PrintBatch


def generate_batch_number() -> str:
    """
    Генерирует следующий номер партии печати.

    Формат: ПЕЧ-YYYY-NNN.
      - YYYY — текущий год (4 цифры);
      - NNN — порядковый номер в году (3 цифры, ведущие нули).

    Ищет последнюю партию текущего года и инкрементирует.
    Если в этом году партий ещё не было — начинает с 001.
    """
    year = datetime.now().year
    prefix = f"ПЕЧ-{year}-"

    last = (
        PrintBatch.objects
        .filter(batch_number__startswith=prefix)
        .order_by("-batch_number")
        .values_list("batch_number", flat=True)
        .first()
    )

    if last:
        try:
            n = int(last[len(prefix):])
        except ValueError:
            n = 0
    else:
        n = 0

    return f"{prefix}{n + 1:03d}"