/**
 * Ручная зона не сдвигается (6e-2-web-5-fix).
 * Рамка должна лечь ровно туда, где протянул мышью: только обрезка по фото.
 */
import { describe, expect, it } from "vitest";

import { clampRect } from "./zoneDraw";

const DIMS = { w: 1000, h: 800 };

describe("ручная зона без сдвига", () => {
    it("протянутый прямоугольник внутри фото сохраняется как есть", () => {
        const drawn = { x: 100, y: 120, w: 80, h: 30 };
        expect(clampRect(drawn, DIMS)).toEqual(drawn);
    });

    it("выход за край обрезается, но рамка не уезжает вниз", () => {
        const out = clampRect({ x: 950, y: 10, w: 200, h: 40 }, DIMS);
        expect(out.x).toBe(950);
        expect(out.y).toBe(10);
        expect(out.w).toBeLessThanOrEqual(50);
    });
});
