import { describe, expect, it } from "vitest";

import type { OcrWord } from "../api/ocr";
import {
    auditSamples,
    linkSampleWords,
    type AuditRange,
} from "./ocrSampleAudit";

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

describe("linkSampleWords", () => {
    const good = range({ id: "ok", sequenceFrom: 501, sequenceTo: 502 });
    const bad = range({
        id: "bad",
        middle: "11234",
        sequenceFrom: 506,
        sequenceTo: 506,
    });

    it("слово связано со своей строкой → covered", () => {
        const links = linkSampleWords([word("TST1234501")], [good, bad], ["bad"], VP);
        expect(links).toHaveLength(1);
        expect(links[0].rangeId).toBe("ok");
        expect(links[0].status).toBe("covered");
    });

    it("неисправленный номер привязан к аномальной строке", () => {
        const links = linkSampleWords([word("TST11234506")], [good, bad], ["bad"], VP);
        expect(links[0].rangeId).toBe("bad");
        expect(links[0].status).toBe("anomaly");
    });

    it("пробы нет в списке → rangeId null, missing", () => {
        const links = linkSampleWords([word("TST1234510")], [good], [], VP);
        expect(links[0].rangeId).toBeNull();
        expect(links[0].status).toBe("missing");
    });

    it("заголовки и Н/З не линкуются", () => {
        const links = linkSampleWords(
            [word("Образец"), word("TST1234")],
            [good],
            [],
            VP,
        );
        expect(links).toEqual([]);
    });

    it("после правки号码 слово покрыто и не попадает в missing", () => {
        const fixed = [good, range({ id: "bad", sequenceFrom: 506, sequenceTo: 506 })];
        const words = [word("TST11234506")];
        const audit = auditSamples(words, fixed, VP);
        expect(audit.missing).toEqual([]);
        const links = linkSampleWords(words, fixed, audit.anomalyIds, VP);
        expect(links[0].status).toBe("covered");
        expect(links[0].rangeId).toBe("bad");
    });
});