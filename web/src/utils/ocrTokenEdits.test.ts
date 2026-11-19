import { describe, expect, it } from "vitest";

import type { OcrWord } from "../api/ocr";
import type { RangeEntry } from "../components/ocr/RangesTable";
import {
    applyWordEdits,
    cleanEditText,
    collectWordEdits,
    numbersOf,
    planSampleEdit,
    withoutEdit,
} from "./ocrTokenEdits";

function word(text: string, y = 0): OcrWord {
    return {
        text,
        confidence: 0.9,
        bbox: [[0, y], [100, y], [100, y + 20], [0, y + 20]],
    };
}

function range(over: Partial<RangeEntry> = {}): RangeEntry {
    return {
        id: "r1",
        rawInput: "TST11234506",
        prefix: "TST",
        middle: "11234",
        sequenceFrom: 506,
        sequenceTo: 506,
        sequenceDigits: 3,
        wellName: null,
        allSeqs: [506],
        skippedSeqs: [],
        selectedSeqs: [],
        ...over,
    };
}

const FIXED = numbersOf({
    prefix: "TST",
    middle: "1234",
    sequenceFrom: 506,
    sequenceTo: 506,
    sequenceDigits: 3,
});

describe("cleanEditText", () => {
    it("обрезает края, внутреннее не трогает", () => {
        expect(cleanEditText("  TST 1234501  ")).toBe("TST 1234501");
    });
});

describe("applyWordEdits", () => {
    it("без правок возвращает тот же массив", () => {
        const words = [word("TST1234501")];
        expect(applyWordEdits(words, new Map())).toBe(words);
    });

    it("подменяет текст по индексу, bbox и confidence сохраняет", () => {
        const words = [word("TST 1234501"), word("TST1234502", 40)];
        const out = applyWordEdits(words, new Map([[0, "TST1234501"]]));
        expect(out[0].text).toBe("TST1234501");
        expect(out[0].bbox).toEqual(words[0].bbox);
        expect(out[1]).toBe(words[1]);
    });
});

describe("collectWordEdits", () => {
    it("только изменённые, по порядку индексов", () => {
        const words = [word("A"), word("B", 40), word("C", 80)];
        const edits = new Map([[2, "C1"], [0, "A"], [1, "B1"]]);
        expect(collectWordEdits(words, edits)).toEqual([
            { index: 1, original: "B", text: "B1" },
            { index: 2, original: "C", text: "C1" },
        ]);
    });
});

describe("withoutEdit", () => {
    it("убирает один индекс, исходную карту не мутирует", () => {
        const edits = new Map([[0, "X"], [1, "Y"]]);
        const next = withoutEdit(edits, 0);
        expect(next.get(0)).toBeUndefined();
        expect(edits.get(0)).toBe("X");
    });
});

describe("planSampleEdit", () => {
    it("пробы с таким токеном нет → добавить", () => {
        const plan = planSampleEdit([range({ id: "other", rawInput: "TST1234501", middle: "1234", sequenceFrom: 501, sequenceTo: 501, allSeqs: [501] })], "TST9999506", FIXED);
        expect(plan.kind).toBe("add");
    });

    it("строка из префилла с тем же токеном → обновить её, не плодить вторую", () => {
        const wrong = range();
        const plan = planSampleEdit([wrong], "TST11234506", FIXED);
        expect(plan.kind).toBe("update");
        if (plan.kind === "update") {
            expect(plan.targetId).toBe("r1");
            expect(plan.before).toBe(wrong);
        }
    });

    it("исправленный номер уже в другой строке → лишнюю удалить", () => {
        const wrong = range();
        const right = range({ id: "r2", rawInput: "TST1234506", middle: "1234" });
        const plan = planSampleEdit([wrong, right], "TST11234506", FIXED);
        expect(plan.kind).toBe("remove");
        if (plan.kind === "remove") expect(plan.targetId).toBe("r1");
    });

    it("источника нет, номер уже есть → ничего не делать", () => {
        const right = range({ id: "r2", rawInput: "TST1234506", middle: "1234" });
        expect(planSampleEdit([right], "TST11234506", FIXED).kind).toBe("none");
    });

    it("повторная правка того же слова бьёт по своей строке (preferredId)", () => {
        const edited = range({ rawInput: "TST1234506", middle: "1234" });
        const plan = planSampleEdit([edited], "TST11234506", FIXED, "r1");
        expect(plan.kind).toBe("update");
    });

    it("список не мутируется", () => {
        const rows = [range()];
        planSampleEdit(rows, "TST11234506", FIXED);
        expect(rows).toHaveLength(1);
        expect(rows[0].rawInput).toBe("TST11234506");
    });
});