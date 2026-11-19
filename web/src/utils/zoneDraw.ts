/**
 * Геометрия рисования зон на фото в web (6e-2-web-5).
 * Все вычисления — в пикселях ОРИГИНАЛА фото; экранные координаты
 * переводятся с учётом зума и панорамы. Чистая логика, покрыта тестами.
 */

export interface Pt {
    x: number;
    y: number;
}

export interface Size {
    w: number;
    h: number;
}

export interface Rect {
    x: number;
    y: number;
    w: number;
    h: number;
}

/** Состояние вида: масштаб, смещение, размер вьюпорта, размер оригинала. */
export interface ViewState {
    scale: number;
    pan: Pt;
    base: Size;
    dims: Size;
}

/** Меньше этого — не зона, а дрожание мыши. */
export const MIN_ZONE_SIDE = 8;

/** Зазор между зонами, как в мобильной разметке. */
export const ZONE_GAP = 6;

/** Прямоугольник из двух точек протяжки, нормализованный и целочисленный. */
export function rectFromPoints(a: Pt, b: Pt): Rect {
    return {
        x: Math.round(Math.min(a.x, b.x)),
        y: Math.round(Math.min(a.y, b.y)),
        w: Math.round(Math.abs(a.x - b.x)),
        h: Math.round(Math.abs(a.y - b.y)),
    };
}

/** Обрезать прямоугольник границами фото. */
export function clampRect(r: Rect, dims: Size): Rect {
    if (dims.w <= 0 || dims.h <= 0) return { x: 0, y: 0, w: 0, h: 0 };
    const x = Math.max(0, Math.min(r.x, dims.w));
    const y = Math.max(0, Math.min(r.y, dims.h));
    return {
        x,
        y,
        w: Math.max(0, Math.min(r.w, dims.w - x)),
        h: Math.max(0, Math.min(r.h, dims.h - y)),
    };
}

/** Достаточно ли велик, чтобы сохранить как зону. */
export function isZoneBigEnough(r: Rect, min: number = MIN_ZONE_SIDE): boolean {
    return r.w >= min && r.h >= min;
}

/** Rect → bbox API: четыре угла по часовой стрелке. */
export function rectToBbox(r: Rect): number[][] {
    return [
        [r.x, r.y],
        [r.x + r.w, r.y],
        [r.x + r.w, r.y + r.h],
        [r.x, r.y + r.h],
    ];
}

/** bbox API (произвольный многоугольник) → охватывающий Rect. */
export function bboxToRect(bbox: number[][]): Rect {
    if (!bbox?.length) return { x: 0, y: 0, w: 0, h: 0 };
    const xs = bbox.map((p) => p[0]);
    const ys = bbox.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Точка внутри вьюпорта → пиксели оригинала (зум и панорама учтены). */
export function viewToPhoto(p: Pt, v: ViewState): Pt {
    if (v.base.w <= 0 || v.base.h <= 0 || v.dims.w <= 0 || v.dims.h <= 0) {
        return { x: 0, y: 0 };
    }
    const lx = (p.x - v.pan.x) / v.scale;
    const ly = (p.y - v.pan.y) / v.scale;
    return { x: (lx / v.base.w) * v.dims.w, y: (ly / v.base.h) * v.dims.h };
}

/** Пиксели оригинала → точка внутри вьюпорта. */
export function photoToView(p: Pt, v: ViewState): Pt {
    if (v.dims.w <= 0 || v.dims.h <= 0) return { x: 0, y: 0 };
    const lx = (p.x / v.dims.w) * v.base.w;
    const ly = (p.y / v.dims.h) * v.base.h;
    return { x: lx * v.scale + v.pan.x, y: ly * v.scale + v.pan.y };
}

/** Пересечение с учётом зазора. */
export function overlaps(a: Rect, b: Rect, gap: number = 0): boolean {
    return (
        a.x < b.x + b.w + gap &&
        a.x + a.w + gap > b.x &&
        a.y < b.y + b.h + gap &&
        a.y + a.h + gap > b.y
    );
}

/**
 * Раздвинуть новую зону от существующих: сначала вниз, если не влезает — вверх.
 * Если места нет ни там, ни там — оставляем как есть (пользователь поправит).
 */
export function resolveOverlap(
    next: Rect,
    existing: Rect[],
    dims: Size,
    gap: number = ZONE_GAP,
): Rect {
    let r = clampRect(next, dims);
    for (let pass = 0; pass <= existing.length; pass++) {
        const hit = existing.find((e) => overlaps(r, e, gap));
        if (!hit) return r;
        const below = clampRect({ ...r, y: hit.y + hit.h + gap }, dims);
        if (below.h === r.h && isZoneBigEnough(below, 1)) {
            r = below;
            continue;
        }
        const above = clampRect({ ...r, y: hit.y - r.h - gap }, dims);
        if (above.h === r.h && above.y >= 0 && isZoneBigEnough(above, 1)) {
            r = above;
            continue;
        }
        return r;
    }
    return r;
}