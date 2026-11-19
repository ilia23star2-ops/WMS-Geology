"""
Имя пакета OCR (6e-3-backend).

Пакет может быть безымянным («Пакет #24»), но оператору удобнее видеть
осмысленное имя. Автоимя строится из адреса ячейки и даты создания:
«A-01-02-2026-11-19»; если ячейки нет — «OCR 2026-11-19».
Чистая функция — покрыта тестами, вызывается из views.
"""
from datetime import date


def make_batch_name(cell_address: str | None, when: date | None = None) -> str:
    """Автоимя пакета: адрес ячейки + дата, либо OCR + дата."""
    day = when or date.today()
    stamp = day.isoformat()
    addr = (cell_address or "").strip()
    return f"{addr} {stamp}" if addr else f"OCR {stamp}"


def display_name(name: str | None, batch_id: int | None) -> str:
    """Человекочитаемое имя для списков: имя или «Пакет #id»."""
    clean = (name or "").strip()
    if clean:
        return clean
    return f"Пакет #{batch_id}" if batch_id is not None else "Пакет"