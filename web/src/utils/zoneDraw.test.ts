import { describe, expect, it } from "vitest";

import {
    MIN_ZONE_SIDE,
    ZONE_GAP,
    bboxToRect,
    clampRect,
    isZoneBigEnough,
    overlaps,
    photoToView,
    rectFromPoints,
    rectToBbox,
    resolveOverlap,
    viewToPhoto,
} from "./zoneDraw";

const DIMS = { w: 1000, h: 800 };
const VIEW = {
    scale: 2.5,
    pan: { x: -120, y: -80 },
    base: { w: 500, h: 400 },
    dims: DIMS,
};

describe("rectFromPoints", () => {
    it("протяжка в любую сторону даёт одинаковый прямоугольник", () => {
        expect(rectFromPoints({ x: 300, y: 200 }, { x: 100, y: 80 })).toEqual({
            x: 100, y: 80, w: 200, h: 120,
        });
        expect(rectFromPoints({ x: 100, y: 80 }, { x: 300, y: 200 })).toEqual({
            x: 100, y: 80, w: 200, h: 120,
        });
    });

    it("округляет до целых пикселей", () => {
        expect(rectFromPoints({ x: 10.4, y: 20.6 }, { x: 40.5, y: 60.2 })).toEqual({
            x: 10, y: 21, w: 30, h: 40,
        });
    });
});

describe("clampRect", () => {
    it("не выпускает зону за фото", () => {
        expect(clampRect({ x: 900, y: 700, w: 300, h: 300 }, DIMS)).toEqual({
            x: 900, y: 700, w: 100, h: 100,
        });
    });

    it("отрицательные координаты подтягиваются к нулю", () => {
        expect(clampRect({ x: -50, y: -10, w: 100, h: 50 }, DIMS)).toEqual({
            x: 0, y: 0, w: 100, h: 50,
        });
    });

    it("нулевое фото → нулевой прямоугольник", () => {
        expect(clampRect({ x: 1, y: 1, w: 10, h: 10 }, { w: 0, h: 0 })).toEqual({
            x: 0, y: 0, w: 0, h: 0,
        });
    });
});

describe("isZoneBigEnough", () => {
    it("дрожание мыши зоной не считается", () => {
        expect(isZoneBigEnough({ x: 0, y: 0, w: 3, h: 40 })).toBe(false);
        expect(isZoneBigEnough({ x: 0, y: 0, w: MIN_ZONE_SIDE, h: MIN_ZONE_SIDE })).toBe(true);
    });
});

describe("bbox", () => {
    it("Rect → четыре угла по часовой", () => {
        expect(rectToBbox({ x: 10, y: 20, w: 100, h: 50 })).toEqual([
            [10, 20], [110, 20], [110, 70], [10, 70],
        ]);
    });

    it("произвольный многоугольник → охватывающий Rect", () => {
        expect(bboxToRect([[50, 30], [10, 90], [80, 10]])).toEqual({
            x: 10, y: 10, w: 70, h: 80,
        });
        expect(bboxToRect([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    });
});

describe("перевод координат", () => {
    it("на 100% без смещения — пропорция к оригиналу", () => {
        const v = { scale: 1, pan: { x: 0, y: 0 }, base: { w: 500, h: 400 }, dims: DIMS };
        expect(viewToPhoto({ x: 250, y: 200 }, v)).toEqual({ x: 500, y: 400 });
    });

    it("зум и панорама учитываются", () => {
        expect(viewToPhoto({ x: 370, y: 280 }, VIEW)).toEqual({ x: 392, y: 288 });
    });

    it("обратный перевод возвращает исходную точку", () => {
        const photo = { x: 400, y: 360 };
        const back = viewToPhoto(photoToView(photo, VIEW), VIEW);
        expect(back.x).toBeCloseTo(photo.x, 6);
        expect(back.y).toBeCloseTo(photo.y, 6);
    });

    it("без размеров фото перевод безопасен", () => {
        const empty = { ...VIEW, base: { w: 0, h: 0 } };
        expect(viewToPhoto({ x: 10, y: 10 }, empty)).toEqual({ x: 0, y: 0 });
    });
});

describe("раздвижка зон", () => {
    const existing = [{ x: 100, y: 100, w: 200, h: 100 }];

    it("пересечение обнаруживается с зазором", () => {
        expect(overlaps({ x: 150, y: 150, w: 50, h: 50 }, existing[0])).toBe(true);
        expect(overlaps({ x: 600, y: 600, w: 50, h: 50 }, existing[0])).toBe(false);
    });

    it("новая зона уезжает вниз с зазором", () => {
        const out = resolveOverlap({ x: 120, y: 120, w: 100, h: 80 }, existing, DIMS);
        expect(out.y).toBe(100 + 100 + ZONE_GAP);
        expect(out.x).toBe(120);
    });

    it("если снизу нет места — уезжает вверх", () => {
        const small = { w: 1000, h: 250 };
        const out = resolveOverlap({ x: 0, y: 120, w: 100, h: 80 }, existing, small);
        expect(out.y).toBe(100 - 80 - ZONE_GAP);
        expect(out.h).toBe(80);
    });

    it("непересекающаяся зона не двигается", () => {
        const next = { x: 600, y: 600, w: 100, h: 80 };
        expect(resolveOverlap(next, existing, DIMS)).toEqual(next);
    });
});