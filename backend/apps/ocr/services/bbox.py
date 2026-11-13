"""BBox-утилиты для OCR.

Выделено из ocr_runner.py: тот запускается под портативным python312,
где живёт easyocr. Тесты в backend venv easyocr не имеют, а логику
конвертации bbox проверять надо. Поэтому safe_bbox — отдельный
pure-Python модуль без тяжёлых импортов.
"""


def safe_bbox(bbox):
    """EasyOCR возвращает bbox как numpy-массив — json.dumps его не съест.

    Конвертируем в плоский list[list[int]].
    Координаты округляем до int — на экране пиксели, дробная часть не нужна.
    """
    try:
        return [[int(pt[0]), int(pt[1])] for pt in bbox]
    except (TypeError, IndexError, ValueError):
        return []