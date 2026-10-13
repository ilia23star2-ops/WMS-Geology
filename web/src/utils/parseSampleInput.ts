/**
 * Парсер строки ввода проб для формы «Заполнить тару пробами».
 *
 * Формат ввода:
 *   <prefix><base>-<range>   — диапазон (range = конец)
 *   <prefix><base>           — одна проба (seq = последние 3 цифры)
 *
 * Примеры:
 *   TAA-A34076001-031 → prefix=TAA-A, middle=34076, seq 001–031, digits=3
 *   TST124001-005    → prefix=TST,   middle=124,   seq 001–005, digits=3
 *   TAA-A34076001    → prefix=TAA-A, middle=34076, seq 001,    digits=3
 *
 * `<prefix>` ищется в двух справочниках:
 *   1) `Laboratory.prefixes` (приоритет)
 *   2) `Site.match_patterns`
 * Побеждает самый длинный совпадающий префикс (регистронезависимо).
 *
 * `wellName`:
 *   - если в форме заполнено входящее Н/З → null (шифрованная проба);
 *   - иначе → middle (нешифрованная, скважина = «середина»).
 */

export interface ParsedSampleRange {
    prefix: string;
    middle: string;
    sequenceFrom: number;
    sequenceTo: number;
    sequenceDigits: number;
    wellName: string | null;
}

export type ParseResult =
    | { ok: true; value: ParsedSampleRange }
    | { ok: false; error: string };

const DEFAULT_DIGITS = 3;
const MAX_RANGE = 1000;

/**
 * Найти самый длинный совпадающий префикс.
 * Сравнение — по началу строки, регистронезависимо.
 */
function detectPrefix(
    input: string,
    candidates: string[],
): string | null {
    const upper = input.toUpperCase();
    let best: string | null = null;
    for (const c of candidates) {
        if (!c) continue;
        if (upper.startsWith(c.toUpperCase())) {
            if (!best || c.length > best.length) best = c;
        }
    }
    return best;
}

function parseNonNegativeInt(s: string): number | null {
    if (!/^\d+$/.test(s)) return null;
    const n = Number(s);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseSampleInput(
    rawInput: string,
    options: {
        laboratoryPrefixes: string[];
        siteMatchPatterns: string[];
        hasIncomingWorkOrder: boolean;
    },
): ParseResult {
    const input = rawInput.trim();
    if (!input) {
        return { ok: false, error: "Введите номер пробы." };
    }

    // 1. Префикс.
    const candidates = [
        ...options.laboratoryPrefixes,
        ...options.siteMatchPatterns,
    ];
    const prefix = detectPrefix(input, candidates);
    if (!prefix) {
        return {
            ok: false,
            error:
                "Префикс не найден в справочниках лабораторий и участков.",
        };
    }

    // 2. Тело после префикса.
    const body = input.slice(prefix.length);
    if (!body) {
        return { ok: false, error: "После префикса нет номера." };
    }

    // 3. Разбить на base + range.
    const parts = body.split("-");
    if (parts.length > 2) {
        return {
            ok: false,
            error: "В номере больше одного дефиса.",
        };
    }

    const base = parts[0];
    if (!base) {
        return { ok: false, error: "Пустое тело номера." };
    }

    let sequenceDigits: number;
    let middle: string;
    let sequenceFrom: number;
    let sequenceTo: number;

    if (parts.length === 2) {
        // Диапазон: <base>-<end>
        const rangeStr = parts[1];
        if (!rangeStr) {
            return { ok: false, error: "Пустой диапазон после дефиса." };
        }
        const end = parseNonNegativeInt(rangeStr);
        if (end === null) {
            return { ok: false, error: "Конец диапазона должен быть числом." };
        }
        sequenceDigits = rangeStr.length;
        if (base.length < sequenceDigits) {
            return { ok: false, error: "Слишком короткое тело номера." };
        }
        middle = base.slice(0, base.length - sequenceDigits);
        const startStr = base.slice(base.length - sequenceDigits);
        const start = parseNonNegativeInt(startStr);
        if (start === null) {
            return { ok: false, error: "Начало диапазона не число." };
        }
        if (start > end) {
            return {
                ok: false,
                error: "Начало диапазона больше конца.",
            };
        }
        sequenceFrom = start;
        sequenceTo = end;
    } else {
        // Одна проба: последние DEFAULT_DIGITS цифр — sequence.
        if (base.length < DEFAULT_DIGITS) {
            return { ok: false, error: "Слишком короткий номер пробы." };
        }
        sequenceDigits = DEFAULT_DIGITS;
        middle = base.slice(0, base.length - sequenceDigits);
        const seqStr = base.slice(base.length - sequenceDigits);
        const seq = parseNonNegativeInt(seqStr);
        if (seq === null) {
            return { ok: false, error: "Порядковый номер не число." };
        }
        sequenceFrom = seq;
        sequenceTo = seq;
    }

    if (!middle) {
        return { ok: false, error: "Пустое значение скважины/серии." };
    }

    const count = sequenceTo - sequenceFrom + 1;
    if (count > MAX_RANGE) {
        return {
            ok: false,
            error: `Слишком большой диапазон (>${MAX_RANGE} проб).`,
        };
    }

    // 4. wellName: вх. Н/З → шифрованная (null), иначе — скважина.
    const wellName = options.hasIncomingWorkOrder ? null : middle;

    return {
        ok: true,
        value: {
            prefix,
            middle,
            sequenceFrom,
            sequenceTo,
            sequenceDigits,
            wellName,
        },
    };
}

/**
 * Предвычислить полные номера проб.
 */
export function buildSampleNumbers(parsed: ParsedSampleRange): string[] {
    const { prefix, middle, sequenceFrom, sequenceTo, sequenceDigits } =
        parsed;
    const result: string[] = [];
    for (let i = sequenceFrom; i <= sequenceTo; i++) {
        const seq = String(i).padStart(sequenceDigits, "0");
        result.push(`${prefix}${middle}${seq}`);
    }
    return result;
}