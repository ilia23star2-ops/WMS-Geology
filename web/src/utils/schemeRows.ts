/**
 * Строки интерактивной схемы стеллажа/секции (topology-scheme).
 * Ярусы сверху вниз (D→A = level_number по убыванию, null = вниз),
 * ячейки в строке слева→направо по коду.
 */
import type { Cell, Tier } from "../api";
import { orderCellsByCode } from "./cellOrder";

export interface SchemeRow {
    tierId: number;
    label: string;
    cells: Cell[];
}

/// Построить строки схемы для набора ярусов и их ячеек.
export function buildSchemeRows(tiers: Tier[], cells: Cell[]): SchemeRow[] {
    const sorted = [...tiers].sort((a, b) => (b.level_number ?? 0) - (a.level_number ?? 0));
    return sorted.map((t) => ({
        tierId: t.id,
        label: t.code,
        cells: orderCellsByCode(cells.filter((c) => c.tier === t.id)),
    }));
}