/**
 * Zustand-стор аутентификации.
 *
 * Состояние:
 * - user — текущий пользователь (null, пока не загружен).
 * - isAuthenticated — есть ли валидный пользователь.
 * - isLoading — идёт ли запрос (login / logout).
 * - isBootstrapping — идёт ли первичная проверка токена при старте.
 * - error — текст ошибки логина.
 *
 * Действия:
 * - login(username, password) — логин + сразу fetchMe.
 * - logout() — вызов backend + очистка.
 * - bootstrap() — проверка токена при старте приложения.
 */
import { create } from "zustand";

import {
    fetchMe,
    login as apiLogin,
    logout as apiLogout,
    tokenStorage,
    type User,
} from "../api";

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isBootstrapping: boolean;
    error: string | null;
    login: (username: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    bootstrap: () => Promise<void>;
    clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    isBootstrapping: true,
    error: null,

    async login(username, password) {
        set({ isLoading: true, error: null });
        try {
            await apiLogin({ username, password });
            const user = await fetchMe();
            set({ user, isAuthenticated: true, isLoading: false });
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Ошибка входа.";
            set({ isLoading: false, error: message, user: null, isAuthenticated: false });
            throw err;
        }
    },

    async logout() {
        set({ isLoading: true });
        try {
            await apiLogout();
        } finally {
            set({ user: null, isAuthenticated: false, isLoading: false, error: null });
        }
    },

    async bootstrap() {
        const access = tokenStorage.getAccess();
        if (!access) {
            set({ isAuthenticated: false, user: null, isBootstrapping: false });
            return;
        }
        try {
            const user = await fetchMe();
            set({ user, isAuthenticated: true, isBootstrapping: false });
        } catch {
            tokenStorage.clear();
            set({ user: null, isAuthenticated: false, isBootstrapping: false });
        }
    },

    clearError() {
        set({ error: null });
    },
}));