/** Скаляры и зоны не дают ложных проб (6e-2-web-7-web). */
import { describe, expect, it } from "vitest";

import type { OcrWord } from "../api/ocr";
import { auditSamples, collectPhotoTokens, linkSampleWords } from "./ocrSampleAudit";

function word(text: string, x: number, y: number): OcrWord {
    return {
        text,
        confidence: 0.9,
        bbox: [[x, y], [x + 90, y], [x + 90, y + 20], [x, y + 20]],
    };
}

const WORDS: OcrWord[] = [
    word("TST13209", 100, 40),
    word("TUT13209", 300, 40),
    word("TST13209001", 100, 200),
    word("TST13209002", 300, 200),
];

const SAMPLE_ZONE = {
    type: "sample",
    bbox: [[90, 190], [420, 190], [420, 230], [90, 230]],
};

describe("аудит проб: скаляры и зоны", () => {
    it("Н/З не считается пробой", () => {
        const tokens = collectPhotoTokens(WORDS, ["TST"], {
            scalars: ["TST13209"],
        });
        expect(tokens).not.toContain("TST13209");
        expect(tokens).toContain("TST13209001");
    });

    it("OCR-двойник префикса Н/З тоже исключается", () => {
        const tokens = collectPhotoTokens(WORDS, ["TST"], {
            scalars: ["TST13209"],
        });
        expect(tokens).not.toContain("TUT13209");
    });

    it("зоны sample ограничивают кандидатов", () => {
        const tokens = collectPhotoTokens(WORDS, ["TST"], {
            zones: [SAMPLE_ZONE],
        });
        expect(tokens).toEqual(["TST13209001", "TST13209002"]);
    });

    it("слова-скаляры не подсвечиваются как missing", () => {
        const links = linkSampleWords(WORDS, [], [], ["TST"], {
            scalars: ["TST13209"],
        });
        expect(links.map((l) => l.number)).toEqual([
            "TST13209001",
            "TST13209002",
        ]);
        const audit = auditSamples(WORDS, [], ["TST"], { scalars: ["TST13209"] });
        expect(audit.photoSamples).toHaveLength(2);
    });
});