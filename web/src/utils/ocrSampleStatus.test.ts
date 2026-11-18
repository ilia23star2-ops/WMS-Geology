import { describe, expect, it } from "vitest";

import {
    anomalyNumberSet,
    auditSamples,
    rangeNumberSet,
    sampleWordStatus,
    type AuditRange,
} from "./ocrSampleAudit";

const VP = ["TST"];

function range(over: Partial<AuditRange> = {}): AuditRange {
    return {
        id: "r1",
        prefix: "TST",
        middle: "1234",
        sequenceFrom: 501,
        sequenceTo: 501,
        sequenceDigits: 3,
        skippedSeqs: [],
        ...over,
    };
}

describe("sampleWordStatus", () => {
    const good = range({ id: "ok", sequenceFrom: 501, sequenceTo: 505 });
    const bad = range({
        id: "bad",
        middle: "11234",
        sequenceFrom: 506,
        sequenceTo: 506,
    });
    const ranges = [good, bad];
    const numbers = rangeNumberSet(ranges);
    const anomaly = anomalyNumberSet(ranges, ["bad"]);

    it("проба есть в списке → covered", () => {
        expect(sampleWordStatus("TST1234501", numbers, anomaly, VP)).toBe("covered");
    });

    it("неисправленная аномалия → anomaly, не covered", () => {
        expect(sampleWordStatus("TST11234506", numbers, anomaly, VP)).toBe("anomaly");
    });

    it("пробы нет в списке → missing", () => {
        expect(sampleWordStatus("TST1234510", numbers, anomaly, VP)).toBe("missing");
    });

    it("после правки аномалии слово становится covered", () => {
        const fixed = [good, range({ id: "bad", sequenceFrom: 506, sequenceTo: 506 })];
        const nums = rangeNumberSet(fixed);
        const anom = anomalyNumberSet(fixed, auditSamples([], fixed, VP).anomalyIds);
        expect(anom.size).toBe(0);
        expect(sampleWordStatus("TST11234506", nums, anom, VP)).toBe("covered");
    });

    it("заголовок и Н/З — не пробы (null)", () => {
        expect(sampleWordStatus("Образец", numbers, anomaly, VP)).toBeNull();
        expect(sampleWordStatus("TST1234", numbers, anomaly, VP)).toBeNull();
    });

    it("anomalyNumberSet берёт только помеченные диапазоны", () => {
        expect(anomaly.has("TST11234506")).toBe(true);
        expect(anomaly.has("TST1234501")).toBe(false);
    });
});