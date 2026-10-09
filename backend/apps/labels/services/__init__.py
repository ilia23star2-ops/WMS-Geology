"""Сервисы приложения labels."""

from .qr_service import generate_qr_png, generate_qr_svg, make_payload

__all__ = [
    "generate_qr_png",
    "generate_qr_svg",
    "make_payload",
]