/**
 * Аудит проб OCR (6e-2-web-fix…fix4): фото vs список.
 *
 * fix2: нормализация (пробелы буква↔цифра, O/I/L в хвосте, путаница сразу
 *   после валидного префикса), склейка слов строки, ранжирование кандидатов.
 * fix3: статус слова — covered / anomaly / missing.
 * fix4: missing считается ТОЙ ЖЕ терпимой сверкой, что и подсветка
 *   (исправленный номер больше не попадает в «нет в списке»);
 *   linkSampleWords — связь «слово фото ↔ строка списка» (мини-зоны проб).
 * Чистая логика, без UI — покрывается тестами.
 */
import type { OcrWord } from "../api/ocr";

export interface AuditRange {
    id: string;
    prefix: string;
    middle: string;
    sequenceFrom: number;
    sequenceTo: number;
    sequenceDigits: number;
    skippedSeqs: number[];
}

export interface SampleAudit {
    photoSamples: string[];
    missing: string[];
    anomalyIds: string[];
    dominantBase: string | null;
}

export type SampleWordStatus = "covered" | "anomaly" | "missing";

export interface SampleWordLink {
    /** Индекс слова в raw_ocr_data.words. */
    index: number;
    /** Нормализованный номер пробы. */
    number: string;
    /** Строка списка, которой соответствует слово (null — не внесена). */
    rangeId: string | null;
    status: SampleWordStatus;
    bbox: number[][];
    text: string;
}

