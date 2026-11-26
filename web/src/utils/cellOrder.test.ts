import { describe, expect, it } from "vitest";
import { orderCellsByCode, occupancyColor, OCCUPANCY_COLORS } from "./cellOrder";
import type { Cell } from "../api";

function cell(id: number, code: string): Cell {
    return {
        id,
        tier: 1,
        code,
        full_address: `B4 / 1 / 1 / A / ${code}`,
        cell_type: "STANDARD",
        qr_code: null,
        is_active: true,
        pallet_id: null,
        pallet_status: null,
        containers_count: 0,
    };
}

describe("orderCellsByCode", () => {
    it("числовой порядок: 2 раньше 10", () => {
        const ordered = orderCellsByCode([cell(1, "10"), cell(2, "2"), cell(3, "1")]);
        expect(ordered.map((c) => c.code)).toEqual(["1", "2", "10"]);
    });
});

describe("occupancyColor", () => {
    it("пусто → empty", () => {
        expect(occupancyColor(0)).toBe("empty");
    });

    it("есть тара без лимита → filled", () => {
        expect(occupancyColor(3)).toBe("filled");
    });

    it("70–99% лимита → near", () => {
        expect(occupancyColor(8, 10)).toBe("near");
    });

    it("100% и больше → full", () => {
        expect(occupancyColor(10, 10)).toBe("full");
        expect(occupancyColor(12, 10)).toBe("full");
    });
});

describe("OCCUPANCY_COLORS", () => {
    it("все состояния имеют цвет", () => {
        expect(Object.keys(OCCUPANCY_COLORS)).toEqual(["empty", "filled", "near", "full"]);
    });
});