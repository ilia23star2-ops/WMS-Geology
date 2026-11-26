import { describe, expect, it } from "vitest";
import { buildSchemeRows } from "./schemeRows";
import type { Cell, Tier, TierCode } from "../api";

function tier(id: number, code: TierCode, level: number): Tier {
    return { id, section: 1, code, level_number: level, description: "" };
}

function cell(id: number, tierId: number, code: string, count: number): Cell {
    return {
        id,
        tier: tierId,
        code,
        full_address: `B4 / 1 / 1 / ${code} / 1`,
        cell_type: "STANDARD",
        qr_code: null,
        is_active: true,
        pallet_id: null,
        pallet_status: null,
        containers_count: count,
    };
}

describe("buildSchemeRows", () => {
    it("ярусы сверху вниз: D раньше A", () => {
        const rows = buildSchemeRows(
            [tier(1, "A", 1), tier(2, "D", 4)],
            [cell(10, 1, "1", 0)],
        );
        expect(rows.map((r) => r.label)).toEqual(["D", "A"]);
    });

    it("ячейки в строке по коду и только своего яруса", () => {
        const rows = buildSchemeRows(
            [tier(1, "A", 1)],
            [cell(11, 1, "10", 1), cell(12, 1, "2", 3), cell(13, 2, "1", 0)],
        );
        expect(rows[0].cells.map((c) => c.code)).toEqual(["2", "10"]);
    });
});