const TOKEN_RE = /[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?-?[0-9OILlTt]{5,}/gi;
const REAL_DIGIT_RE = /[0-9]/g;
const LETTER_HEAD_RE = /^[A-ZА-ЯЁ]+(?:-[A-ZА-ЯЁ])?/;
const SAMPLE_SHAPE_RE = /^[A-ZА-ЯЁ]{2,}(?:-[A-ZА-ЯЁ])?[0-9]{5,}$/;

const CONFUSION: Record<string, string> = {
    T: "1", I: "1", L: "1", O: "0", І: "1", О: "0",
};

/**
 * Нормализация токена.
 * `validPrefixes` — известные префиксы (site.code, match_patterns, lab.prefixes).
 * Без них коррекция на стыке не делается — обычный TST1234510 не ломается.
 */
export function normalizeToken(
    raw: string,
    validPrefixes: string[] = [],
): string {
    let s = (raw ?? "").toUpperCase().replace(/\s+/g, "");
    const prefixes = [...validPrefixes]
        .map((p) => p.toUpperCase())
        .sort((a, b) => b.length - a.length);
    for (const p of prefixes) {
        if (p.length < 2 || !s.startsWith(p) || s.length <= p.length + 1) continue;
        const mapped = CONFUSION[s[p.length]];
        if (mapped && /[0-9]/.test(s[p.length + 1])) {
            s = s.slice(0, p.length) + mapped + s.slice(p.length + 1);
            break;
        }
    }
    const m = s.match(LETTER_HEAD_RE);
    if (m) {
        const head = m[0];
        const tail = s
            .slice(head.length)
            .replace(/[OО]/g, "0")
            .replace(/[ILІ]/g, "1");
        s = head + tail;
    }
    return s;
}

function isSampleLike(rawToken: string, prefixes: string[]): string | null {
    if ((rawToken.match(REAL_DIGIT_RE) ?? []).length < 3) return null;
    const n = normalizeToken(rawToken, prefixes);
    if (!SAMPLE_SHAPE_RE.test(n)) return null;
    return n;
}

function centerY(w: OcrWord): number {
    const ys = (w.bbox ?? []).map((p) => p[1]);
    return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : 0;
}

function minX(w: OcrWord): number {
    const xs = (w.bbox ?? []).map((p) => p[0]);
    return xs.length ? Math.min(...xs) : 0;
}

/** Кандидаты в пробы: по каждому слову и по склейке слов одной строки. */
export function collectPhotoTokens(
    words: OcrWord[],
    validPrefixes: string[] = [],
): string[] {
    const out = new Set<string>();
    const push = (text: string) => {
        const compact = (text ?? "").replace(/(?<=[A-ZА-ЯЁ])\s+(?=[0-9])/gi, "");
        const matches = compact.match(TOKEN_RE);
        if (!matches) return;
        for (const m of matches) {
            const ok = isSampleLike(m, validPrefixes);
            if (ok) out.add(ok);
        }
    };

    for (const w of words ?? []) push(w.text ?? "");

    const sorted = [...(words ?? [])].sort(
        (a, b) => centerY(a) - centerY(b) || minX(a) - minX(b),
    );
    let line: OcrWord[] = [];
    const flush = () => {
        if (line.length > 1) {
            push(
                [...line]
                    .sort((a, b) => minX(a) - minX(b))
                    .map((w) => w.text ?? "")
                    .join(" "),
            );
        }
        line = [];
    };
    for (const w of sorted) {
        if (line.length === 0) {
            line = [w];
            continue;
        }
        const prev = line[line.length - 1];
        const h = Math.max(
            8,
            Math.max(...prev.bbox.map((p) => p[1])) -
            Math.min(...prev.bbox.map((p) => p[1])),
        );
        if (Math.abs(centerY(w) - centerY(prev)) <= h * 0.6) line.push(w);
        else {
            flush();
            line = [w];
        }
    }
    flush();

    return Array.from(out).sort();
}

/** Номера проб диапазона с учётом пропущенных. */
export function rangeNumbers(r: AuditRange): string[] {
    const skipped = new Set(r.skippedSeqs ?? []);
    const out: string[] = [];
    for (let i = r.sequenceFrom; i <= r.sequenceTo; i++) {
        if (skipped.has(i)) continue;
        out.push(
            `${r.prefix}${r.middle}${String(i).padStart(r.sequenceDigits, "0")}`,
        );
    }
    return out;
}

/** Множество номеров текущего списка (нормализованных). */
export function rangeNumberSet(ranges: AuditRange[]): Set<string> {
    const set = new Set<string>();
    for (const r of ranges) {
        for (const n of rangeNumbers(r)) set.add(normalizeToken(n));
    }
    return set;
}

/** Номера диапазонов, помеченных как аномальные. */
export function anomalyNumberSet(
    ranges: AuditRange[],
    anomalyIds: string[],
): Set<string> {
    const ids = new Set(anomalyIds);
    const out = new Set<string>();
    for (const r of ranges) {
        if (!ids.has(r.id)) continue;
        for (const n of rangeNumbers(r)) out.add(normalizeToken(n));
    }
    return out;
}

/** Отличие ровно на одну вставку/удаление (не замену). */
function oneEditApart(a: string, b: string): boolean {
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
        } else if (skipped) {
            return false;
        } else {
            skipped = true;
            i++;
        }
    }
    return true;
}

/**
 * Связь слова фото со списком: точное совпадение или одна вставка/удаление
 * (TST11234506 ↔ TST1234506). Соседние номера (замена цифры) НЕ связываются.
 */
export function matchesSampleNumber(
    text: string,
    numbers: Set<string>,
    validPrefixes: string[] = [],
): boolean {
    const n = normalizeToken(text, validPrefixes);
    if (!n) return false;
    if (numbers.has(n)) return true;
    for (const num of numbers) {
        if (oneEditApart(n, num)) return true;
    }
    return false;
}

/** Статус слова-пробы для окраски на фото. */
export function sampleWordStatus(
    text: string,
    numbers: Set<string>,
    anomalyNumbers: Set<string>,
    validPrefixes: string[] = [],
): SampleWordStatus | null {
    const n = normalizeToken(text, validPrefixes);
    if (!n || !SAMPLE_SHAPE_RE.test(n)) return null;
    if (anomalyNumbers.has(n)) return "anomaly";
    for (const num of anomalyNumbers) {
        if (oneEditApart(n, num)) return "anomaly";
    }
    if (numbers.has(n)) return "covered";
    for (const num of numbers) {
        if (oneEditApart(n, num)) return "covered";
    }
    return "missing";
}

