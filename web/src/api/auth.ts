/**
 * Методы аутентификации.
 */
import { apiClient } from "./client";
import { tokenStorage } from "./tokenStorage";
import type { LoginPayload, LoginResponse, User } from "./types";

/**
 * Логин: POST /api/v1/auth/login/
 * При успехе — сохраняет access + refresh в tokenStorage.
 */
export async function login(payload: LoginPayload): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(
        "/auth/login/",
        payload,
    );
    tokenStorage.set(data.access, data.refresh);
    return data;
}

/**
 * Логаут: POST /api/v1/auth/logout/ (blacklist refresh).
 * Локальные токены очищаются всегда, даже если backend упал.
 */
export async function logout(): Promise<void> {
    const refresh = tokenStorage.getRefresh();
    if (refresh) {
        try {
            await apiClient.post("/auth/logout/", { refresh });
        } catch {
            // Игнорируем — токены всё равно чистим.
        }
    }
    tokenStorage.clear();
}

/**
 * Текущий пользователь: GET /api/v1/auth/me/
 */
export async function fetchMe(): Promise<User> {
    const { data } = await apiClient.get<User>("/auth/me/");
    return data;
}