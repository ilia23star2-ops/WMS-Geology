/**
 * API импорта Excel-рейса и разбора вопросов `NEEDS_CONFIRMATION`.
 *
 * Эндпоинты:
 * - `POST /import-sessions/import-shipment/` — импорт рейса.
 * - `POST /import-sessions/{id}/resolve-questions/` — разбор вопросов.
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

/**
 * Вопрос по спорной ячейке (см. API.md → `import-shipment`).
 * Код `NEEDS_CONFIRMATION`, `reason` — один из трёх.
 */
export type ImportSessionStatus =
    | "PARSING"
    | "PARSED"
    | "ERROR"
    | "APPLIED";

export interface ImportSession {
    id: number;
    file: string | null;
    file_format: "XLSX" | "CSV";
    uploaded_at: string;
    uploaded_by: number | null;
    uploaded_by_username: string | null;
    status: ImportSessionStatus;
    parse_errors: ImportError[];
    receipt: number | null;
    receipt_number: string | null;
}

export type ImportQuestionReason =
    | "no_dates"
    | "multi_date_match"
    | "target_date_not_matched";

export interface ImportQuestion {
    code: "NEEDS_CONFIRMATION";
    reason: ImportQuestionReason;
    sheet: string;
    work_order: string;
    research_type: string;
    container_type: string;
    containers_count: number;
    raw_dates: string[];
    target_date?: string;
    message: string;
    /** Заполняется после разбора. */
    resolved?: boolean;
    resolved_at?: string;
    resolved_distribution?: ResolveDistributionItem[];
}

export interface ImportError {
    code?: string;
    sheet?: string;
    row?: number;
    column?: number;
    error?: string;
    work_order?: string;
    [key: string]: unknown;
}

export interface ImportShipmentRequest {
    file: File;
    target_date: string; // ISO или `DD.MM.YYYY`
    shipment_number?: string;
    laboratory_id?: number;
}

export interface ImportShipmentResponse {
    import_session_id: number;
    status: "APPLIED" | "PARSED" | "ERROR";
    shipment_id: number | null;
    shipment_number: string | null;
    receipt_id: number | null;
    receipt_number: string | null;
    containers_count: number;
    questions_count: number;
    parse_errors: ImportError[];
}

export async function importShipment(
    payload: ImportShipmentRequest,
): Promise<ImportShipmentResponse> {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("target_date", payload.target_date);
    if (payload.shipment_number) {
        form.append("shipment_number", payload.shipment_number);
    }
    if (payload.laboratory_id !== undefined) {
        form.append(
            "laboratory_id",
            String(payload.laboratory_id),
        );
    }

    const { data } = await apiClient.post<ImportShipmentResponse>(
        "/import-sessions/import-shipment/",
        form,
        {
            headers: { "Content-Type": "multipart/form-data" },
        },
    );
    return data;
}

export function useImportShipment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: importShipment,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["shipments"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["receipts"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["containers"],
            });
        },
    });
}

// ============================================================
// Разбор вопросов `NEEDS_CONFIRMATION`
// ============================================================

/**
 * Одна запись распределения тар: конкретная дата + количество.
 * Сумма по всем датам должна равняться `question.containers_count`.
 */
export interface ResolveDistributionItem {
    date: string; // YYYY-MM-DD
    containers_count: number;
}

/**
 * Разбор одного вопроса.
 * `question_index` — позиция вопроса в `ImportSession.parse_errors`.
 */
export interface ResolveQuestionItem {
    question_index: number;
    distribution: ResolveDistributionItem[];
}

export interface ResolveQuestionsRequest {
    resolutions: ResolveQuestionItem[];
}

export interface ResolveQuestionsResponse {
    import_session_id: number;
    status: "APPLIED" | "PARSED" | "ERROR";
    created_containers_count: number;
    resolved_questions_count: number;
    total_questions_count: number;
    errors: Array<Record<string, unknown>>;
}

export async function resolveQuestions(
    importSessionId: number,
    payload: ResolveQuestionsRequest,
): Promise<ResolveQuestionsResponse> {
    const { data } = await apiClient.post<ResolveQuestionsResponse>(
        `/import-sessions/${importSessionId}/resolve-questions/`,
        payload,
    );
    return data;
}

export function useResolveQuestions(importSessionId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: ResolveQuestionsRequest) =>
            resolveQuestions(importSessionId, payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["import-session", importSessionId],
            });
            void queryClient.invalidateQueries({
                queryKey: ["shipment"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["shipments"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["receipts"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["containers"],
            });
        },
    });
}

// ============================================================
// Загрузка ImportSession по Receipt
// ============================================================

/**
 * Сессии импорта, привязанные к Receipt.
 * Используется на `/receiving/:id/questions` — чтобы получить
 * `import_session_id` для разбора вопросов.
 */
export async function fetchImportSessionsByReceipt(
    receiptId: number,
): Promise<PaginatedResponse<ImportSession>> {
    const { data } = await apiClient.get<PaginatedResponse<ImportSession>>(
        "/import-sessions/",
        { params: { receipt_id: receiptId } },
    );
    return data;
}

export function useImportSessionByReceipt(receiptId: number | null) {
    return useQuery({
        queryKey: ["import-session-by-receipt", receiptId],
        queryFn: () => fetchImportSessionsByReceipt(receiptId as number),
        enabled: typeof receiptId === "number" && !Number.isNaN(receiptId),
        placeholderData: keepPreviousData,
        staleTime: 10_000,
    });
}