/**
 * Чистая логика схемы зоны (zones-web + zones-stack-ui).
 */
import type { RowOrientation, ZoneSchemePlace } from "../api/zones";

/** Вертикальный ли ряд (стопки сверху вниз). */
export function rowIsVertical(orientation: RowOrientation): boolean {
    return orientation === "vertical";
}

/** Тон квадрата места по счётчику тары. */
export function placeTone(count: number): "empty" | "filled" {
    return count > 0 ? "filled" : "empty";
}

/** Суммарная тара по местам схемы. */
export function schemeTotal(places: ZoneSchemePlace[]): number {
    return places.reduce((acc, p) => acc + p.count, 0);
}

/** Следующий код места в ряду (максимум + 1). */
export function nextPlaceCode(places: ZoneSchemePlace[]): number {
    return places.reduce((max, p) => Math.max(max, p.code), 0) + 1;
}

/** Тара в клетке сетки стопки (номер/Н/З/ТИ из scheme). */
export interface StackContainer {
    container_id: number;
    level: number;
    number?: string | null;
    nz?: string | null;
    research?: string | null;
}

export interface StackCell {
    placeId: number;
    placeCode: number;
    level: number;
    container: StackContainer | null;
    isNext: boolean;
}

export interface StackRowLine {
    level: number;
    count: number;
    cells: StackCell[];
}

export interface StackRowInput {
    places: {
        id: number;
        code: number;
        count: number;
        levels: StackContainer[];
    }[];
}

/**
 * Строки сетки стопки сверху вниз (максимальный ярус … 1).
 * Слева направо — места (стопки); клетка = одна тара.
 */
export function stackGridRows(row: StackRowInput): StackRowLine[] {
    const maxLevel = row.places.reduce((m, p) => Math.max(m, p.count), 0);
    const lines: StackRowLine[] = [];
    for (let level = maxLevel; level >= 1; level--) {
        const cells: StackCell[] = row.places.map((p) => {
            const container = p.levels.find((l) => l.level === level) ?? null;
            return {
                placeId: p.id,
                placeCode: p.code,
                level,
                container,
                isNext: level === p.count + 1,
            };
        });
        lines.push({
            level,
            count: cells.filter((c) => c.container !== null).length,
            cells,
        });
    }
    return lines;
}