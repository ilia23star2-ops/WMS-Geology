import { describe, expect, it } from "vitest";

import { approvedContainerId, type OcrTask } from "./ocr";

function makeTask(reviewed: Record<string, unknown> | null): OcrTask {
    return {
        id: 1,
        batch: 1,
        image: "",
        status: "DONE",
        raw_ocr_data: null,
        reviewed_data: reviewed,
        zones: null,
        error_message: "",
        created_at: "",
    };
}

describe("approvedContainerId", () => {
    it("reviewed_data = null → null", () => {
        expect(approvedContainerId(makeTask(null))).toBeNull();
    });

    it("числовой container_id → id", () => {
        expect(approvedContainerId(makeTask({ container_id: 215 }))).toBe(215);
    });

    it("отсутствует / не число / <= 0 → null", () => {
        expect(approvedContainerId(makeTask({}))).toBeNull();
        expect(approvedContainerId(makeTask({ container_id: "215" }))).toBeNull();
        expect(approvedContainerId(makeTask({ container_id: 0 }))).toBeNull();
    });
});