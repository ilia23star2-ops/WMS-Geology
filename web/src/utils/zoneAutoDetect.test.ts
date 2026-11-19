import { describe, expect, it } from "vitest";

import type { OcrWord } from "../api/ocr";
import { detectZones, isSampleToken, labelKind, type DetectContext } from "./zoneAutoDetect";
import { bboxToRect, overlaps } from "./zoneDraw";
import { extractFromZones } from "./zoneExtract";

const CTX: DetectContext = {
    researchTypes: [{ code: "ICP", name: "ICP" }, { code: "XRF", name: "Рентген" }],
    containerTypes: ["Ящик", "Коробка", "Паллет"],
    sites: [{ code: "TST", name: "Тестовый участок", match_patterns: ["TST"] }],
    workOrders: ["TST1234"],
};

function word(text: string, x: number, y: number, w = 60, h = 20, conf = 0.9): OcrWord {
    return {
        text,
        confidence: conf,
        bbox: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
    };
}

/** Этикетка с метками слева и пробами в две колонки. */
function labelWords(): OcrWord[] {
    return [
        word("Уч:", 40, 40, 50),
        word("Тестовый", 110, 40, 90),
        word("участок", 210, 42, 80),
        word("Н/З:", 40, 80, 50),
        word("TST1234", 110, 80, 90),
        word("Исп:", 40, 120, 50),
        word("ICP", 110, 120, 40),
        word("№:", 40, 160, 30),
        word("1", 110, 160, 15),
        word("TST1234501", 100, 240, 110),
        word("TST1234502", 100, 270, 110),
        word("TST1234504", 100, 300, 110),
        word("TST1234505", 300, 240, 110),
        word("TST1234506", 300, 270, 110),
    ];
}

describe("labelKind", () => {
    it("узнаёт метки этикетки", () => {
        expect(labelKind("УЧ")).toBe("site");
        expect(labelKind("Н/З")).toBe("work_order_coded");
        expect(labelKind("НЗ")).toBe("work_order_coded");
        expect(labelKind("ИСП")).toBe("research_type");
        expect(labelKind("№")).toBe("container_number");
        expect(labelKind("Н/З(ВХОД)")).toBe("work_order_incoming");
        expect(labelKind("TST1234501")).toBeNull();
    });
});

describe("isSampleToken", () => {
    it("Н/З пробой не считается, номер пробы — считается", () => {
        expect(isSampleToken("TST1234")).toBe(false);
        expect(isSampleToken("TST1234501")).toBe(true);
        expect(isSampleToken("TST12345O6")).toBe(true);
        expect(isSampleToken("ICP")).toBe(false);
    });
});

describe("detectZones: этикетка с метками", () => {
    it("строит зоны по меткам и колонкам проб", () => {
        const res = detectZones(labelWords(), undefined, CTX);
        expect(res.zones).toHaveLength(6);
        expect(res.found.sort()).toEqual(
            ["container_number", "research_type", "sample", "site", "work_order_coded"].sort(),
        );
        expect(res.missing).toEqual([]);
        expect(res.sampleCount).toBe(5);
    });

    it("зона участка накрывает многословное значение", () => {
        const site = detectZones(labelWords(), undefined, CTX).zones.find((z) => z.type === "site");
        const r = bboxToRect(site!.bbox);
        expect(r.x).toBeLessThanOrEqual(40);
        expect(r.x + r.w).toBeGreaterThanOrEqual(290);
    });

    it("пробы разложены по двум колонкам", () => {
        const samples = detectZones(labelWords(), undefined, CTX)
            .zones.filter((z) => z.type === "sample").map((z) => bboxToRect(z.bbox));
        expect(samples).toHaveLength(2);
        expect(samples[0].h).toBeGreaterThan(samples[1].h);
    });

    it("зоны не пересекаются и лежат внутри фото", () => {
        const dims = { w: 500, h: 400 };
        const rects = detectZones(labelWords(), dims, CTX).zones.map((z) => bboxToRect(z.bbox));
        for (const r of rects) {
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.x + r.w).toBeLessThanOrEqual(dims.w);
            expect(r.y + r.h).toBeLessThanOrEqual(dims.h);
        }
        for (let i = 0; i < rects.length; i++) {
            for (let j = i + 1; j < rects.length; j++) {
                expect(overlaps(rects[i], rects[j])).toBe(false);
            }
        }
    });

    it("близкие колонки сливаются в одну зону", () => {
        const words = [word("TST1234501", 100, 240, 110), word("TST1234502", 120, 270, 110)];
        expect(detectZones(words).zones.filter((z) => z.type === "sample")).toHaveLength(1);
    });
});

