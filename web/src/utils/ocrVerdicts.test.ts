import { expect, test } from "vitest";

import { verdictHint, type ZoneVerdict } from "./ocrVerdicts";

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