import { describe, expect, it } from "vitest";

import type { OcrWord } from "../api/ocr";
import { auditSamples, type AuditRange } from "./ocrSampleAudit";
import { checkReadiness, type ReadinessInput } from "./ocrReadiness";

const VP = ["TST"];

function word(text: string, y = 0): OcrWord {
    return {
        text,
        confidence: 0.9,
        bbox: [[0, y], [100, y], [100, y + 20], [0, y + 20]],
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

function readinessInput(over: Partial<ReadinessInput> = {}): ReadinessInput {
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

describe("fix6: обратный аудит и дубли", () => {
    it("проба списка не найдена на фото → notOnPhotoIds", () => {
        const audit = auditSamples(
            [word("TST1234501")],
            [range(), range({ id: "other", middle: "5678" })],
            VP,
        );
        expect(audit.notOnPhotoIds).toEqual(["other"]);
    });

    it("все пробы списка есть на фото → notOnPhotoIds пусто", () => {
        const audit = auditSamples(
            [word("TST1234501", 0), word("TST1234502", 40)],
            [range({ sequenceFrom: 501, sequenceTo: 502 })],
            VP,
        );
        expect(audit.notOnPhotoIds).toEqual([]);
    });

    it("одинаковый номер в двух строках → duplicateNumbers и обе строки", () => {
        const audit = auditSamples(
            [word("TST1234506")],
            [
                range({ id: "a", sequenceFrom: 506, sequenceTo: 506 }),
                range({ id: "b", sequenceFrom: 506, sequenceTo: 506 }),
            ],
            VP,
        );
        expect(audit.duplicateNumbers).toEqual(["TST1234506"]);
        expect(audit.duplicateIds).toEqual(["a", "b"]);
    });

    it("готовность: дубль → блокер и не готов", () => {
        const r = checkReadiness(readinessInput({ duplicateCount: 1 }));
        expect(r.blockers).toBeGreaterThan(0);
        expect(r.ready).toBe(false);
    });

    it("готовность: нет на фото → замечание без блокера, но не готов", () => {
        const r = checkReadiness(readinessInput({ notOnPhotoCount: 1 }));
        expect(r.blockers).toBe(0);
        expect(r.ready).toBe(false);
        expect(r.warnings).toBeGreaterThan(0);
    });
});