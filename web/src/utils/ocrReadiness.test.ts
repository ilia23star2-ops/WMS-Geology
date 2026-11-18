import { describe, expect, it } from "vitest";

import { checkReadiness, type ReadinessInput } from "./ocrReadiness";

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
    return {
        siteName: "TST — Тестовый участок",
        researchTypeName: "ICP — ICP",
        workOrderCoded: "TST1234",
        containerTypeName: "Ящик",
        containerNumber: "1",
        rangesCount: 9,
        missingCount: 0,
        anomalyCount: 0,
        ...over,
    };
}

describe("checkReadiness", () => {
    it("всё заполнено → зелёный сигнал", () => {
        const r = checkReadiness(input());
        expect(r.blockers).toBe(0);
        expect(r.ready).toBe(true);
    });

    it("пустой номер тары → блокер", () => {
        const r = checkReadiness(input({ containerNumber: "  " }));
        expect(r.blockers).toBe(1);
        expect(r.ready).toBe(false);
    });

    it("пустой тип тары → блокер", () => {
        expect(checkReadiness(input({ containerTypeName: "" })).blockers).toBe(1);
    });

    it("нет проб → блокер", () => {
        expect(checkReadiness(input({ rangesCount: 0 })).blockers).toBe(1);
    });

    it("пробы с фото не внесены → не готов, но не блокер", () => {
        const r = checkReadiness(input({ missingCount: 1 }));
        expect(r.blockers).toBe(0);
        expect(r.ready).toBe(false);
        expect(r.warnings).toBeGreaterThan(0);
    });

    it("аномалия → не готов; участок пуст → только замечание", () => {
        expect(checkReadiness(input({ anomalyCount: 1 })).ready).toBe(false);
        const r = checkReadiness(input({ siteName: "" }));
        expect(r.blockers).toBe(0);
        expect(r.ready).toBe(true);
        expect(r.warnings).toBe(1);
    });
});