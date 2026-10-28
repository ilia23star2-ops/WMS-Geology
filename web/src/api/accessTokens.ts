/**
 * API токенов доступа (3.x-offline-auth-b).
 *
 * - AccessToken (`web_login` / `offline`) — QR / raw.
 * - codeLogin — вход по одноразовому коду (web).
 * - offlineLogin — обмен offline-токена на JWT (mobile).
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import { tokenStorage } from "./tokenStorage";
import type { LoginResponse } from "./types";

export type AccessTokenPurpose = "web_login" | "offline";

export interface AccessToken {
    id: number;
    user: number;
    username: string;
    purpose: AccessTokenPurpose;
    purpose_display: string;
    device_id: string;
    expires_at: string;
    used_at: string | null;
    revoked_at: string | null;
    is_active: boolean;
    created_by: number | null;
    created_by_username: string | null;
    created_at: string;
}

export interface AccessTokenCreateResponse extends AccessToken {
    /** Raw показывается один раз. */
    raw_token: string;
    /** SVG QR (готовый к рендеру). */
    qr_svg: string;
}

// ------------------------------------------------------------
// Список
// ------------------------------------------------------------
export async function fetchAccessTokens(): Promise<AccessToken[]> {
    const { data } = await apiClient.get<AccessToken[]>(
        "/auth/access-tokens/",
    );
    return data;
}

export function useAccessTokens() {
    return useQuery({
        queryKey: ["access-tokens"],
        queryFn: fetchAccessTokens,
        placeholderData: keepPreviousData,
        staleTime: 10_000,
    });
}

// ------------------------------------------------------------
// Создание
// ------------------------------------------------------------
export interface CreateAccessTokenRequest {
    purpose: AccessTokenPurpose;
    user_id?: number | null;
}

export async function createAccessToken(
    payload: CreateAccessTokenRequest,
): Promise<AccessTokenCreateResponse> {
    const { data } = await apiClient.post<AccessTokenCreateResponse>(
        "/auth/access-tokens/",
        payload,
    );
    return data;
}

export function useCreateAccessToken() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createAccessToken,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["access-tokens"] });
        },
    });
}

// ------------------------------------------------------------
// Отзыв
// ------------------------------------------------------------
export async function revokeAccessToken(id: number): Promise<AccessToken> {
    const { data } = await apiClient.post<AccessToken>(
        `/auth/access-tokens/${id}/revoke/`,
    );
    return data;
}

export function useRevokeAccessToken() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: revokeAccessToken,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["access-tokens"] });
        },
    });
}

// ------------------------------------------------------------
// Вход по коду (web)
// ------------------------------------------------------------
export async function codeLogin(code: string): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(
        "/auth/code-login/",
        { code },
    );
    tokenStorage.set(data.access, data.refresh);
    return data;
}

// ------------------------------------------------------------
// Офлайн-вход (mobile использует это же, но напрямую через mobile-клиент;
// для web это не нужно, оставлено для симметрии)
// ------------------------------------------------------------
export interface OfflineLoginRequest {
    token: string;
    device_id: string;
}

export async function offlineLogin(
    payload: OfflineLoginRequest,
): Promise<LoginResponse> {
    const { data } = await apiClient.post<LoginResponse>(
        "/auth/offline-login/",
        payload,
    );
    return data;
}