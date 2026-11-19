import { describe, expect, it } from "vitest";

import {
    checkReadiness,
    readinessByKey,
    readinessSummary,
    type ReadinessInput,
} from "./ocrReadiness";

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

describe("readinessByKey", () => {
    it("даёт пункт по ключу для inline-подсказки", () => {
        const map = readinessByKey(checkReadiness(input({ containerNumber: "2" })));
        expect(map.container_number.ok).toBe(true);
        expect(map.container_number_photo.ok).toBe(false);
        expect(map.container_number_photo.hint).toBe("на фото 1, введено 2");
    });
});

describe("readinessSummary", () => {
    it("есть блокер → error и счётчики", () => {
        const s = readinessSummary(checkReadiness(input({ duplicateCount: 1 })));
        expect(s.tone).toBe("error");
        expect(s.blockers).toHaveLength(1);
        expect(s.text).toContain("обязательных: 1");
    });

    it("только замечания → warning, подтвердить можно", () => {
        const s = readinessSummary(checkReadiness(input({ notOnPhotoCount: 1 })));
        expect(s.tone).toBe("warning");
        expect(s.blockers).toHaveLength(0);
        expect(s.text).toContain("замечаний: 1");
    });

    it("всё чисто → success", () => {
        const s = readinessSummary(checkReadiness(input()));
        expect(s.tone).toBe("success");
        expect(s.warnings).toHaveLength(0);
        expect(s.text).toBe("Готово к подтверждению");
    });
});