/**
 * Подсказки «похоже на ошибку OCR» (6e-2-web-6, +поиск слова 6-d).
 * Случай: с фото пропала TST1234501, а в списке есть TSTT234501 — это та же
 * проба, испорченная распознаванием (T вместо 1). Аномалия такое не ловит:
 * номер уехал в другую скважину, а там сравнивать не с чем.
 * Модуль сопоставляет номера по OCR-путанице символов и правке в один символ
 * и находит слово на фото, которому соответствует номер строки.
 * Чистая логика, без UI — покрыта тестами.
 */

export interface SimilarCandidate {
    number: string;
    rangeId: string;
}

export interface SampleHint {
    /** Номер с фото, которого нет в списке. */
    missing: string;
    /** Похожий номер из списка. */
    candidate: string;
    rangeId: string;
    kind: "confusable" | "one-edit";
    message: string;
}

/** Сравнительный вид номера: регистр, пробелы, точки и дефисы долой. */
export function canonNumber(raw: string): string {
    return (raw ?? "").toUpperCase().replace(/[\s.\-–—]/g, "");
}

/** Классы символов, которые OCR путает между собой. */
const CONFUSABLE_CLASSES = ["0OО", "1ILТTІ|", "3З", "5S", "6Б", "8B"];

function charsEqual(a: string, b: string): boolean {
    if (a === b) return true;
    return CONFUSABLE_CLASSES.some((cls) => cls.includes(a) && cls.includes(b));
}

/** Одинаковая длина и все символы совпадают с поправкой на путаницу OCR. */
export function confusableEqual(a: string, b: string): boolean {
    const x = canonNumber(a);
    const y = canonNumber(b);
    if (x.length === 0 || x.length !== y.length) return false;
    for (let i = 0; i < x.length; i++) {
        if (!charsEqual(x[i], y[i])) return false;
    }
    return true;
}

/** Отличие ровно в один символ: вставка, удаление или замена. */
export function oneEditApart(a: string, b: string): boolean {
    const x = canonNumber(a);
    const y = canonNumber(b);
    if (x === y) return false;
    if (Math.abs(x.length - y.length) > 1) return false;
    if (x.length === y.length) {
        let diff = 0;
        for (let i = 0; i < x.length; i++) {
            if (x[i] !== y[i]) diff++;
        }
        return diff === 1;
    }
    const long = x.length > y.length ? x : y;
    const short = x.length > y.length ? y : x;
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

/**
 * Индекс слова фото, которому соответствует номер строки.
 * Приоритет: точное совпадение → путаница символов OCR → один символ →
 * совпадение цифрового хвоста. Не найдено — -1.
 */
export function bestWordMatch(number: string, texts: string[]): number {
    const target = canonNumber(number);
    if (!target || !texts || texts.length === 0) return -1;
    const canon = texts.map(canonNumber);
    const exact = canon.findIndex((t) => t === target);
    if (exact >= 0) return exact;
    const conf = canon.findIndex((t) => t.length > 0 && confusableEqual(target, t));
    if (conf >= 0) return conf;
    const edit = canon.findIndex((t) => t.length > 0 && oneEditApart(target, t));
    if (edit >= 0) return edit;
    const tail = target.replace(/^[A-ZА-Я]+/, "");
    if (tail.length >= 4) {
        const byTail = canon.findIndex((t) => t.length > 0 && t.endsWith(tail));
        if (byTail >= 0) return byTail;
    }
    return -1;
}

/**
 * Для каждого недостающего номера — лучший похожий номер из списка.
 * Путаница символов приоритетнее правки в один символ; точные совпадения
 * пропускаются (они не «недостающие»).
 */
export function findSimilarHints(
    missing: string[],
    candidates: SimilarCandidate[],
): SampleHint[] {
    const out: SampleHint[] = [];
    for (const m of missing ?? []) {
        const cm = canonNumber(m);
        if (!cm) continue;
        let best: SampleHint | null = null;
        for (const c of candidates ?? []) {
            const cc = canonNumber(c.number);
            if (!cc || cc === cm) continue;
            let kind: SampleHint["kind"] | null = null;
            if (confusableEqual(cm, cc)) kind = "confusable";
            else if (oneEditApart(cm, cc)) kind = "one-edit";
            if (!kind) continue;
            const hint: SampleHint = {
                missing: m,
                candidate: c.number,
                rangeId: c.rangeId,
                kind,
                message:
                    `«${c.number}» похожа на «${m}» с фото — вероятно ошибка OCR. ` +
                    "Исправь номер в этой строке: проба найдётся, лишняя исчезнет.",
            };
            if (!best || (best.kind === "one-edit" && kind === "confusable")) best = hint;
        }
        if (best) out.push(best);
    }
    return out;
}