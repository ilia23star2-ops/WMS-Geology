import { describe, expect, it } from "vitest";

import { parseSampleGroups } from "./parseSampleGroups";

describe("parseSampleGroups", () => {
    it("парсит одну строку", () => {
        const { groups, errors } = parseSampleGroups("TAA-A | 34076001 | 1-31");
        expect(errors).toEqual([]);
        expect(groups).toEqual([
            {
                prefix: "TAA-A",
                middle: "34076001",
                sequence_from: 1,
                sequence_to: 31,
                sequence_digits: 2,
                well_name: null,
                status: "NORMAL",
            },
        ]);
    });

    it("парсит несколько строк + игнорирует пустые и #", () => {
        const input = `
# комментарий
TAA-A | 34076001 | 1-5

TAA-B | 34076001 | 10-20
        `;
        const { groups, errors } = parseSampleGroups(input);
        expect(errors).toEqual([]);
        expect(groups).toHaveLength(2);
        expect(groups[0].sequence_from).toBe(1);
        expect(groups[1].sequence_to).toBe(20);
        expect(groups[1].sequence_digits).toBe(2);
    });

    it("ошибка: не 3 части", () => {
        const { groups, errors } = parseSampleGroups("TAA-A | 34076001");
        expect(groups).toEqual([]);
        expect(errors).toHaveLength(1);
        expect(errors[0]).toContain("3 части");
    });

    it("ошибка: диапазон не from-to", () => {
        const { groups, errors } = parseSampleGroups("TAA-A | 34076001 | abc");
        expect(groups).toEqual([]);
        expect(errors[0]).toContain("не в формате");
    });

    it("ошибка: from > to", () => {
        const { groups, errors } = parseSampleGroups("TAA-A | 34076001 | 31-1");
        expect(groups).toEqual([]);
        expect(errors[0]).toContain("неверный диапазон");
    });

    it("ошибка: пустой prefix", () => {
        const { groups, errors } = parseSampleGroups(" | 34076001 | 1-5");
        expect(groups).toEqual([]);
        expect(errors[0]).toContain("пустой prefix");
    });
});