/**
 * Хранилище JWT-токенов.
 *
 * Использует localStorage (не cookies) — MVP. Позже можно перейти
 * на httpOnly cookies при появлении backend-эндпоинтов.
 */

const ACCESS_KEY = "wms_access_token";
const REFRESH_KEY = "wms_refresh_token";

function safeLocalStorage(): Storage | null {
    if (typeof window === "undefined") return null;
    return window.localStorage;
}

export const tokenStorage = {
    getAccess(): string | null {
        return safeLocalStorage()?.getItem(ACCESS_KEY) ?? null;
    },

    getRefresh(): string | null {
        return safeLocalStorage()?.getItem(REFRESH_KEY) ?? null;
    },

    set(access: string, refresh: string): void {
        const ls = safeLocalStorage();
        if (!ls) return;
        ls.setItem(ACCESS_KEY, access);
        ls.setItem(REFRESH_KEY, refresh);
    },

    setAccess(access: string): void {
        safeLocalStorage()?.setItem(ACCESS_KEY, access);
    },

    clear(): void {
        const ls = safeLocalStorage();
        if (!ls) return;
        ls.removeItem(ACCESS_KEY);
        ls.removeItem(REFRESH_KEY);
    },
};