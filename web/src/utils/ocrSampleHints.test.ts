import { describe, expect, it } from "vitest";

import {
    bestWordMatch,
    canonNumber,
    confusableEqual,
    findSimilarHints,
    oneEditApart,
} from "./ocrSampleHints";

describe("canonNumber", () => {
    it("убирает пробелы, точки, дефисы и поднимает регистр", () => {
        expect(canonNumber(" tst-1234.501 ")).toBe("TST1234501");
        expect(canonNumber("")).toBe("");
    });
});

describe("confusableEqual", () => {
    it("T вместо 1 — та же проба (случай TSTT234501)", () => {
        expect(confusableEqual("TSTT234501", "TST1234501")).toBe(true);
    });

    it("O вместо нуля и l вместо единицы", () => {
        expect(confusableEqual("TST12345O6", "TST1234506")).toBe(true);
        expect(confusableEqual("TST12345l6", "TST1234516")).toBe(true);
    });

    it("разная длина и разные номера — не совпадение", () => {
        expect(confusableEqual("TST1234501", "TST11234501")).toBe(false);
        expect(confusableEqual("TST1234501", "TST5678501")).toBe(false);
        expect(confusableEqual("", "")).toBe(false);
    });
});

describe("oneEditApart", () => {
    it("вставка, удаление и замена считаются одним отличием", () => {
        expect(oneEditApart("TST11234506", "TST1234506")).toBe(true);
        expect(oneEditApart("TST1234506", "TST11234506")).toBe(true);
        expect(oneEditApart("TST1234506", "TST1234507")).toBe(true);
    });

    it("два отличия и точное совпадение — не подходит", () => {
        expect(oneEditApart("TST1234501", "TST5678502")).toBe(false);
        expect(oneEditApart("TST1234501", "TST1234501")).toBe(false);
    });
});

describe("bestWordMatch", () => {
    const words = ["Уч:", "TST1234", "TST1234501", "TST1234506"];

    it("точное совпадение в приоритете", () => {
        expect(bestWordMatch("TST1234506", words)).toBe(3);
    });

    it("номер с лишней буквой находит своё слово на фото", () => {
        expect(bestWordMatch("TSTT234501", words)).toBe(2);
    });

    it("лишний символ в номере тоже находит слово", () => {
        expect(bestWordMatch("TST11234506", words)).toBe(3);
    });

    it("незнакомый префикс — поиск по цифровому хвосту", () => {
        expect(bestWordMatch("XYZ1234501", words)).toBe(2);
    });

    it("не найдено и пустые входы безопасны", () => {
        expect(bestWordMatch("TST9999999", words)).toBe(-1);
        expect(bestWordMatch("", words)).toBe(-1);
        expect(bestWordMatch("TST1234501", [])).toBe(-1);
    });
});

describe("findSimilarHints", () => {
    it("недостающая проба находит похожую строку списка", () => {
        const hints = findSimilarHints(
            ["TST1234501"],
            [{ number: "TSTT234501", rangeId: "r-bad" }],
        );
        expect(hints).toHaveLength(1);
        expect(hints[0].kind).toBe("confusable");
        expect(hints[0].rangeId).toBe("r-bad");
        expect(hints[0].missing).toBe("TST1234501");
        expect(hints[0].candidate).toBe("TSTT234501");
        expect(hints[0].message).toContain("вероятно ошибка OCR");
    });

    it("лишняя цифра ловится как правка в один символ", () => {
        const hints = findSimilarHints(
            ["TST1234506"],
            [{ number: "TST11234506", rangeId: "r1" }],
        );
        expect(hints[0].kind).toBe("one-edit");
    });

    it("путаница символов приоритетнее правки в один символ", () => {
        const hints = findSimilarHints(
            ["TST1234501"],
            [
                { number: "TST1234502", rangeId: "edit" },
                { number: "TSTT234501", rangeId: "conf" },
            ],
        );
        expect(hints).toHaveLength(1);
        expect(hints[0].rangeId).toBe("conf");
    });

    it("непохожие номера и точные совпадения подсказок не дают", () => {
        expect(
            findSimilarHints(["TST1234501"], [{ number: "TST5678501", rangeId: "r" }]),
        ).toEqual([]);
        expect(
            findSimilarHints(["TST1234501"], [{ number: "TST1234501", rangeId: "r" }]),
        ).toEqual([]);
    });

    it("по одной подсказке на недостающий номер, пустые входы безопасны", () => {
        const hints = findSimilarHints(
            ["TST1234501", "TST1234506"],
            [
                { number: "TSTT234501", rangeId: "a" },
                { number: "TST11234506", rangeId: "b" },
            ],
        );
        expect(hints.map((h) => h.rangeId)).toEqual(["a", "b"]);
        expect(findSimilarHints([], [])).toEqual([]);
    });
});