describe("detectZones: контекст справочников без меток", () => {
    it("ICP узнаётся как тип исследования, 1 — как номер тары", () => {
        const words = [
            word("TST1234", 110, 80, 90),
            word("ICP", 110, 120, 40),
            word("1", 110, 160, 15),
            word("TST1234501", 100, 240, 110),
        ];
        const res = detectZones(words, undefined, CTX);
        expect(res.found).toContain("research_type");
        expect(res.found).toContain("container_number");
        expect(res.found).toContain("work_order_coded");
        const ex = extractFromZones(words, res.zones, CTX.containerTypes);
        expect(ex.research_type).toBe("ICP");
        expect(ex.container_number).toBe("1");
        expect(ex.work_order_coded).toBe("TST1234");
    });

    it("«Ящ.1» даёт тип тары и номер", () => {
        const words = [word("Ящ.1", 110, 160, 70), word("TST1234501", 100, 240, 110)];
        const res = detectZones(words, undefined, CTX);
        const ex = extractFromZones(words, res.zones, CTX.containerTypes);
        expect(ex.container_type).toBe("Ящик");
        expect(ex.container_number).toBe("1");
    });

    it("участок узнаётся по имени из справочника", () => {
        const words = [word("Тестовый", 110, 40, 90), word("участок", 210, 42, 80)];
        const res = detectZones(words, undefined, CTX);
        expect(res.found).toContain("site");
        expect(extractFromZones(words, res.zones).site).toBe("Тестовый участок");
    });

    it("номера строк таблицы не принимаются за номер тары", () => {
        const words = [
            word("1.", 60, 240, 20),
            word("TST1234501", 100, 240, 110),
            word("2.", 60, 270, 20),
            word("TST1234502", 100, 270, 110),
        ];
        const res = detectZones(words, undefined, CTX);
        expect(res.found).not.toContain("container_number");
    });

    it("без справочников контекст не ломает поиск по меткам", () => {
        const res = detectZones(labelWords());
        expect(res.found).toContain("site");
        expect(res.found).toContain("sample");
    });
});

describe("detectZones: краевые случаи", () => {
    it("без меток и справочников — только пробы", () => {
        const res = detectZones([word("TST1234501", 100, 240, 110)]);
        expect(res.found).toEqual(["sample"]);
        expect(res.missing).toContain("site");
    });

    it("метка без значения зону не создаёт", () => {
        const res = detectZones([word("№:", 40, 160, 30)]);
        expect(res.zones).toEqual([]);
        expect(res.missing).toHaveLength(5);
    });

    it("пустой список слов безопасен", () => {
        const res = detectZones([]);
        expect(res.zones).toEqual([]);
        expect(res.sampleCount).toBe(0);
    });

    it("слова с низкой уверенностью игнорируются", () => {
        const words = [word("TST1234501", 100, 240, 110, 20, 0.05)];
        expect(detectZones(words).zones).toEqual([]);
    });

    it("обрезает зоны по размеру фото", () => {
        for (const z of detectZones(labelWords(), { w: 200, h: 200 }, CTX).zones) {
            const r = bboxToRect(z.bbox);
            expect(r.x + r.w).toBeLessThanOrEqual(200);
            expect(r.y + r.h).toBeLessThanOrEqual(200);
        }
    });
});