/**
 * Вердикт по инлайн-правке OCR-токена (6e-2-web-2-fix3).
 * Фото — источник правды. Правка человека сравнивается с исходным текстом:
 *   restored   — вернули как было;
 *   confusable — путаница символов OCR (O/0, I/l/1), допустимо;
 *   ocr-fix    — отличие на одну вставку/удаление, похоже на ошибку OCR;
 *   unparsed   — номер не разбирается, проба в список не попала;
 *   divergent  — другая проба (замена цифры, другой номер) — нужно подтвердить.
 * Чистая логика, без UI — покрывается тестами.
 */

export type EditVerdictKind =
    | "restored"
    | "confusable"
    | "ocr-fix"
    | "unparsed"
    | "divergent";

export type EditSeverity = "info" | "warning" | "error";

export interface EditVerdict {
    kind: EditVerdictKind;
    severity: EditSeverity;
    message: string;
    original: string;
    text: string;
}

/** Верхний регистр, без пробелов — для сравнения. */
function canon(raw: string): string {
    return (raw ?? "").toUpperCase().replace(/\s+/g, "");
}

/** Сводим визуально путаемые OCR символы к цифрам. */
function confusables(s: string): string {
    return s.replace(/[OО]/g, "0").replace(/[ILІ]/g, "1");
}

/** Отличие ровно на одну вставку или удаление символа (замена — не считается). */
export function oneEditApart(a: string, b: string): boolean {
    if (Math.abs(a.length - b.length) !== 1) return false;
    const long = a.length > b.length ? a : b;
    const short = a.length > b.length ? b : a;
    let i = 0;
    let j = 0;
    let skipped = false;
    while (i < long.length && j < short.length) {
        if (long[i] === short[j]) {
            i++;
            j++;
        } else if (!skipped) {
            skipped = true;
            i++;
        } else {
            return false;
        }
    }
    return true;
}

/** Расхождение требует явного подтверждения человеком. */
export function needsConfirmation(v: EditVerdict): boolean {
    return v.kind === "divergent";
}

export function classifyEdit(
    original: string,
    text: string,
    parsedOk: boolean,
): EditVerdict {
    const a = canon(original);
    const b = canon(text);
    const base = { original, text };

    if (a === b) {
        return { ...base, kind: "restored", severity: "info", message: "как на фото" };
    }
    if (!parsedOk) {
        return {
            ...base,
            kind: "unparsed",
            severity: "warning",
            message: "номер не разбирается — проба в список не попала, проверь формат",
        };
    }
    if (confusables(a) === confusables(b)) {
        return {
            ...base,
            kind: "confusable",
            severity: "info",
            message: "путаница символов OCR (O/0, I/1) — принято как исправление",
        };
    }
    if (oneEditApart(a, b)) {
        return {
            ...base,
            kind: "ocr-fix",
            severity: "info",
            message: "отличие на один символ — похоже на исправление ошибки OCR",
        };
    }
    return {
        ...base,
        kind: "divergent",
        severity: "error",
        message: `на фото «${original}», в списке «${text}» — это другая проба, подтверди вручную`,
    };
}