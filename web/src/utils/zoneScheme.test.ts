import { describe, expect, it } from "vitest";

import { nextPlaceCode, placeTone, rowIsVertical, schemeTotal } from "./zoneScheme";

describe("rowIsVertical", () => {
    it("vertical → true", () => {
        expect(rowIsVertical("vertical")).toBe(true);
    });

    it("horizontal → false", () => {
        expect(rowIsVertical("horizontal")).toBe(false);
    });
});

describe("placeTone", () => {
    it("0 тар → empty", () => {
        expect(placeTone(0)).toBe("empty");
    });

    it("больше 0 тар → filled", () => {
        expect(placeTone(2)).toBe("filled");
    });
});

describe("schemeTotal", () => {
    it("сумма счётчиков мест", () => {
        const places = [
            { id: 1, code: 1, count: 2, levels: [] },
            { id: 2, code: 2, count: 3, levels: [] },
        ];
        expect(schemeTotal(places)).toBe(5);
    });
});

describe("nextPlaceCode", () => {
    it("максимум кода + 1", () => {
        const places = [
            { id: 1, code: 1, count: 0, levels: [] },
            { id: 2, code: 7, count: 0, levels: [] },
        ];
        expect(nextPlaceCode(places)).toBe(8);
    });
});