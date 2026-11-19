import { describe, expect, it } from "vitest";

import { parseContainerDeepLink, stripContainerDeepLink } from "./containerDeepLink";

describe("parseContainerDeepLink", () => {
    it("open имеет приоритет и разбирается в число", () => {
        expect(parseContainerDeepLink(new URLSearchParams("open=42&highlight=7"))).toBe(42);
    });

    it("устаревший highlight поддержан", () => {
        expect(parseContainerDeepLink(new URLSearchParams("highlight=7"))).toBe(7);
    });

    it("мусор и отсутствие параметра дают null", () => {
        expect(parseContainerDeepLink(new URLSearchParams(""))).toBeNull();
        expect(parseContainerDeepLink(new URLSearchParams("open=abc"))).toBeNull();
        expect(parseContainerDeepLink(new URLSearchParams("open=0"))).toBeNull();
    });
});

describe("stripContainerDeepLink", () => {
    it("убирает оба ключа, остальные сохраняет", () => {
        const next = stripContainerDeepLink(new URLSearchParams("open=42&highlight=7&page=2"));
        expect(next.get("open")).toBeNull();
        expect(next.get("highlight")).toBeNull();
        expect(next.get("page")).toBe("2");
    });
});
