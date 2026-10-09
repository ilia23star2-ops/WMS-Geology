"""
Генерация QR-кодов для этикеток.

QR содержит payload по правилам:
- Container  → "WMSG:CONTAINER:<id>"
- Cell       → "WMSG:CELL:<id>"
- Section    → "WMSG:SECTION:<id>"
- Sample     → "WMSG:SAMPLE:<id>"

Форматы вывода:
- PNG (BytesIO)
- SVG (str)
"""

from io import BytesIO

import qrcode
from qrcode.image.svg import SvgPathImage


QR_PREFIX = "WMSG"


def make_payload(entity_type: str, entity_id: int) -> str:
    """
    Формирует payload QR.

    :param entity_type: CONTAINER / CELL / SECTION / SAMPLE.
    :param entity_id: ID сущности.
    :returns: "WMSG:<TYPE>:<ID>".
    """
    if not entity_type:
        raise ValueError("entity_type не может быть пустым")
    if not isinstance(entity_id, int) or entity_id <= 0:
        raise ValueError("entity_id должен быть положительным целым")
    return f"{QR_PREFIX}:{entity_type.upper()}:{entity_id}"


def generate_qr_png(payload: str, box_size: int = 10, border: int = 2) -> BytesIO:
    """
    Генерирует QR-код в PNG.

    :param payload: содержимое QR.
    :param box_size: размер одного «квадратика» в пикселях.
    :param border: ширина рамки в «квадратиках».
    :returns: BytesIO с PNG-изображением (указатель в начале).
    """
    if not payload:
        raise ValueError("payload не может быть пустым")

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buf = BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def generate_qr_svg(payload: str, box_size: int = 10, border: int = 2) -> str:
    """
    Генерирует QR-код в SVG (как строку).

    :returns: содержимое SVG-файла.
    """
    if not payload:
        raise ValueError("payload не может быть пустым")

    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=box_size,
        border=border,
        image_factory=SvgPathImage,
    )
    qr.add_data(payload)
    qr.make(fit=True)

    img = qr.make_image()
    buf = BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")