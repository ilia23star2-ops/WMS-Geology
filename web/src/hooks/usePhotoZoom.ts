/**
 * Состояние зума фото OCR (6e-2-web-4): масштаб, смещение, шаги зума, сброс.
 * Вся математика — в utils/photoZoom (покрыта тестами), здесь только состояние.
 */
import { useCallback, useMemo, useState } from "react";

import {
    MAX_SCALE,
    MIN_SCALE,
    clampPan,
    fitZoom,
    stepScale,
    zoomAt as zoomAtPoint,
    type Point,
    type Size,
} from "../utils/photoZoom";

export function usePhotoZoom(base: Size) {
    const [scale, setScale] = useState(MIN_SCALE);
    const [pan, setPanState] = useState<Point>({ x: 0, y: 0 });

    const setPan = useCallback(
        (next: Point | ((prev: Point) => Point)) => {
            setPanState((prev) => {
                const value = typeof next === "function" ? next(prev) : next;
                return clampPan(value, base, scale);
            });
        },
        [base, scale],
    );

    /** Зум к точке во вьюпорте (курсор или центр). */
    const zoomAt = useCallback(
        (cursor: Point, nextScale: number) => {
            const out = zoomAtPoint({ scale, pan }, cursor, nextScale, base);
            setScale(out.scale);
            setPanState(out.pan);
        },
        [scale, pan, base],
    );

    /** Шаг кнопками/клавишами — к центру вьюпорта. */
    const zoomBy = useCallback(
        (direction: 1 | -1) => {
            zoomAt({ x: base.w / 2, y: base.h / 2 }, stepScale(scale, direction));
        },
        [zoomAt, base, scale],
    );

    const reset = useCallback(() => {
        const fit = fitZoom();
        setScale(fit.scale);
        setPanState(fit.pan);
    }, []);

    const canZoomIn = scale < MAX_SCALE;
    const canZoomOut = scale > MIN_SCALE;

    return useMemo(
        () => ({ scale, pan, zoomAt, zoomBy, reset, setPan, clampPan, canZoomIn, canZoomOut }),
        [scale, pan, zoomAt, zoomBy, reset, setPan, canZoomIn, canZoomOut],
    );
}