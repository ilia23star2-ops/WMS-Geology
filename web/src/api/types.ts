/**
 * Общие типы API.
 */

export interface LoginPayload {
    username: string;
    password: string;
}

export interface LoginResponse {
    access: string;
    refresh: string;
}

export interface RefreshResponse {
    access: string;
}

export interface User {
    id: number;
    username: string;
    email: string;
    full_name: string;
    role: string | null;
}

/**
 * Обёртка пагинации DRF (PageNumberPagination).
 */
export interface PaginatedResponse<T> {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
}

/**
 * Стандартная ошибка DRF: `{"detail": "..."}` или по полям.
 * Формат в API.md (`{error: {...}}`) — на будущее, сейчас
 * используем реальный ответ DRF.
 */
export type ApiError = Record<string, unknown>;