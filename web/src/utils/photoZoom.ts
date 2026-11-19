/**
 * Геометрия зума фото OCR (6e-2-web-4, fix2).
 * База — размер ВЬЮПОРТА (не трансформированной картинки), иначе замер
 * зацикливается и фото разрастается. Здесь чистая математика вида.
 */

export const MIN_SCALE = 1;
export const MAX_SCALE = 8;
export const ZOOM_STEP = 1.2;
export const WHEEL_STEP = 1.08;
export const KEY_PAN_STEP = 60;

export interface Point {
    x: number;
    y: number;
}

export interface Size {
    w: number;
    h: number;
}

export interface ZoomState {
    scale: number;
    pan: Point;
}

const ORIGIN: Point = { x: 0, y: 0 };

export function clamp(v: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, v));
}

/** Масштаб в допустимых пределах; мусор → минимальный. */
export function clampScale(scale: number): number {
    if (!Number.isFinite(scale)) return MIN_SCALE;
    return clamp(scale, MIN_SCALE, MAX_SCALE);
}

/** Шаг зума кнопками. */
export function stepScale(scale: number, direction: 1 | -1): number {
    return clampScale(scale * (direction > 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
}

/**
 * Базовый размер фото: ширина вьюпорта и высота по пропорциям оригинала.
 * Никогда не берётся из трансформированного элемента.
 */
export function baseSize(viewportWidth: number, natural: Size): Size {
    if (viewportWidth <= 0) return { w: 0, h: 0 };
    const ratio =
        natural.w > 0 && natural.h > 0 ? natural.h / natural.w : 0.75;
    return { w: viewportWidth, h: Math.round(viewportWidth * ratio) };
}

/** Смещение, при котором контент не выходит за вьюпорт. */
export function clampPan(pan: Point, base: Size, scale: number): Point {
    if (base.w <= 0 || base.h <= 0) return ORIGIN;
    const s = clampScale(scale);
    const minX = Math.min(0, base.w - base.w * s);
    const minY = Math.min(0, base.h - base.h * s);
    return { x: clamp(pan.x, minX, 0), y: clamp(pan.y, minY, 0) };
}

/** Зум к точке курсора: эта точка фото остаётся на месте. */
export function zoomAt(
    state: ZoomState,
    cursor: Point,
    nextScaleRaw: number,
    base: Size,
): ZoomState {
    const scale = clampScale(nextScaleRaw);
    if (base.w <= 0 || base.h <= 0) return { scale, pan: ORIGIN };
    const ratio = scale / state.scale;
    const pan = {
        x: cursor.x - (cursor.x - state.pan.x) * ratio,
        y: cursor.y - (cursor.y - state.pan.y) * ratio,
    };
    return { scale, pan: clampPan(pan, base, scale) };
}

/** «Вписать». */
export function fitZoom(): ZoomState {
    return { scale: MIN_SCALE, pan: ORIGIN };
}

/** «1:1»: один пиксель фото = один пиксель экрана. */
export function actualScale(naturalWidth: number, baseWidth: number): number {
    if (naturalWidth <= 0 || baseWidth <= 0) return MIN_SCALE;
    return clampScale(naturalWidth / baseWidth);
}

/**
 * Перехватывать ли колесо. На 100% прокрутка вниз остаётся странице —
 * иначе фото «съедает» скролл. Вверх (приближение) и Ctrl+колесо — всегда зум.
 */
export function shouldZoomOnWheel(
    deltaY: number,
    scale: number,
    ctrlKey: boolean,
): boolean {
    if (ctrlKey) return true;
    if (deltaY < 0) return true;
    return scale > MIN_SCALE;
}

/** Сдвиг вида стрелками: вправо — контент уходит влево. */
export function panDeltaFor(key: string, step: number = KEY_PAN_STEP): Point {
    switch (key) {
        case "ArrowLeft": return { x: step, y: 0 };
        case "ArrowRight": return { x: -step, y: 0 };
        case "ArrowUp": return { x: 0, y: step };
        case "ArrowDown": return { x: 0, y: -step };
        default: return ORIGIN;
    }
}

/** Проценты для индикатора. */
export function scalePercent(scale: number): number {
    return Math.round(clampScale(scale) * 100);
}