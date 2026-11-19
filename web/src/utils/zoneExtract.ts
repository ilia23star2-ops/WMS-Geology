/**
 * Извлечение полей из зон (6e-2-web-5, +тип тары 5-d).
 * Слова OCR, чей центр попал в зону, склеиваются в текст зоны, из текста
 * берётся значение по смыслу типа зоны. Номер тары умеет разбирать
 * сокращение типа («Ящ.1», «Я1», «ящ 1», «1 ящ») — тип и номер отдельно.
 * Чистая логика, без UI — покрыта тестами.
 */
import type { OcrWord, OcrZone } from "../api/ocr";

export interface ZoneWord {
    index: number;
    text: string;
    x: number;
    y: number;
}

export interface ZoneExtracted {
    work_order_coded: string | null;
    work_order_incoming: string | null;
    container_number: string | null;
    /** Имя типа тары из справочника, если сокращение удалось сопоставить. */
    container_type: string | null;
    research_type: string | null;
    site: string | null;
    samples: string[];
}

export interface ContainerLabel {
    containerType: string | null;
    containerNumber: string | null;
}

export type ScalarKind = "number" | "order" | "code" | "text";

function centerOf(bbox: number[][]): { x: number; y: number } | null {
    if (!bbox?.length) return null;
    const xs = bbox.map((p) => p[0]);
    const ys = bbox.map((p) => p[1]);
    return {
        x: xs.reduce((s, v) => s + v, 0) / xs.length,
        y: ys.reduce((s, v) => s + v, 0) / ys.length,
    };
}

