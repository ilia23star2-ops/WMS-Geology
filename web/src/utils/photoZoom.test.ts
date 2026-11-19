import { describe, expect, it } from "vitest";

import {
    MAX_SCALE,
    MIN_SCALE,
    ZOOM_STEP,
    actualScale,
    baseSize,
    clampPan,
    clampScale,
    fitZoom,
    panDeltaFor,
    scalePercent,
    shouldZoomOnWheel,
    stepScale,
    zoomAt,
} from "./photoZoom";

const BASE = { w: 800, h: 600 };

describe("clampScale", () => {
    it("держит масштаб в пределах 1..8", () => {
        expect(clampScale(0.2)).toBe(MIN_SCALE);
        expect(clampScale(99)).toBe(MAX_SCALE);
        expect(clampScale(2.5)).toBe(2.5);
    });

    it("мусор → минимальный масштаб", () => {
        expect(clampScale(Number.NaN)).toBe(MIN_SCALE);
    });
});

describe("stepScale", () => {
    it("шаг вверх и вниз", () => {
        expect(stepScale(1, 1)).toBeCloseTo(ZOOM_STEP);
        expect(stepScale(ZOOM_STEP, -1)).toBeCloseTo(1);
    });

    it("не выходит за границы", () => {
        expect(stepScale(MAX_SCALE, 1)).toBe(MAX_SCALE);
        expect(stepScale(MIN_SCALE, -1)).toBe(MIN_SCALE);
    });
});

describe("baseSize", () => {
    it("высота по пропорциям оригинала, ширина вьюпорта", () => {
        expect(baseSize(800, { w: 2000, h: 1500 })).toEqual({ w: 800, h: 600 });
    });

    it("нулевая ширина → нулевой размер, без пропорций fallback 3:4", () => {
        expect(baseSize(0, { w: 2000, h: 1500 })).toEqual({ w: 0, h: 0 });
        expect(baseSize(400, { w: 0, h: 0 })).toEqual({ w: 400, h: 300 });
    });
});

describe("clampPan", () => {
    it("при масштабе 1 смещение нулевое", () => {
        expect(clampPan({ x: -120, y: -80 }, BASE, 1)).toEqual({ x: 0, y: 0 });
    });

    it("при масштабе 2 не даёт уйти за края", () => {
        expect(clampPan({ x: -5000, y: -5000 }, BASE, 2)).toEqual({ x: -800, y: -600 });
        expect(clampPan({ x: 500, y: 500 }, BASE, 2)).toEqual({ x: 0, y: 0 });
    });

    it("нулевой размер фото → нулевое смещение", () => {
        expect(clampPan({ x: -10, y: -10 }, { w: 0, h: 0 }, 3)).toEqual({ x: 0, y: 0 });
    });
});

describe("zoomAt", () => {
    it("точка курсора остаётся на месте", () => {
        const out = zoomAt({ scale: 1, pan: { x: 0, y: 0 } }, { x: 200, y: 100 }, 2, BASE);
        expect(out.scale).toBe(2);
        expect(out.pan).toEqual({ x: -200, y: -100 });
    });

    it("у правого нижнего края смещение ограничено", () => {
        const out = zoomAt({ scale: 1, pan: { x: 0, y: 0 } }, { x: 800, y: 600 }, 2, BASE);
        expect(out.pan).toEqual({ x: -800, y: -600 });
    });

    it("обратный зум возвращает к вписанному виду", () => {
        const zoomed = zoomAt({ scale: 1, pan: { x: 0, y: 0 } }, { x: 200, y: 100 }, 2, BASE);
        expect(zoomAt(zoomed, { x: 200, y: 100 }, 1, BASE)).toEqual({ scale: 1, pan: { x: 0, y: 0 } });
    });
});

describe("actualScale", () => {
    it("1:1 считается от ширины вьюпорта", () => {
        expect(actualScale(1600, 800)).toBe(2);
    });

    it("ограничен максимумом и защищён от нуля", () => {
        expect(actualScale(100000, 100)).toBe(MAX_SCALE);
        expect(actualScale(0, 800)).toBe(MIN_SCALE);
        expect(actualScale(1600, 0)).toBe(MIN_SCALE);
    });
});

describe("shouldZoomOnWheel", () => {
    it("на 100% прокрутка вниз остаётся странице", () => {
        expect(shouldZoomOnWheel(120, 1, false)).toBe(false);
    });

    it("вверх и Ctrl+колесо — всегда зум", () => {
        expect(shouldZoomOnWheel(-120, 1, false)).toBe(true);
        expect(shouldZoomOnWheel(120, 1, true)).toBe(true);
    });

    it("при увеличении колесо работает в обе стороны", () => {
        expect(shouldZoomOnWheel(120, 2, false)).toBe(true);
    });
});

describe("panDeltaFor", () => {
    it("стрелки двигают вид, остальные клавиши — нет", () => {
        expect(panDeltaFor("ArrowRight", 50)).toEqual({ x: -50, y: 0 });
        expect(panDeltaFor("ArrowUp", 50)).toEqual({ x: 0, y: 50 });
        expect(panDeltaFor("Enter", 50)).toEqual({ x: 0, y: 0 });
    });
});

describe("fitZoom и scalePercent", () => {
    it("«Вписать» сбрасывает вид", () => {
        expect(fitZoom()).toEqual({ scale: 1, pan: { x: 0, y: 0 } });
    });

    it("проценты округляются", () => {
        expect(scalePercent(1)).toBe(100);
        expect(scalePercent(1.256)).toBe(126);
    });
});

describe("серия зумов", () => {
    it("масштаб растёт, смещение всегда в пределах", () => {
        let state = { scale: 1, pan: { x: 0, y: 0 } };
        for (let i = 0; i < 25; i++) {
            state = zoomAt(state, { x: 400, y: 300 }, state.scale * ZOOM_STEP, BASE);
            expect(state.pan).toEqual(clampPan(state.pan, BASE, state.scale));
        }
        expect(state.scale).toBe(MAX_SCALE);
    });

    it("серия отдалений возвращает к вписанному виду", () => {
        let state = { scale: 4, pan: { x: -300, y: -200 } };
        for (let i = 0; i < 25; i++) {
            state = zoomAt(state, { x: 400, y: 300 }, state.scale / ZOOM_STEP, BASE);
        }
        expect(state.scale).toBe(MIN_SCALE);
        expect(state.pan).toEqual({ x: 0, y: 0 });
    });
});