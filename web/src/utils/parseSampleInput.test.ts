import { describe, expect, it } from "vitest";

import {
    buildSampleNumbers,
    parseSampleInput,
    type ParsedSampleRange,
} from "./parseSampleInput";

const LAB_PREFIXES = ["TAA-A", "TAA-B"];
const SITE_PATTERNS = ["TST", "Тест"];

function parse(input: string, hasIncoming = true) {
    return parseSampleInput(input, {
        laboratoryPrefixes: LAB_PREFIXES,
        siteMatchPatterns: SITE_PATTERNS,
        hasIncomingWorkOrder: hasIncoming,
    });
}

describe("parseSampleInput — успех", () => {
    it("шифрованная с диапазоном TAA-A34076001-031", () => {
        const r = parse("TAA-A34076001-031", true);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const expected: ParsedSampleRange = {
            prefix: "TAA-A",
            middle: "34076",
            sequenceFrom: 1,
            sequenceTo: 31,
            sequenceDigits: 3,
            wellName: null,
        };
        expect(r.value).toEqual(expected);
    });

    it("нешифрованная с диапазоном TST124001-005", () => {
        const r = parse("TST124001-005", false);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.prefix).toBe("TST");
        expect(r.value.middle).toBe("124");
        expect(r.value.sequenceFrom).toBe(1);
        expect(r.value.sequenceTo).toBe(5);
        expect(r.value.sequenceDigits).toBe(3);
        expect(r.value.wellName).toBe("124");
    });

    it("без дефиса — одна проба (seq = последние 3)", () => {
        const r = parse("TAA-A34076001", true);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.sequenceFrom).toBe(1);
        expect(r.value.sequenceTo).toBe(1);
        expect(r.value.sequenceDigits).toBe(3);
        expect(r.value.middle).toBe("34076");
    });

    it("wellName = null при входящем Н/З", () => {
        const r = parse("TST124001-005", true);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.wellName).toBeNull();
    });

    it("wellName = middle без входящего Н/З", () => {
        const r = parse("TST124001-005", false);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.wellName).toBe("124");
    });

    it("выбирает самый длинный префикс", () => {
        const r = parseSampleInput("TAA-A34076001-005", {
            laboratoryPrefixes: ["TAA", "TAA-A"],
            siteMatchPatterns: [],
            hasIncomingWorkOrder: true,
        });
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        expect(r.value.prefix).toBe("TAA-A");
    });

    it("регистронезависимый матч префикса", () => {
        const r = parse("taa-a34076001-005", true);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        // В результат идёт префикс из справочника, а не из ввода.
        expect(r.value.prefix).toBe("TAA-A");
        expect(r.value.middle).toBe("34076");
    });

    it("короткий диапазон TST124001-005 — 5 проб", () => {
        const r = parse("TST124001-005", false);
        expect(r.ok).toBe(true);
        if (!r.ok) return;
        const count = r.value.sequenceTo - r.value.sequenceFrom + 1;
        expect(count).toBe(5);
    });
});

describe("parseSampleInput — ошибки", () => {
    it("пустая строка", () => {
        const r = parse("");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toContain("Введите");
    });

    it("префикс не найден", () => {
        const r = parse("XYZ12345-005");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toContain("Префикс");
    });

    it("нет номера после префикса", () => {
        const r = parse("TAA-A");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toContain("После префикса");
    });

    it("начало диапазона больше конца", () => {
        const r = parse("TAA-A34076031-001");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toContain("больше");
    });

    it("слишком большой диапазон", () => {
        const r = parse("TAA-A34076001-99999");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toContain("диапазон");
    });

    it("больше одного дефиса в теле", () => {
        const r = parse("TAA-A34076001-031-035");
        expect(r.ok).toBe(false);
        if (r.ok) return;
        expect(r.error).toContain("дефис");
    });
});

describe("buildSampleNumbers", () => {
    it("генерирует полный список для шифрованной", () => {
        const nums = buildSampleNumbers({
            prefix: "TAA-A",
            middle: "34076",
            sequenceFrom: 1,
            sequenceTo: 3,
            sequenceDigits: 3,
            wellName: null,
        });
        expect(nums).toEqual([
            "TAA-A34076001",
            "TAA-A34076002",
            "TAA-A34076003",
        ]);
    });

    it("сохраняет ведущие нули для нешифрованной", () => {
        const nums = buildSampleNumbers({
            prefix: "TST",
            middle: "124",
            sequenceFrom: 1,
            sequenceTo: 3,
            sequenceDigits: 3,
            wellName: "124",
        });
        expect(nums).toEqual(["TST124001", "TST124002", "TST124003"]);
    });

    it("единственная проба", () => {
        const nums = buildSampleNumbers({
            prefix: "TAA-A",
            middle: "34076",
            sequenceFrom: 5,
            sequenceTo: 5,
            sequenceDigits: 3,
            wellName: null,
        });
        expect(nums).toEqual(["TAA-A34076005"]);
    });

    it("двухзначный диапазон", () => {
        const nums = buildSampleNumbers({
            prefix: "TST",
            middle: "1234",
            sequenceFrom: 1,
            sequenceTo: 5,
            sequenceDigits: 2,
            wellName: "1234",
        });
        expect(nums).toEqual([
            "TST123401",
            "TST123402",
            "TST123403",
            "TST123404",
            "TST123405",
        ]);
    });
});