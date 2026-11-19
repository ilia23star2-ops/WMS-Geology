/**
 * Deep-link на тару: /containers?open=<id> (устаревший highlight поддержан).
 * Чистая логика, без UI — покрывается тестами (6e-2-web-fix8).
 */

/** Id тары из параметров адреса или null, если параметра нет / некорректен. */
export function parseContainerDeepLink(params: URLSearchParams): number | null {
    const raw = params.get("open") ?? params.get("highlight");
    if (!raw) return null;
    const id = Number.parseInt(raw, 10);
    if (!Number.isFinite(id) || id <= 0) return null;
    return id;
}

/** Копия параметров без deep-link — карточка не открывается повторно. */
export function stripContainerDeepLink(params: URLSearchParams): URLSearchParams {
    const next = new URLSearchParams(params);
    next.delete("open");
    next.delete("highlight");
    return next;
}
