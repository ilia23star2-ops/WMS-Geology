import { describe, expect, it } from "vitest";

import { checkPrefixes, isKnownPrefix, leadingLetters, sampleTail } from "./samplePrefixCheck";

const PREFIXES = ["TST", "TAA", "ILM"];

describe("leadingLetters", () => {
    it("берёт всю ведущую буквенную часть, а не три символа", () => {
        expect(leadingLetters("TSTT234501")).toBe("TSTT");
        expect(leadingLetters("TST1234501")).toBe("TST");
    });

    it("шифрованная проба: префикс до дефиса", () => {
        expect(leadingLetters("TAA-A34076001-031")).toBe("TAA");
        expect(sampleTail("TAA-A34076001-031")).toBe("-A34076001-031");
    });

    it("регистр и пробелы не мешают, цифр в начале нет", () => {
        expect(leadingLetters(" tst 1234501")).toBe("TST");
        expect(leadingLetters("1234501")).toBe("");
        expect(leadingLetters("")).toBe("");
    });
});

describe("isKnownPrefix", () => {
    it("точное совпадение со справочником, регистр не важен", () => {
        expect(isKnownPrefix("tst", PREFIXES)).toBe(true);
        expect(isKnownPrefix("TAA", PREFIXES)).toBe(true);
    });

    it("лишняя буква — не префикс из справочника", () => {
        expect(isKnownPrefix("TSTT", PREFIXES)).toBe(false);
        expect(isKnownPrefix("", PREFIXES)).toBe(false);
    });
});

describe("checkPrefixes", () => {
    it("TSTT234501 помечается как неизвестный префикс", () => {
        const issues = checkPrefixes([{ number: "TSTT234501", rangeId: "r1" }], PREFIXES);
        expect(issues).toHaveLength(1);
        expect(issues[0].reason).toBe("unknown-prefix");
        expect(issues[0].prefix).toBe("TSTT");
        expect(issues[0].message).toContain("не из справочника");
    });

    it("нормальные пробы проходят, включая шифрованные", () => {
        expect(
            checkPrefixes(
                [
                    { number: "TST1234501", rangeId: "a" },
                    { number: "TAA-A34076001-031", rangeId: "b" },
                ],
                PREFIXES,
            ),
        ).toEqual([]);
    });

    it("номер без букв — отдельная причина", () => {
        const issues = checkPrefixes([{ number: "1234501", rangeId: "r" }], PREFIXES);
        expect(issues[0].reason).toBe("no-prefix");
    });

    it("без справочника не проверяем, пустой вход безопасен", () => {
        expect(checkPrefixes([{ number: "TSTT234501", rangeId: "r" }], [])).toEqual([]);
        expect(checkPrefixes([], PREFIXES)).toEqual([]);
    });

    it("дубли одного номера в строке не размножаются", () => {
        const issues = checkPrefixes(
            [
                { number: "TSTT234501", rangeId: "r" },
                { number: "tstt234501", rangeId: "r" },
                { number: "TSTT234502", rangeId: "r" },
            ],
            PREFIXES,
        );
        expect(issues).toHaveLength(2);
    });
});