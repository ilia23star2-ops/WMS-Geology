import { describe, expect, it } from "vitest";

import type { OcrWord, OcrZone } from "../api/ocr";
import {
    containerAliases,
    extractFromZones,
    joinZoneText,
    looksLikeSample,
    normalizeSampleToken,
    parseContainerLabel,
    pickScalar,
    wordsInZone,
} from "./zoneExtract";

const TYPES = ["Ящик", "Коробка", "Паллет"];

function word(text: string, x: number, y: number, w = 60, h = 20): OcrWord {
    return {
        text,
        confidence: 0.9,
        bbox: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
    };
}

function zone(type: OcrZone["type"], x: number, y: number, w: number, h: number): OcrZone {
    return {
        type,
        bbox: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]],
        source: "manual",
    };
}

describe("wordsInZone", () => {
    it("берёт слова, центр которых внутри зоны", () => {
        const words = [word("1", 100, 100), word("далеко", 900, 700)];
        const hits = wordsInZone(words, [[90, 90], [180, 90], [180, 130], [90, 130]]);
        expect(hits.map((h) => h.text)).toEqual(["1"]);
        expect(hits[0].index).toBe(0);
    });

    it("пустой или вырожденный bbox даёт пустой список", () => {
        expect(wordsInZone([word("1", 10, 10)], [])).toEqual([]);
        expect(wordsInZone([word("1", 10, 10)], [[0, 0], [5, 5]])).toEqual([]);
    });
});

describe("joinZoneText", () => {
    it("строки сверху вниз, слова слева направо", () => {
        const words = [
            word("Тестовый", 200, 100),
            word("участок", 320, 102),
            word("верх", 200, 40),
        ];
        const hits = wordsInZone(words, [[0, 0], [600, 0], [600, 200], [0, 200]]);
        expect(joinZoneText(hits)).toBe("верх Тестовый участок");
    });

    it("пустой набор → пустая строка", () => {
        expect(joinZoneText([])).toBe("");
    });
});

describe("pickScalar", () => {
    it("number вытаскивает цифры из мусора", () => {
        expect(pickScalar("№ 1", "number")).toBe("1");
        expect(pickScalar("N-007", "number")).toBe("007");
        expect(pickScalar("без цифр", "number")).toBeNull();
    });

    it("order берёт токен формата Н/З", () => {
        expect(pickScalar("Н/З TST1234", "order")).toBe("TST1234");
        expect(pickScalar("просто текст", "order")).toBeNull();
    });

    it("code берёт буквенный токен типа исследования", () => {
        expect(pickScalar("Исп: ICP", "code")).toBe("ICP");
    });

    it("text отдаёт всю строку зоны", () => {
        expect(pickScalar("  TST — Тестовый участок ", "text")).toBe("TST — Тестовый участок");
    });
});

describe("номера проб", () => {
    it("O и l в хвосте приводятся к цифрам", () => {
        expect(normalizeSampleToken("tst12345O6")).toBe("TST1234506");
        expect(normalizeSampleToken("TST12345l6")).toBe("TST1234516");
    });

    it("отличает пробу от прочих токенов", () => {
        expect(looksLikeSample("TST1234501")).toBe(true);
        expect(looksLikeSample("TAA-A34076001-031")).toBe(true);
        expect(looksLikeSample("ICP")).toBe(false);
        expect(looksLikeSample("1")).toBe(false);
    });
});

describe("сокращения типов тары", () => {
    it("строятся из имени справочника", () => {
        expect(containerAliases("Ящик")).toEqual(expect.arrayContaining(["Я", "ЯЩ", "ЯЩИ", "ЯЩИК"]));
        expect(containerAliases("Коробка")).toEqual(expect.arrayContaining(["К", "КО", "КОР"]));
        expect(containerAliases("")).toEqual([]);
    });
});

describe("parseContainerLabel", () => {
    it("просто число и число с №", () => {
        expect(parseContainerLabel("1", TYPES)).toEqual({ containerType: null, containerNumber: "1" });
        expect(parseContainerLabel("№ 12", TYPES)).toEqual({ containerType: null, containerNumber: "12" });
    });

    it("сокращение типа слитно и с любыми разделителями", () => {
        for (const raw of ["Ящ.1", "Я1", "ящ 1", "ящ,1", "ЯЩ-1", "Ящик № 1", "ЯЩ—1"]) {
            expect(parseContainerLabel(raw, TYPES)).toEqual({
                containerType: "Ящик",
                containerNumber: "1",
            });
        }
    });

    it("номер перед сокращением тоже понимается", () => {
        expect(parseContainerLabel("1 ящ", TYPES)).toEqual({
            containerType: "Ящик",
            containerNumber: "1",
        });
    });

    it("другие типы тары из справочника", () => {
        expect(parseContainerLabel("кор.7", TYPES).containerType).toBe("Коробка");
        expect(parseContainerLabel("П3", TYPES).containerType).toBe("Паллет");
    });

    it("неизвестное сокращение не угадывается, номер остаётся", () => {
        expect(parseContainerLabel("XYZ5", TYPES)).toEqual({
            containerType: null,
            containerNumber: "5",
        });
    });

    it("мусор и пустая строка безопасны", () => {
        expect(parseContainerLabel("", TYPES)).toEqual({ containerType: null, containerNumber: null });
        expect(parseContainerLabel("без номера", TYPES).containerNumber).toBeNull();
    });
});

describe("extractFromZones", () => {
    it("заполняет поля по типам зон", () => {
        const words = [
            word("TST1234", 100, 40),
            word("1", 100, 100),
            word("ICP", 100, 160),
            word("Тестовый", 100, 220),
            word("участок", 220, 222),
        ];
        const zones = [
            zone("work_order_coded", 80, 30, 200, 40),
            zone("container_number", 80, 90, 200, 40),
            zone("research_type", 80, 150, 200, 40),
            zone("site", 80, 210, 300, 40),
        ];
        const out = extractFromZones(words, zones, TYPES);
        expect(out.work_order_coded).toBe("TST1234");
        expect(out.container_number).toBe("1");
        expect(out.research_type).toBe("ICP");
        expect(out.site).toBe("Тестовый участок");
    });

    it("из «Ящ.1» достаёт и тип тары, и номер", () => {
        const words = [word("Ящ.1", 100, 100, 70)];
        const out = extractFromZones(words, [zone("container_number", 80, 90, 200, 40)], TYPES);
        expect(out.container_type).toBe("Ящик");
        expect(out.container_number).toBe("1");
    });

    it("собирает пробы из зоны проб без дублей", () => {
        const words = [
            word("TST1234501", 100, 300),
            word("TST12345O2", 100, 340),
            word("TST1234501", 100, 380),
            word("ICP", 100, 420),
        ];
        const out = extractFromZones(words, [zone("sample", 80, 290, 300, 160)]);
        expect(out.samples).toEqual(["TST1234501", "TST1234502"]);
    });

    it("без зон всё пусто", () => {
        const out = extractFromZones([word("TST1234", 10, 10)], []);
        expect(out.container_number).toBeNull();
        expect(out.container_type).toBeNull();
        expect(out.samples).toEqual([]);
    });
});