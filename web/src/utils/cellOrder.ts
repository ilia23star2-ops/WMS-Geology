/**
 * Порядок и заполненность ячеек для мини-схемы яруса
 * (topology-cell-card-ui).
 * Градация цвета: пусто / занята / почти полна / полна-перегруз.
 */
import type { Cell } from "../api";

export type Occupancy = "empty" | "filled" | "near" | "full";

function num(code: string): number {
    const n = parseInt(code, 10);
    return Number.isNaN(n) ? 0 : n;
}

/// Числовой порядок ячеек слева→направо (1, 2, … 10), не лексикографический.
export function orderCellsByCode(cells: Cell[]): Cell[] {
    return [...cells].sort((a, b) => num(a.code) - num(b.code));
}

/// Заполненность для мини-схемы. limit=null — лимит ещё не известен.
export function occupancyColor(count: number, limit: number | null = null): Occupancy {
    if (count <= 0) return "empty";
    if (limit === null || limit <= 0) return "filled";
    if (count >= limit) return "full";
    if (count >= limit * 0.7) return "near";
    return "filled";
}

/// Палитра мини-схемы (см. макет: серый / зелёный / жёлтый / красный).
export const OCCUPANCY_COLORS: Record<Occupancy, string> = {
    empty: "#BDBDBD",
    filled: "#2EB84C",
    near: "#F2E500",
    full: "#E8112D",
};