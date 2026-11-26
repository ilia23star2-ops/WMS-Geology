import { describe, expect, it } from "vitest";
import { parseWmsg } from "./wmsgParse";

describe("parseWmsg", () => {
    it("разбирает код ячейки", () => {
        expect(parseWmsg("WMSG:CELL:12")).toEqual({ type: "CELL", id: 12 });
    });

    it("разбирает код секции", () => {
        expect(parseWmsg("WMSG:SECTION:2")).toEqual({ type: "SECTION", id: 2 });
    });

    it("отклоняет мусор и плохой id", () => {
        expect(parseWmsg("мусор")).toBeNull();
        expect(parseWmsg("WMSG:CELL:0")).toBeNull();
        expect(parseWmsg("WMSG:UNKNOWN:1")).toBeNull();
    });
});