import { expect, test } from "vitest";

import { parseVerdicts, verdictHint, type ZoneVerdict } from "./ocrVerdicts";

const make = (over: Partial<ZoneVerdict> = {}): ZoneVerdict => ({
    zone_type: "site",
    raw: "QQQ",
    canonical: "QQQ",
    value: null,
    resolved: false,
    needs_input: true,
    reason: "не найдено в справочнике",
    ...over,
});

test("подсказка при needs_input", () => {
    expect(verdictHint([make()], "site")).toBe("не найдено в справочнике");
});

test("без подсказки когда resolved", () => {
    expect(
        verdictHint([make({ needs_input: false, resolved: true, value: "TST" })], "site"),
    ).toBeNull();
});

test("без подсказки когда вердикта нет", () => {
    expect(verdictHint([], "site")).toBeNull();
});

test("reason пустой — дефолтный текст", () => {
    expect(verdictHint([make({ reason: "" })], "site")).toBe("не найдено в справочнике");
});

test("parseVerdicts: undefined даёт пустой список", () => {
    expect(parseVerdicts(undefined)).toEqual([]);
});

test("parseVerdicts: не-массив даёт пустой список", () => {
    expect(parseVerdicts("x")).toEqual([]);
});

test("parseVerdicts: фильтрует мусор без zone_type", () => {
    const got = parseVerdicts([make(), { foo: 1 }, null]);
    expect(got).toHaveLength(1);
    expect(got[0].zone_type).toBe("site");
});