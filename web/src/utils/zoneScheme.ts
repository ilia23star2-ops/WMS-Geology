/**
 * Чистая логика схемы зоны (zones-web).
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