"""Канонизатор OCR-токенов — единая точка для сервера и клиентов.

Собирает в одном месте правки, которые раньше были размазаны по
mapping.py и веб-хелперам: регистр, гомоглифы кириллица→латиница,
OCR-замены в цифровой части (O→0, I/L→1, T→1 сразу после префикса),
снап префикса к справочнику через расстояние Левенштейна ≤ 1.

Функции чистые (без БД и I/O): их можно гонять в тестах и повторно
использовать при проводке в mapping.py (заход 2) и на клиентах.
"""
from __future__ import annotations

# Гомоглифы и частые OCR-чтения букв (применяются к верхнему регистру).
HOMOGLYPHS = {
    "А": "A", "В": "B", "Е": "E", "К": "K", "М": "M", "Н": "H",
    "О": "O", "Р": "P", "С": "C", "Т": "T", "У": "Y", "Х": "X",
    "З": "S",  # OCR часто читает латинскую S как кириллицу З
    "П": "T",  # П на этикетках регулярно читается как T
    "Ь": "",   # мягкий знак — мусор распознавания
}

# Замены в цифровой части токена.
DIGIT_FIX = {"O": "0", "I": "1", "L": "1", "З": "3", "S": "5", "B": "8"}


def canon_text(raw: str) -> str:
    """Верхний регистр + гомоглифы кириллица→латиница.

    Пример: «ТЗТ» → «TST», «ПтST» → «TTST» (двойной T снимает
    snap_prefix расстоянием Левенштейна ≤ 1).
    """
    out = []
    for ch in raw.strip().upper():
        out.append(HOMOGLYPHS.get(ch, ch))
    return "".join(out)


def _levenshtein(a: str, b: str) -> int:
    """Расстояние Левенштейна, итеративно, без рекурсии."""
    if a == b:
        return 0
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def snap_prefix(prefix: str, valid_prefixes: tuple[str, ...]) -> str:
    """Приближает префикс к справочнику (Левенштейн ≤ 1).

    Без справочника или при расстоянии > 1 возвращает как есть —
    канонизатор не вправе выдумывать префиксы из воздуха.
    """
    if not valid_prefixes or not prefix:
        return prefix
    best, best_d = prefix, 99
    for vp in valid_prefixes:
        d = _levenshtein(prefix, vp)
        if d < best_d:
            best, best_d = vp, d
    return best if best_d <= 1 else prefix


def fix_digits(tail: str, after_prefix: bool) -> str:
    """OCR-замены в цифровой части; T→1 только первым символом после префикса."""
    out = []
    for i, ch in enumerate(tail):
        if after_prefix and i == 0 and ch == "T":
            out.append("1")
        else:
            out.append(DIGIT_FIX.get(ch, ch))
    return "".join(out)