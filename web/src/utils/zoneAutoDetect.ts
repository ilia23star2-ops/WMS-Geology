/**
 * Авто-определение зон по словам OCR (6e-2-web-5-c, справочники 5-d, fix).
 * Метки этикетки приоритетнее; недостающее добирается контекстом:
 * значение из справочника (ICP — тип исследования, имя участка в строке)
 * или формат (Н/З, номер тары числом либо сокращением «Ящ.1»).
 * Каждое слово занимает одна зона — иначе дубли зон сдвигали разметку
 * каскадом и зона уезжала со своего текста.
 * Чистая логика, без UI — покрыта тестами.
 */
import type { OcrWord, OcrZone, OcrZoneType } from "../api/ocr";
import { looksLikeSample, parseContainerLabel } from "./zoneExtract";
import {
    bboxToRect,
    clampRect,
    rectToBbox,
    type Rect,
    type Size,
} from "./zoneDraw";

export interface DetectContext {
    researchTypes?: { code: string; name: string }[];
    containerTypes?: string[];
    sites?: { code: string; name: string; match_patterns?: string[] }[];
    workOrders?: string[];
}

export interface AutoDetectResult {
    zones: OcrZone[];
    found: OcrZoneType[];
    missing: OcrZoneType[];
    sampleCount: number;
}

const WANTED: OcrZoneType[] = [
    "site",
    "work_order_coded",
    "container_number",
    "research_type",
    "sample",
];

const MIN_CONFIDENCE = 0.2;
const PAD = 4;

interface Item {
    id: number;
    text: string;
    norm: string;
    rect: Rect;
    cx: number;
    cy: number;
}

function normText(t: string): string {
    return (t ?? "").toUpperCase().replace(/\s+/g, "").replace(/[:.]+$/g, "");
}

/** Тип зоны по тексту метки; null — это не метка. */
export function labelKind(norm: string, raw?: string): OcrZoneType | null {
    if (!norm) return null;
    const marked = raw !== undefined && raw.trim().endsWith(":");
    if (norm.includes("ВХОД")) return "work_order_incoming";
    if (/^УЧ/.test(norm) && (marked || norm.length <= 3)) return "site";
    if (/^Н\/?З/.test(norm) || /^ЗАКАЗ/.test(norm)) return "work_order_coded";
    if ((/^ИСП/.test(norm) && (marked || norm.length <= 5)) || (/^ТИП/.test(norm) && (marked || norm.length <= 4))) return "research_type";
    if (/^№/.test(norm) || /^НОМЕР/.test(norm) || norm === "N") return "container_number";
    return null;
}

/** Номер пробы, а не Н/З: формат пробы плюс не меньше 6 цифр. */
export function isSampleToken(raw: string): boolean {
    if (!looksLikeSample(raw)) return false;
    return ((raw ?? "").match(/\d/g) ?? []).length >= 6;
}

/** Н/З по формату: буквы + 2..5 цифр (у пробы цифр больше). */
function isWorkOrderToken(raw: string): boolean {
    if (isSampleToken(raw)) return false;
    return /^[A-ZА-Я]{2,5}-?\d{2,5}$/.test(normText(raw));
}

function sameRow(a: Item, b: Item): boolean {
    return Math.abs(a.cy - b.cy) <= Math.max(a.rect.h, b.rect.h) * 0.6;
}

function unionRect(items: Item[]): Rect {
    const x = Math.min(...items.map((i) => i.rect.x));
    const y = Math.min(...items.map((i) => i.rect.y));
    const right = Math.max(...items.map((i) => i.rect.x + i.rect.w));
    const bottom = Math.max(...items.map((i) => i.rect.y + i.rect.h));
    return { x, y, w: right - x, h: bottom - y };
}

function padRect(r: Rect, pad: number): Rect {
    return { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 };
}

function valuesFor(label: Item, items: Item[], medianW: number): Item[] {
    const candidates = items
        .filter(
            (i) => i.id !== label.id && i.cx > label.rect.x + label.rect.w * 0.8 && sameRow(label, i),
        )
        .sort((a, b) => a.cx - b.cx);
    const out: Item[] = [];
    let prevRight = label.rect.x + label.rect.w;
    for (const c of candidates) {
        if (labelKind(c.norm, c.text)) break;
        if (c.rect.x - prevRight > medianW * 3) break;
        out.push(c);
        prevRight = c.rect.x + c.rect.w;
    }
    return out;
}

function clusterColumns(items: Item[], tolerance: number): Item[][] {
    const sorted = [...items].sort((a, b) => a.cx - b.cx);
    const groups: Item[][] = [];
    for (const it of sorted) {
        const g = groups.find((gr) => Math.abs(gr[0].cx - it.cx) <= tolerance);
        if (g) g.push(it);
        else groups.push([it]);
    }
    return groups;
}

function rowsOf(items: Item[]): Item[][] {
    const sorted = [...items].sort((a, b) => a.cy - b.cy || a.cx - b.cx);
    const rows: Item[][] = [];
    for (const it of sorted) {
        const row = rows.find((r) => sameRow(r[0], it));
        if (row) row.push(it);
        else rows.push([it]);
    }
    return rows;
}

/** Сравнительный вид: регистр, ё, пробелы и разделители долой. */
function sq(s: string): string {
    return (s ?? "").toUpperCase().replace(/Ё/g, "Е").replace(/[\s.,\-–—]/g, "");
}