/**
 * fix4: мини-зоны проб — каждое слово-проба связано со строкой списка.
 * Аномальные диапазоны проверяются первыми, чтобы неисправленный номер
 * не «прилипал» к нормальной строке.
 */
export function linkSampleWords(
    words: OcrWord[],
    ranges: AuditRange[],
    anomalyIds: string[],
    validPrefixes: string[] = [],
): SampleWordLink[] {
    const anomalySet = new Set(anomalyIds);
    const prepared = ranges.map((r) => ({
        id: r.id,
        anomaly: anomalySet.has(r.id),
        nums: rangeNumbers(r).map((n) => normalizeToken(n)),
    }));
    const out: SampleWordLink[] = [];

    (words ?? []).forEach((w, index) => {
        const n = normalizeToken(w.text ?? "", validPrefixes);
        if (!n || !SAMPLE_SHAPE_RE.test(n)) return;

        let rangeId: string | null = null;
        let status: SampleWordStatus = "missing";

        for (const r of prepared) {
            if (!r.anomaly) continue;
            if (r.nums.includes(n) || r.nums.some((x) => oneEditApart(n, x))) {
                rangeId = r.id;
                status = "anomaly";
                break;
            }
        }
        if (rangeId === null) {
            for (const r of prepared) {
                if (r.anomaly) continue;
                if (r.nums.includes(n) || r.nums.some((x) => oneEditApart(n, x))) {
                    rangeId = r.id;
                    status = "covered";
                    break;
                }
            }
        }

        out.push({
            index,
            number: n,
            rangeId,
            status,
            bbox: w.bbox,
            text: w.text ?? "",
        });
    });

    return out;
}

function similarity(
    candidate: string,
    dominantBase: string | null,
    prefixes: string[],
): number {
    if (!dominantBase) return 0;
    const base = normalizeToken(dominantBase, prefixes);
    const letters = (s: string) => (s.match(/^[A-ZА-ЯЁ]+/) ?? [""])[0];
    const digits = (s: string) => (s.match(/[0-9]+$/) ?? [""])[0];
    let score = letters(candidate) === letters(base) ? 100 : 0;
    const a = digits(candidate);
    const b = digits(base);
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    return score + i * 10;
}

/** Сверить фото со списком диапазонов. */
export function auditSamples(
    words: OcrWord[],
    ranges: AuditRange[],
    validPrefixes: string[] = [],
): SampleAudit {
    const photoSamples = collectPhotoTokens(words, validPrefixes);
    const covered = rangeNumberSet(ranges);
    const baseCount = new Map<string, number>();

    for (const r of ranges) {
        const base = `${r.prefix}${r.middle}`;
        baseCount.set(base, (baseCount.get(base) ?? 0) + 1);
    }

    let dominantBase: string | null = null;
    let best = 0;
    for (const [base, count] of baseCount) {
        if (count > best) {
            best = count;
            dominantBase = base;
        }
    }

    const anomalyIds =
        baseCount.size > 1
            ? ranges
                .filter((r) => `${r.prefix}${r.middle}` !== dominantBase)
                .map((r) => r.id)
            : [];

    // fix4: та же терпимая сверка, что и при подсветке — исправленный
    // номер не считается «отсутствующим в списке».
    const missing = photoSamples
        .filter((p) => !matchesSampleNumber(p, covered, validPrefixes))
        .sort(
            (a, b) =>
                similarity(b, dominantBase, validPrefixes) -
                similarity(a, dominantBase, validPrefixes) || a.localeCompare(b),
        );

    return { photoSamples, missing, anomalyIds, dominantBase };
}