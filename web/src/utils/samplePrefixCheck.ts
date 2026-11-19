/**
 * Правило префикса пробы (6e-2-web-6-c): префикс — только буквы, и он обязан
 * быть из справочника (коды участков, match_patterns, префиксы лабораторий).
 * TSTT234501 → префикс TSTT, которого нет → это не «другая скважина»,
 * а почти наверняка ошибка OCR (лишняя/подменённая буква).
 * Чистая логика, без UI — покрыта тестами.
 */

export interface PrefixIssue {
    number: string;
    rangeId: string;
    prefix: string;
    reason: "unknown-prefix" | "no-prefix";
    message: string;
}

export interface NumberRef {
    number: string;
    rangeId: string;
}

/** Сравнительный вид: регистр вверх, пробелы и точки долой (дефисы важны). */
function canon(raw: string): string {
    return (raw ?? "").toUpperCase().replace(/[\s.]/g, "");
}

/** Ведущая буквенная часть номера — префикс по правилу «только буквы». */
export function leadingLetters(raw: string): string {
    const m = canon(raw).match(/^[A-ZА-Я]+/);
    return m ? m[0] : "";
}

/** Хвост номера после префикса. */
export function sampleTail(raw: string): string {
    const c = canon(raw);
    return c.slice(leadingLetters(c).length);
}

/** Префикс есть в справочнике (точное совпадение, регистр не важен). */
export function isKnownPrefix(prefix: string, validPrefixes: string[]): boolean {
    const p = canon(prefix);
    if (!p) return false;
    return (validPrefixes ?? []).some((v) => canon(v) === p);
}

/**
 * Проблемы префиксов в списке проб. Без справочника проверять нечем — [].
 * Порядок сохраняется, дубли по номеру внутри одной строки не плодятся.
 */
export function checkPrefixes(
    numbers: NumberRef[],
    validPrefixes: string[],
): PrefixIssue[] {
    if (!validPrefixes || validPrefixes.length === 0) return [];
    const out: PrefixIssue[] = [];
    const seen = new Set<string>();
    for (const ref of numbers ?? []) {
        const c = canon(ref.number);
        if (!c) continue;
        const key = `${ref.rangeId}|${c}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const prefix = leadingLetters(c);
        if (!prefix) {
            out.push({
                number: ref.number,
                rangeId: ref.rangeId,
                prefix: "",
                reason: "no-prefix",
                message: `«${ref.number}» без буквенного префикса — проба должна начинаться с кода участка или лаборатории.`,
            });
            continue;
        }
        if (isKnownPrefix(prefix, validPrefixes)) continue;
        out.push({
            number: ref.number,
            rangeId: ref.rangeId,
            prefix,
            reason: "unknown-prefix",
            message: `Префикс «${prefix}» не из справочника — вероятно OCR склеил лишнюю букву. Проверь номер на фото.`,
        });
    }
    return out;
}