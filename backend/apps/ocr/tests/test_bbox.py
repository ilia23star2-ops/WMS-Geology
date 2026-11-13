"""Тесты утилиты safe_bbox."""
import json

from apps.ocr.services.bbox import safe_bbox


def test_safe_bbox_plain_ints():
    assert safe_bbox([[1, 2], [3, 4]]) == [[1, 2], [3, 4]]


def test_safe_bbox_floats_become_ints():
    assert safe_bbox([[1.7, 2.2], [3.9, 4.1]]) == [[1, 2], [3, 4]]


def test_safe_bbox_empty():
    assert safe_bbox([]) == []


def test_safe_bbox_none_returns_empty():
    assert safe_bbox(None) == []


def test_safe_bbox_malformed_returns_empty():
    # bbox не итерируется по точкам — уходим в except
    assert safe_bbox([1, 2, 3]) == []


def test_safe_bbox_handles_none_point():
    # Одна из точек None — TypeError, ловим, возвращаем []
    assert safe_bbox([None, [1, 2]]) == []


def test_safe_bbox_result_is_json_serializable():
    """Ключевая регрессия: результат должен проходить json.dumps без TypeError.

    Именно на этом падал ocr_runner до фикса (numpy.int32 в bbox).
    """
    result = safe_bbox([[1, 2], [3, 4]])
    json.dumps(result)  # не должно бросить