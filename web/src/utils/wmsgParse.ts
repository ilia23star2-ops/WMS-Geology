/**
 * Разбор QR-кода топологии (topology-scan).
 * Формат: WMSG:<ТИП>:<ID> (см. QR-стратегию в PROJECT.md).
 * Чистая функция, тестируется.
 */
export interface WmsgCode {
    type: "SECTION" | "CELL" | "CONTAINER" | "SAMPLE";
    id: number;
}

/// Разобрать код; null — если формат не подходит.
export function parseWmsg(raw: string): WmsgCode | null {
    const parts = raw.split(":");
    if (parts.length !== 3 || parts[0] !== "WMSG") return null;
    const type = parts[1];
    if (
        type !== "SECTION" &&
        type !== "CELL" &&
        type !== "CONTAINER" &&
        type !== "SAMPLE"
    ) {
        return null;
    }
    const id = Number(parts[2]);
    if (!Number.isInteger(id) || id <= 0) return null;
    return { type, id };
}