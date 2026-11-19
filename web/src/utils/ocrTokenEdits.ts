/**
 * Инлайн-правка OCR-токенов (6e-2-web-2, fix2).
 * Пользователь исправляет слово прямо на фото — аудит и связи проб
 * пересчитываются по исправленному тексту, а список проб не плодит дублей:
 * правка обновляет свою строку, лишняя (с тем же номером) удаляется.
 * Чистая логика, без UI — покрывается тестами.
 */
import type { OcrWord } from "../api/ocr";
import type { RangeEntry } from "../components/ocr/RangesTable";
import { rangeNumbers } from "./ocrSampleAudit";

/** Канонический вид номера для сравнения: верхний регистр, без пробелов. */
function canon(raw: string): string {
    return (raw ?? "").toUpperCase().replace(/\s+/g, "");
}

export interface WordEdit {
    index: number;
    original: string;
    text: string;
}

/** Что сделать со списком проб после правки токена. */
export type SampleEditPlan =
    | { kind: "none" }
    | { kind: "add" }
    | { kind: "update"; targetId: string; before: RangeEntry }
    | { kind: "remove"; targetId: string; before: RangeEntry };

/** Нормализация ввода правки: только края, внутреннее пользователь решает сам. */
export function cleanEditText(text: string): string {
    return (text ?? "").trim();
}

/** Слова с применёнными правками. Без правок — тот же массив. */
export function applyWordEdits(
    words: OcrWord[],
    edits: Map<number, string>,
): OcrWord[] {
    if (edits.size === 0) return words;
    return words.map((w, i) => {
        const next = edits.get(i);
        if (next === undefined || next === w.text) return w;
        return { ...w, text: next };
    });
}

/** Правки для панели: только реально изменённые слова, по порядку на фото. */
export function collectWordEdits(
    words: OcrWord[],
    edits: Map<number, string>,
): WordEdit[] {
    const out: WordEdit[] = [];
    for (const [index, text] of edits) {
        const original = words[index]?.text;
        if (original === undefined) continue;
        if (original === text) continue;
        out.push({ index, original, text });
    }
    return out.sort((a, b) => a.index - b.index);
}

/** Отмена правки одного слова — копия карты без этого индекса. */
export function withoutEdit(
    edits: Map<number, string>,
    index: number,
): Map<number, string> {
    const next = new Map(edits);
    next.delete(index);
    return next;
}

/** Нормализованные номера пробы из разобранного диапазона. */
export function numbersOf(v: {
    prefix: string;
    middle: string;
    sequenceFrom: number;
    sequenceTo: number;
    sequenceDigits: number;
}): string[] {
    const out: string[] = [];
    for (let i = v.sequenceFrom; i <= v.sequenceTo; i++) {
        out.push(canon(`${v.prefix}${v.middle}${String(i).padStart(v.sequenceDigits, "0")}`));
    }
    return out;
}

/**
 * План правки списка проб.
 * Строка-источник ищется по исходному тексту токена (или по её номерам);
 * preferredId — строка, уже тронутая предыдущей правкой этого же слова.
 * Если исправленный номер целиком покрыт другой строкой — источник лишний.
 */
export function planSampleEdit(
    ranges: RangeEntry[],
    originalText: string,
    numbers: string[],
    preferredId?: string,
): SampleEditPlan {
    const orig = canon(originalText);
    const wanted = numbers.map(canon);
    const target =
        (preferredId ? ranges.find((r) => r.id === preferredId) : undefined) ??
        ranges.find((r) => canon(r.rawInput) === orig) ??
        ranges.find((r) => rangeNumbers(r).some((n) => canon(n) === orig));

    const duplicate = ranges.find((r) => {
        if (target && r.id === target.id) return false;
        if (wanted.length === 0) return false;
        const nums = rangeNumbers(r).map(canon);
        return nums.length > 0 && wanted.every((n) => nums.includes(n));
    });

    if (target && duplicate) return { kind: "remove", targetId: target.id, before: target };
    if (target) return { kind: "update", targetId: target.id, before: target };
    if (duplicate) return { kind: "none" };
    return { kind: "add" };
}