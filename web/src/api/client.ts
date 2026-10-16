/**
 * Axios-клиент с JWT-интерцептором и авто-refresh.
 *
 * BaseURL: `/api/v1`. В dev — через Vite proxy на backend :8000.
 *
 * В dev-режиме (`import.meta.env.DEV`) логирует запросы и ответы
 * в консоль браузера. В prod — нет.
 */
import axios, {
    AxiosError,
    type AxiosInstance,
    type InternalAxiosRequestConfig,
} from "axios";

import { tokenStorage } from "./tokenStorage";
import type { RefreshResponse } from "./types";

interface RetriableRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

export const apiClient: AxiosInstance = axios.create({
    baseURL: "/api/v1",
    headers: { "Content-Type": "application/json" },
});

// Request: пробрасываем access-токен в Authorization.
apiClient.interceptors.request.use((config) => {
    const token = tokenStorage.getAccess();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Response: на 401 — refresh и повтор исходного запроса.
// Очередь: несколько параллельных 401 ждут один refresh.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
    const refresh = tokenStorage.getRefresh();
    if (!refresh) {
        throw new Error("Нет refresh-токена.");
    }
    const { data } = await axios.post<RefreshResponse>(
        "/api/v1/auth/refresh/",
        { refresh },
    );
    tokenStorage.setAccess(data.access);
    return data.access;
}

apiClient.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
        const original = error.config as RetriableRequestConfig | undefined;

        if (
            !original ||
            error.response?.status !== 401 ||
            original._retry
        ) {
            return Promise.reject(error);
        }

        original._retry = true;

        try {
            if (!refreshPromise) {
                refreshPromise = refreshAccessToken().finally(() => {
                    refreshPromise = null;
                });
            }
            const newAccess = await refreshPromise;
            original.headers.Authorization = `Bearer ${newAccess}`;
            return apiClient(original);
        } catch (refreshError) {
            tokenStorage.clear();
            return Promise.reject(refreshError);
        }
    },
);

// --- Dev-логирование (только `npm run dev`) ---
if (import.meta.env.DEV) {
    apiClient.interceptors.request.use((config) => {
        console.debug(
            `[api] → ${(config.method ?? "get").toUpperCase()} ${config.url ?? ""}`,
            config.params ?? config.data ?? "",
        );
        return config;
    });

    apiClient.interceptors.response.use(
        (response) => {
            console.debug(
                `[api] ← ${response.status} ${response.config.url ?? ""}`,
            );
            return response;
        },
        (error: AxiosError) => {
            const status = error.response?.status ?? "?";
            const url = error.config?.url ?? "";
            console.error(
                `[api] ✗ ${status} ${url}`,
                error.response?.data ?? error.message,
            );
            return Promise.reject(error);
        },
    );
}