/** Черновик разметки по словам OCR и справочникам. */
export function detectZones(
    words: OcrWord[],
    dims?: Size,
    ctx: DetectContext = {},
): AutoDetectResult {
    const items: Item[] = [];
    (words ?? []).forEach((w, id) => {
        const text = (w.text ?? "").trim();
        if (!text) return;
        if ((w.confidence ?? 1) < MIN_CONFIDENCE) return;
        const rect = bboxToRect(w.bbox);
        if (rect.w <= 0 || rect.h <= 0) return;
        items.push({
            id,
            text,
            norm: normText(text),
            rect,
            cx: rect.x + rect.w / 2,
            cy: rect.y + rect.h / 2,
        });
    });
    if (items.length === 0) {
        return { zones: [], found: [], missing: [...WANTED], sampleCount: 0 };
    }

    const bounds: Size =
        dims && dims.w > 0 && dims.h > 0
            ? dims
            : {
                w: Math.max(...items.map((i) => i.rect.x + i.rect.w)),
                h: Math.max(...items.map((i) => i.rect.y + i.rect.h)),
            };
    const widths = items.map((i) => i.rect.w).sort((a, b) => a - b);
    const medianW = widths[Math.floor(widths.length / 2)] || 40;

    const raw: { type: OcrZoneType; rect: Rect }[] = [];
    const taken = new Set<OcrZoneType>();
    const used = new Set<number>();

    const claim = (type: OcrZoneType, group: Item[]) => {
        if (group.length === 0) return;
        raw.push({ type, rect: unionRect(group) });
        taken.add(type);
        group.forEach((i) => used.add(i.id));
    };

    // Пробы помечаем занятыми сразу — контекст не должен забирать их токены.
    const sampleItems = items.filter((i) => isSampleToken(i.text));
    sampleItems.forEach((i) => used.add(i.id));
    const sampleTop = sampleItems.length > 0
        ? Math.min(...sampleItems.map((i) => i.rect.y))
        : Number.POSITIVE_INFINITY;

    // 1. Метки этикетки — самый надёжный путь.
    for (const label of items) {
        const kind = labelKind(label.norm, label.text);
        if (!kind) continue;
        const values = valuesFor(label, items, medianW).filter((i) => !used.has(i.id));
        if (values.length === 0) continue;
        claim(kind, [label, ...values]);
    }

    const free = () => items.filter((i) => !used.has(i.id));

    // 2. Тип исследования по справочнику: код или имя целым токеном.
    if (!taken.has("research_type")) {
        const codes = (ctx.researchTypes ?? [])
            .flatMap((r) => [sq(r.code), sq(r.name)])
            .filter((c) => c.length >= 2);
        const hit = free().find((i) => codes.includes(sq(i.text)));
        if (hit) claim("research_type", [hit]);
    }

    // 3. Участок: код/паттерн — целый токен, имя — по строке (многословное).
    if (!taken.has("site")) {
        const tokens = (ctx.sites ?? [])
            .flatMap((s) => [sq(s.code), ...(s.match_patterns ?? []).map(sq)])
            .filter((c) => c.length >= 2);
        const names = (ctx.sites ?? []).map((s) => sq(s.name)).filter((c) => c.length >= 4);
        const byToken = free().find((i) => tokens.includes(sq(i.text)));
        if (byToken) {
            claim("site", [byToken]);
        } else {
            for (const row of rowsOf(free())) {
                const values = row.filter((i) => !labelKind(i.norm, i.text));
                if (values.length < 2) continue;
                const joined = sq(values.map((i) => i.text).join(""));
                if (!names.some((n) => joined.includes(n))) continue;
                claim("site", values);
                break;
            }
        }
    }

    // 4. Н/З: из известных заказов или по формату, выше таблицы проб.
    if (!taken.has("work_order_coded")) {
        const known = (ctx.workOrders ?? []).map(sq);
        const hit =
            free().find((i) => known.includes(sq(i.text))) ??
            free().find((i) => isWorkOrderToken(i.text) && i.rect.y < sampleTop);
        if (hit) claim("work_order_coded", [hit]);
    }

    // 5. Номер тары: сокращение типа с номером, иначе число выше таблицы.
    if (!taken.has("container_number")) {
        const types = ctx.containerTypes ?? [];
        const withType = free().find(
            (i) => parseContainerLabel(i.text, types).containerType !== null,
        );
        const numeric = free()
            .filter((i) => /^\d{1,6}$/.test(i.norm) && i.rect.y + i.rect.h <= sampleTop)
            .sort((a, b) => a.rect.y - b.rect.y)[0];
        const hit = withType ?? numeric;
        if (hit) claim("container_number", [hit]);
    }

    // 6. Зоны проб по колонкам таблицы.
    for (const cluster of clusterColumns(sampleItems, medianW * 0.5)) {
        raw.push({ type: "sample", rect: unionRect(cluster) });
    }

    const zones: OcrZone[] = [];
    for (const r of raw) {
        const padded = clampRect(padRect(r.rect, PAD), bounds);
        if (padded.w < 4 || padded.h < 4) continue;
        zones.push({ type: r.type, bbox: rectToBbox(padded), source: "manual" });
    }

    const found = Array.from(new Set(zones.map((z) => z.type)));
    return {
        zones,
        found,
        missing: WANTED.filter((t) => !found.includes(t)),
        sampleCount: sampleItems.length,
    };
}