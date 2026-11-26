/**
 * Порядок и заполненность ячеек для мини-схемы яруса
 * (topology-cell-card-ui).
 */
import type { Cell } from "../api";

function num(code: string): number {
    const n = parseInt(code, 10);
    return Number.isNaN(n) ? 0 : n;
}

/// Числовой порядок ячеек слева→направо (1, 2, … 10), не лексикографический.
export function orderCellsByCode(cells: Cell[]): Cell[] {
    return [...cells].sort((a, b) => num(a.code) - num(b.code));
}

/// Заполненность для мини-схемы: пусто / есть тара.
export function occupancyColor(count: number): "empty" | "filled" {
    return count > 0 ? "filled" : "empty";
}