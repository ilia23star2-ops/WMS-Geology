/**
 * Тесты authStore: bootstrap — логика без сети, API замокан.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../api", () => ({
    fetchMe: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    tokenStorage: {
        getAccess: vi.fn(),
        getRefresh: vi.fn(),
        set: vi.fn(),
        setAccess: vi.fn(),
        clear: vi.fn(),
    },
}));

import { fetchMe, tokenStorage } from "../api";
import { useAuthStore } from "./authStore";

const mockedFetchMe = vi.mocked(fetchMe);
const mockedGetAccess = vi.mocked(tokenStorage.getAccess);
const mockedClear = vi.mocked(tokenStorage.clear);

function resetStore() {
    useAuthStore.setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        isBootstrapping: true,
        error: null,
    });
}

describe("authStore.bootstrap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetStore();
    });

    it("без токена — не авторизован, isBootstrapping=false, без запроса", async () => {
        mockedGetAccess.mockReturnValue(null);
        await useAuthStore.getState().bootstrap();
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isBootstrapping).toBe(false);
        expect(mockedFetchMe).not.toHaveBeenCalled();
    });

    it("с токеном и успешным /me — авторизован", async () => {
        mockedGetAccess.mockReturnValue("token");
        mockedFetchMe.mockResolvedValue({
            id: 1,
            username: "user",
            email: "",
            full_name: "Иван",
            role: "manager",
        });
        await useAuthStore.getState().bootstrap();
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(true);
        expect(state.isBootstrapping).toBe(false);
        expect(state.user?.username).toBe("user");
    });

    it("с токеном, но /me упал — токен очищен, isBootstrapping=false", async () => {
        mockedGetAccess.mockReturnValue("token");
        mockedFetchMe.mockRejectedValue(new Error("401"));
        await useAuthStore.getState().bootstrap();
        const state = useAuthStore.getState();
        expect(state.isAuthenticated).toBe(false);
        expect(state.isBootstrapping).toBe(false);
        expect(mockedClear).toHaveBeenCalled();
    });
});