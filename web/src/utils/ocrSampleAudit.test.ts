import { describe, expect, it } from "vitest";

import type { OcrWord } from "../api/ocr";
import {
    auditSamples,
    collectPhotoTokens,
    matchesSampleNumber,
    normalizeToken,
    rangeNumberSet,
    rangeNumbers,
    type AuditRange,
} from "./ocrSampleAudit";

const VP = ["TST"];

function word(text: string, x = 0, y = 0, w = 100, h = 20): OcrWord {
    return {
        text,
        confidence: 0.9,
        bbox: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
    };
}

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

describe("normalizeToken", () => {
    it("пробелы убираются, обычный TST-номер НЕ ломается", () => {
        expect(normalizeToken("TST 1234510", VP)).toBe("TST1234510");
        expect(normalizeToken("TST1234510", VP)).toBe("TST1234510");
        expect(normalizeToken("TST1234510")).toBe("TST1234510");
    });

    it("путаница сразу после валидного префикса и в хвосте", () => {
        expect(normalizeToken("TSTT234501", VP)).toBe("TST1234501");
        expect(normalizeToken("TSTI1234506", VP)).toBe("TST11234506");
        expect(normalizeToken("TSTl2345Ol", VP)).toBe("TST1234501");
    });
});

describe("collectPhotoTokens", () => {
    it("берёт пробы, игнорирует Н/З и мусор, дедуплицирует", () => {
        const words = [
            word("TST1234501", 0, 0),
            word("TST1234501", 200, 0),
            word("TST1234", 0, 40),
            word("Образец", 0, 80),
        ];
        expect(collectPhotoTokens(words, VP)).toEqual(["TST1234501"]);
    });

    it("ILLLILI не считается пробой", () => {
        expect(collectPhotoTokens([word("ILLLILI")], VP)).toEqual([]);
    });

    it("«TST 1234510» с пробелом распознаётся", () => {
        expect(collectPhotoTokens([word("TST 1234510")], VP)).toEqual([
            "TST1234510",
        ]);
    });

    it("соседние слова одной строки склеиваются", () => {
        const words = [word("TST", 0, 0, 40), word("1234510", 50, 0, 90)];
        expect(collectPhotoTokens(words, VP)).toEqual(["TST1234510"]);
    });
});

describe("rangeNumbers / rangeNumberSet", () => {
    it("номера с ведущими нулями, skipped исключаются", () => {
        const r = range({ sequenceFrom: 501, sequenceTo: 503, skippedSeqs: [502] });
        expect(rangeNumbers(r)).toEqual(["TST1234501", "TST1234503"]);
        expect(rangeNumberSet([r]).has("TST1234503")).toBe(true);
    });
});

describe("matchesSampleNumber", () => {
    it("точное совпадение и одна лишняя цифра после правки", () => {
        const set = rangeNumberSet([
            range({ sequenceFrom: 506, sequenceTo: 506 }),
        ]);
        expect(matchesSampleNumber("TST1234506", set, VP)).toBe(true);
        expect(matchesSampleNumber("TST11234506", set, VP)).toBe(true);
    });

    it("соседний номер (замена цифры) НЕ связывается", () => {
        const set = rangeNumberSet([
            range({ sequenceFrom: 506, sequenceTo: 506 }),
        ]);
        expect(matchesSampleNumber("TST1234507", set, VP)).toBe(false);
    });
});

describe("auditSamples", () => {
    it("проба на фото есть, в списке нет → missing", () => {
        const audit = auditSamples(
            [word("TST1234501", 0, 0), word("TST1234510", 0, 40)],
            [range()],
            VP,
        );
        expect(audit.missing).toEqual(["TST1234510"]);
    });

    it("кандидаты ранжируются: похожий на группу выше непохожего", () => {
        const audit = auditSamples(
            [word("TST9999510", 0, 0), word("TST1234510", 0, 40)],
            [range({ sequenceFrom: 501, sequenceTo: 505 })],
            VP,
        );
        expect(audit.missing[0]).toBe("TST1234510");
    });

    it("диапазон с другой базой → аномалия", () => {
        const audit = auditSamples([], [
            range({ id: "a", sequenceFrom: 501, sequenceTo: 502 }),
            range({ id: "b", sequenceFrom: 504, sequenceTo: 505 }),
            range({ id: "bad", middle: "11234", sequenceFrom: 506, sequenceTo: 506 }),
        ], VP);
        expect(audit.dominantBase).toBe("TST1234");
        expect(audit.anomalyIds).toEqual(["bad"]);
    });

    it("всё покрыто, одна группа → пусто", () => {
        const audit = auditSamples(
            [word("TST1234501", 0, 0), word("TST1234502", 0, 40)],
            [range({ sequenceFrom: 501, sequenceTo: 502 })],
            VP,
        );
        expect(audit.missing).toEqual([]);
        expect(audit.anomalyIds).toEqual([]);
    });

    it("единственный диапазон → аномалий нет", () => {
        expect(auditSamples([], [range({ middle: "11234" })], VP).anomalyIds).toEqual([]);
    });

    it("fix5: несколько скважин в одной таре — аномалий нет", () => {
        const audit = auditSamples([], [
            range({ id: "w1", middle: "1234", sequenceFrom: 501, sequenceTo: 503 }),
            range({ id: "w2", middle: "5678", sequenceFrom: 601, sequenceTo: 603 }),
            range({ id: "w3", middle: "9012", sequenceFrom: 701, sequenceTo: 702 }),
        ], VP);
        expect(audit.anomalyIds).toEqual([]);
    });

    it("fix5: OCR-сбой с лишней цифрой (TST11234506 против TST1234501..505) → аномалия", () => {
        const audit = auditSamples([], [
            range({ id: "g1", sequenceFrom: 501, sequenceTo: 503 }),
            range({ id: "g2", sequenceFrom: 504, sequenceTo: 505 }),
            range({ id: "ocr", middle: "11234", sequenceFrom: 506, sequenceTo: 506 }),
        ], VP);
        expect(audit.anomalyIds).toEqual(["ocr"]);
    });
});