"""
Тесты сервиса генерации номера партии печати.
"""

from datetime import datetime

import pytest

from apps.labels.models import PrintBatch
from apps.labels.services.print_batch_service import generate_batch_number


@pytest.mark.django_db
def test_first_batch_number_for_current_year():
    """Первая партия в году — с суффиксом 001."""
    year = datetime.now().year
    result = generate_batch_number()
    assert result == f"ПЕЧ-{year}-001"


@pytest.mark.django_db
def test_second_batch_number_increments():
    """Вторая партия — суффикс 002."""
    year = datetime.now().year
    PrintBatch.objects.create(batch_number=f"ПЕЧ-{year}-001")
    result = generate_batch_number()
    assert result == f"ПЕЧ-{year}-002"


@pytest.mark.django_db
def test_batch_number_ignores_other_years():
    """Партии другого года не влияют на нумерацию текущего."""
    year = datetime.now().year
    PrintBatch.objects.create(batch_number="ПЕЧ-2020-100")
    result = generate_batch_number()
    assert result == f"ПЕЧ-{year}-001"


@pytest.mark.django_db
def test_batch_number_takes_max_of_current_year():
    """После нескольких партий берётся максимальный + 1."""
    year = datetime.now().year
    PrintBatch.objects.create(batch_number=f"ПЕЧ-{year}-001")
    PrintBatch.objects.create(batch_number=f"ПЕЧ-{year}-005")
    PrintBatch.objects.create(batch_number=f"ПЕЧ-{year}-003")
    result = generate_batch_number()
    assert result == f"ПЕЧ-{year}-006"


@pytest.mark.django_db
def test_batch_number_three_digit_format():
    """Суффикс дополняется ведущими нулями до 3 цифр."""
    year = datetime.now().year
    result = generate_batch_number()
    parts = result.split("-")
    assert len(parts) == 3
    assert parts[0] == "ПЕЧ"
    assert parts[1] == str(year)
    assert len(parts[2]) == 3
    assert parts[2].isdigit()