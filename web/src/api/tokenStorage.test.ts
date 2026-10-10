/**
 * Тесты tokenStorage. localStorage замокан через vi.stubGlobal,
 * чтобы не тянуть jsdom в Vitest.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const memory: Record<string, string> = {};

const mockStorage: Storage = {
    getItem: (key: string) => memory[key] ?? null,
    setItem: (key: string, value: string) => {
        memory[key] = value;
    },
    removeItem: (key: string) => {
        delete memory[key];
    },
    clear: () => {
        for (const k of Object.keys(memory)) delete memory[k];
    },
    key: (index: number) => Object.keys(memory)[index] ?? null,
    get length() {
        return Object.keys(memory).length;
    },
};

vi.stubGlobal("localStorage", mockStorage);
vi.stubGlobal("window", { localStorage: mockStorage });

// Импорт после stubGlobal — важно.
import { tokenStorage } from "./tokenStorage";

describe("tokenStorage", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("возвращает null, если токенов нет", () => {
        expect(tokenStorage.getAccess()).toBeNull();
        expect(tokenStorage.getRefresh()).toBeNull();
    });

    it("сохраняет и читает access + refresh", () => {
        tokenStorage.set("access-1", "refresh-1");
        expect(tokenStorage.getAccess()).toBe("access-1");
        expect(tokenStorage.getRefresh()).toBe("refresh-1");
    });

    it("clear() удаляет оба токена", () => {
        tokenStorage.set("a", "b");
        tokenStorage.clear();
        expect(tokenStorage.getAccess()).toBeNull();
        expect(tokenStorage.getRefresh()).toBeNull();
    });
});