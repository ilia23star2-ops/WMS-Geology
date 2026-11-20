import { describe, expect, it } from "vitest";

import { displayBatchName } from "./batchName";

describe("displayBatchName", () => {
    it("имя из сервера возвращается как есть", () => {
        expect(displayBatchName("A-01-02 2026-11-19", 24)).toBe("A-01-02 2026-11-19");
    });

    it("пустое/отсутствующее имя — fallback на id", () => {
        expect(displayBatchName("", 24)).toBe("Пакет #24");
        expect(displayBatchName(null, 24)).toBe("Пакет #24");
        expect(displayBatchName(undefined, 24)).toBe("Пакет #24");
        expect(displayBatchName("   ", 24)).toBe("Пакет #24");
    });
});