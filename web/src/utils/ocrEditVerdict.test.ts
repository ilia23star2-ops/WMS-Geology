import { describe, expect, it } from "vitest";

import { classifyEdit, needsConfirmation, oneEditApart } from "./ocrEditVerdict";
import { checkReadiness, type ReadinessInput } from "./ocrReadiness";

function input(over: Partial<ReadinessInput> = {}): ReadinessInput {
    return {
        siteName: "TST — Тестовый участок",
        researchTypeName: "ICP — ICP",
        workOrderCoded: "TST1234",
        containerTypeName: "Коробка",
        containerNumber: "1",
        photoContainerNumber: "1",
        rangesCount: 9,
        missingCount: 0,
        anomalyCount: 0,
        ...over,
    };
}

describe("oneEditApart", () => {
    it("вставка и удаление считаются, замена — нет", () => {
        expect(oneEditApart("TST11234506", "TST1234506")).toBe(true);
        expect(oneEditApart("TST1234506", "TST11234506")).toBe(true);
        expect(oneEditApart("TST1234506", "TST1234507")).toBe(false);
    });
});

describe("classifyEdit", () => {
    it("вернули как было (регистр/пробелы) → restored", () => {
        const v = classifyEdit("TST1234506", " tst1234506 ", true);
        expect(v.kind).toBe("restored");
        expect(needsConfirmation(v)).toBe(false);
    });

    it("O вместо нуля → confusable, подтверждение не нужно", () => {
        const v = classifyEdit("TST12345O6", "TST1234506", true);
        expect(v.kind).toBe("confusable");
        expect(v.severity).toBe("info");
    });

    it("лишняя цифра убрана → ocr-fix", () => {
        const v = classifyEdit("TST11234506", "TST1234506", true);
        expect(v.kind).toBe("ocr-fix");
        expect(needsConfirmation(v)).toBe(false);
    });

    it("правильная проба испорчена заменой цифры → divergent и требует подтверждения", () => {
        const v = classifyEdit("TST1234506", "TST1234507", true);
        expect(v.kind).toBe("divergent");
        expect(v.severity).toBe("error");
        expect(needsConfirmation(v)).toBe(true);
        expect(v.message).toContain("это другая проба");
    });

    it("другая скважина → divergent", () => {
        expect(classifyEdit("TST1234506", "TST5678506", true).kind).toBe("divergent");
    });

    it("номер не разобрался → unparsed, warning", () => {
        const v = classifyEdit("TST1234506", "мусор", false);
        expect(v.kind).toBe("unparsed");
        expect(v.severity).toBe("warning");
    });
});

describe("готовность с неподтверждёнными правками", () => {
    it("есть расхождение с фото без подтверждения → блокер", () => {
        const r = checkReadiness(input({ unconfirmedEditCount: 1 }));
        expect(r.blockers).toBeGreaterThan(0);
        expect(r.ready).toBe(false);
        const item = r.items.find((x) => x.key === "edits_confirmed");
        expect(item?.ok).toBe(false);
        expect(item?.required).toBe(true);
    });

    it("все правки подтверждены → готово", () => {
        const r = checkReadiness(input({ unconfirmedEditCount: 0 }));
        expect(r.blockers).toBe(0);
        expect(r.ready).toBe(true);
    });
});