/** Слова, центр которых лежит внутри зоны. */
export function wordsInZone(words: OcrWord[], bbox: number[][]): ZoneWord[] {
    if (!bbox?.length || bbox.length < 3) return [];
    const xs = bbox.map((p) => p[0]);
    const ys = bbox.map((p) => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const out: ZoneWord[] = [];
    words.forEach((w, index) => {
        const c = centerOf(w.bbox);
        if (!c) return;
        if (c.x >= minX && c.x <= maxX && c.y >= minY && c.y <= maxY) {
            out.push({ index, text: w.text, x: c.x, y: c.y });
        }
    });
    return out;
}

/** Текст зоны: строки сверху вниз, внутри строки — слева направо. */
export function joinZoneText(items: ZoneWord[], rowTolerance = 10): string {
    const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: ZoneWord[][] = [];
    for (const it of sorted) {
        const row = rows.find((r) => Math.abs(r[0].y - it.y) <= rowTolerance);
        if (row) row.push(it);
        else rows.push([it]);
    }
    return rows
        .map((r) => [...r].sort((a, b) => a.x - b.x).map((w) => w.text.trim()).join(" "))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
}

/** Нормализация номера пробы: регистр, пробелы, O/0 и I/l/1 в цифровом хвосте. */
export function normalizeSampleToken(raw: string): string {
    const t = (raw ?? "").toUpperCase().replace(/\s+/g, "");
    const m = t.match(/^([A-ZА-Я]{2,6}(?:-[A-ZА-Я])?-?)(\d[A-Z0-9]*)$/);
    if (!m) return t;
    const tail = m[2].replace(/[OО]/g, "0").replace(/[ILІ]/g, "1");
    return m[1] + tail;
}

/** Похоже ли на номер пробы (буквенный префикс и не меньше 4 цифр). */
export function looksLikeSample(raw: string): boolean {
    const t = normalizeSampleToken(raw);
    return /^[A-ZА-Я]{2,6}-?[A-ZА-Я]?-?\d[\d-]{3,}$/.test(t);
}

/** Значение из текста зоны по смыслу типа зоны. */
export function pickScalar(text: string, kind: ScalarKind): string | null {
    const tokens = (text ?? "").split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return null;
    if (kind === "text") return text.trim() || null;
    if (kind === "number") {
        const pure = tokens.find((t) => /^\d{1,6}$/.test(t));
        if (pure) return pure;
        const dirty = tokens.find((t) => /\d/.test(t));
        if (!dirty) return null;
        const digits = dirty.replace(/[^\d]/g, "");
        return digits || null;
    }
    if (kind === "order") {
        return tokens.find((t) => /^[A-ZА-Я]{2,5}-?\d{2,8}$/.test(t.toUpperCase())) ?? null;
    }
    return tokens.find((t) => /^[A-ZА-Я]{2,6}$/.test(t.toUpperCase())) ?? null;
}

function upper(s: string): string {
    return (s ?? "").toUpperCase().replace(/Ё/g, "Е").trim();
}

/**
 * Сокращения имени типа тары: само имя и префиксы 1..4 буквы каждого слова.
 * «Ящик» → Я, ЯЩ, ЯЩИ, ЯЩИК; «Коробка» → К, КО, КОр… — справочник решает.
 */
export function containerAliases(name: string): string[] {
    const n = upper(name);
    const out = new Set<string>();
    if (!n) return [];
    out.add(n);
    for (const w of n.split(/[\s\-–—]+/).filter(Boolean)) {
        for (let len = 1; len <= Math.min(4, w.length); len++) out.add(w.slice(0, len));
    }
    return [...out];
}

/** Сопоставление сокращения с именем типа; неоднозначное — не угадываем. */
function matchContainerType(token: string, containerTypes: string[]): string | null {
    const hits = containerTypes.filter((n) => containerAliases(n).includes(token));
    if (hits.length === 1) return hits[0];
    if (hits.length > 1) return hits.find((n) => upper(n) === token) ?? null;
    return null;
}

/**
 * Разбор подписи тары: «1», «№ 1», «Ящ.1», «Я1», «ящ 1», «ящ,1»,
 * «ЯЩ-1», «Ящик № 1», «1 ящ». Разделители любые из . , - – — пробел №.
 */
export function parseContainerLabel(
    raw: string,
    containerTypes: string[] = [],
): ContainerLabel {
    const t = upper(raw);
    if (!t) return { containerType: null, containerNumber: null };

    const typeFirst = t.match(/^([A-ZА-Я]{1,10})[\s.,\-–—№:]*(\d{1,6})$/);
    if (typeFirst) {
        return {
            containerType: matchContainerType(typeFirst[1], containerTypes),
            containerNumber: typeFirst[2],
        };
    }
    const numberFirst = t.match(/^(\d{1,6})[\s.,\-–—]*([A-ZА-Я]{1,10})$/);
    if (numberFirst) {
        return {
            containerType: matchContainerType(numberFirst[2], containerTypes),
            containerNumber: numberFirst[1],
        };
    }
    const pure = t.match(/^[№N]?[\s.,\-–—:]*(\d{1,6})$/);
    if (pure) return { containerType: null, containerNumber: pure[1] };

    return { containerType: null, containerNumber: null };
}

/** Пустой результат — когда зон нет или в них нет слов. */
export function emptyExtracted(): ZoneExtracted {
    return {
        work_order_coded: null,
        work_order_incoming: null,
        container_number: null,
        container_type: null,
        research_type: null,
        site: null,
        samples: [],
    };
}

/** Значения полей из зон и слов OCR. containerTypes — имена из справочника. */
export function extractFromZones(
    words: OcrWord[],
    zones: OcrZone[],
    containerTypes: string[] = [],
): ZoneExtracted {
    const out = emptyExtracted();
    const seen = new Set<string>();
    for (const z of zones ?? []) {
        const text = joinZoneText(wordsInZone(words, z.bbox));
        if (!text) continue;
        switch (z.type) {
            case "work_order_coded":
                out.work_order_coded = pickScalar(text, "order") ?? out.work_order_coded;
                break;
            case "work_order_incoming":
                out.work_order_incoming = pickScalar(text, "order") ?? out.work_order_incoming;
                break;
            case "container_number": {
                const label = parseContainerLabel(text, containerTypes);
                out.container_number =
                    label.containerNumber ?? pickScalar(text, "number") ?? out.container_number;
                if (label.containerType) out.container_type = label.containerType;
                break;
            }
            case "research_type":
                out.research_type = pickScalar(text, "code") ?? out.research_type;
                break;
            case "site":
                out.site = pickScalar(text, "text") ?? out.site;
                break;
            case "sample":
                for (const token of text.split(/\s+/)) {
                    if (!looksLikeSample(token)) continue;
                    const norm = normalizeSampleToken(token);
                    if (seen.has(norm)) continue;
                    seen.add(norm);
                    out.samples.push(norm);
                }
                break;
            default:
                break;
        }
    }
    return out;
}