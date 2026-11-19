import { describe, expect, it } from "vitest";

import type { RangeEntry } from "../components/ocr/RangesTable";
import { buildSampleGroups, makeAllSeqs } from "./ocrRangeHelpers";

function range(over: Partial<RangeEntry> = {}): RangeEntry {
    return {
        id: "r1",
        rawInput: "TST1234501",
        prefix: "TST",
        middle: "1234",
        sequenceFrom: 501,
        sequenceTo: 503,
        sequenceDigits: 3,
        wellName: null,
        allSeqs: [501, 502, 503],
        skippedSeqs: [],
        selectedSeqs: [],
        ...over,
    };
}

describe("makeAllSeqs", () => {
    it("включительный диапазон", () => {
        expect(makeAllSeqs(501, 503)).toEqual([501, 502, 503]);
    });
});

describe("buildSampleGroups", () => {
    it("без входящего Н/З скважина = middle", () => {
        const groups = buildSampleGroups([range()], false);
        expect(groups).toHaveLength(1);
        expect(groups[0].well_name).toBe("1234");
        expect(groups[0].sequence_from).toBe(501);
        expect(groups[0].sequence_to).toBe(503);
    });

    it("с входящим Н/З скважины нет, пропущенные рвут диапазон", () => {
        const groups = buildSampleGroups([range({ skippedSeqs: [502] })], true);
        expect(groups.map((g) => [g.sequence_from, g.sequence_to])).toEqual([
            [501, 501],
            [503, 503],
        ]);
        expect(groups.every((g) => g.well_name === null)).toBe(true);
    });

    it("выбранные уходят отдельной группой со статусом SELECTED", () => {
        const groups = buildSampleGroups([range({ selectedSeqs: [502] })], false);
        expect(groups.map((g) => g.status)).toEqual(["NORMAL", "NORMAL", "SELECTED"]);
    });
});