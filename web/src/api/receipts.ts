/**
 * API партий приёмки (`Receipt`, `ReceiptItem`).
 *
 * - `Receipt` — партия (одна машина / один день).
 * - `ReceiptItem` — строка партии (одна тара).
 *
 * Сверка (`3d-1`):
 * - `useReceiptConflicts` — список неразобранных конфликтов.
 * - `useResolveConflicts` — разбор конфликтов.
 * - `useCheckReceipt` — отметки приехала/нет + номера тар.
 * - `useCompleteReceipt` — завершение приёмки.
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type ReceiptStatus =
    | "EXPECTED"
    | "IN_PROGRESS"
    | "CONFIRMED"
    | "CANCELLED";

export const RECEIPT_STATUS_LABELS: Record<ReceiptStatus, string> = {
    EXPECTED: "Ожидается",
    IN_PROGRESS: "В работе",
    CONFIRMED: "Подтверждена",
    CANCELLED: "Отменена",
};

export type ReceiptItemStatus =
    | "EXPECTED"
    | "MATCHED"
    | "DISCREPANCY"
    | "MISSING"
    | "EXTRA"
    | "PENDING_DECRYPTION";

export const RECEIPT_ITEM_STATUS_LABELS: Record<ReceiptItemStatus, string> = {
    EXPECTED: "Ожидается",
    MATCHED: "Совпадает",
    DISCREPANCY: "Расхождение",
    MISSING: "Отсутствует",
    EXTRA: "Лишняя",
    PENDING_DECRYPTION: "Ожидает расшифровки",
};

export interface Receipt {
    id: number;
    receipt_number: string;
    laboratory: number | null;
    laboratory_name: string | null;
    site: number | null;
    site_name: string | null;
    shipment: number | null;
    excel_file: string | null;
    imported_at: string | null;
    imported_by: number | null;
    received_at: string | null;
    received_by: number | null;
    expected_date: string | null;
    status: ReceiptStatus;
    items_count: number;
    comment: string;
    created_at: string;
}

export interface ReceiptItem {
    id: number;
    receipt: number;
    container: number | null;
    container_number: string | null;
    container_type: number | null;
    expected_container_number: string;
    expected_work_order_number: string;
    expected_research_type_code: string;
    expected_site_code: string;
    expected_samples_count: number | null;
    actual_container_number: string;
    actual_samples_count: number | null;
    scanned_barcodes: string[];
    status: ReceiptItemStatus;
    work_order: number | null;
    work_order_number: string | null;
    research_type: number | null;
    research_type_code: string | null;
    site: number | null;
    site_code: string | null;
    note: string;
}

export interface ReceiptFilters {
    status?: ReceiptStatus;
    laboratory_id?: number;
    site_id?: number;
    shipment_id?: number;
}

export interface ReceiptsListParams {
    page: number;
    filters: ReceiptFilters;
}

export async function fetchReceipts(
    params: ReceiptsListParams,
): Promise<PaginatedResponse<Receipt>> {
    const query: Record<string, string | number> = { page: params.page };
    const f = params.filters;

    if (f.status) query.status = f.status;
    if (f.laboratory_id !== undefined) {
        query.laboratory_id = f.laboratory_id;
    }
    if (f.site_id !== undefined) query.site_id = f.site_id;
    if (f.shipment_id !== undefined) query.shipment_id = f.shipment_id;

    const { data } = await apiClient.get<PaginatedResponse<Receipt>>(
        "/receipts/",
        { params: query },
    );
    return data;
}

export function useReceipts(params: ReceiptsListParams) {
    return useQuery({
        queryKey: ["receipts", params],
        queryFn: () => fetchReceipts(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}

export async function fetchReceipt(id: number): Promise<Receipt> {
    const { data } = await apiClient.get<Receipt>(
        `/receipts/${id}/`,
    );
    return data;
}

export function useReceipt(id: number | null) {
    return useQuery({
        queryKey: ["receipt", id],
        queryFn: () => fetchReceipt(id as number),
        enabled: typeof id === "number" && !Number.isNaN(id),
        staleTime: 10_000,
    });
}

export interface ReceiptItemsListParams {
    page: number;
    receiptId: number;
    status?: ReceiptItemStatus;
}

export async function fetchReceiptItems(
    params: ReceiptItemsListParams,
): Promise<PaginatedResponse<ReceiptItem>> {
    const query: Record<string, string | number> = {
        page: params.page,
        receipt_id: params.receiptId,
    };
    if (params.status) query.status = params.status;

    const { data } = await apiClient.get<PaginatedResponse<ReceiptItem>>(
        "/receipt-items/",
        { params: query },
    );
    return data;
}

export function useReceiptItems(params: ReceiptItemsListParams) {
    return useQuery({
        queryKey: ["receipt-items", params],
        queryFn: () => fetchReceiptItems(params),
        placeholderData: keepPreviousData,
        staleTime: 10_000,
    });
}

// ============================================================
// Сверка приёмки (`3d-1`)
// ============================================================

// --- Конфликты ---
export type ConflictReason =
    | "multi_date_match"
    | "no_dates"
    | "target_date_not_matched";

export interface ReceiptConflict {
    question_index: number;
    code: string;
    title: string;
    reason: ConflictReason;
    sheet: string;
    work_order: string;
    research_type: string;
    container_type: string;
    containers_count: number;
    raw_dates: string[];
    target_date: string;
    message: string;
    suggested_count: number;
}

export interface ReceiptConflictsResponse {
    receipt_id: number;
    conflicts: ReceiptConflict[];
    total_conflicts_count: number;
    resolved_conflicts_count: number;
}

export async function fetchReceiptConflicts(
    receiptId: number,
): Promise<ReceiptConflictsResponse> {
    const { data } = await apiClient.get<ReceiptConflictsResponse>(
        `/receipts/${receiptId}/conflicts/`,
    );
    return data;
}

export function useReceiptConflicts(receiptId: number | null) {
    return useQuery({
        queryKey: ["receipt-conflicts", receiptId],
        queryFn: () => fetchReceiptConflicts(receiptId as number),
        enabled: typeof receiptId === "number" && !Number.isNaN(receiptId),
        staleTime: 10_000,
    });
}

// --- Разбор конфликтов ---
export interface ConflictResolution {
    question_index: number;
    containers_count: number;
}

export interface ResolveConflictsRequest {
    conflicts: ConflictResolution[];
}

export interface ResolveConflictsResponse {
    receipt_id: number;
    created_items_count: number;
    resolved_conflicts_count: number;
    total_conflicts_count: number;
    errors: Array<Record<string, unknown>>;
}

export async function resolveConflicts(
    receiptId: number,
    payload: ResolveConflictsRequest,
): Promise<ResolveConflictsResponse> {
    const { data } = await apiClient.post<ResolveConflictsResponse>(
        `/receipts/${receiptId}/resolve-conflicts/`,
        payload,
    );
    return data;
}

export function useResolveConflicts(receiptId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: ResolveConflictsRequest) =>
            resolveConflicts(receiptId, payload),
        onSuccess: () => {
            void qc.invalidateQueries({
                queryKey: ["receipt-conflicts", receiptId],
            });
            void qc.invalidateQueries({
                queryKey: ["receipt-items"],
            });
            void qc.invalidateQueries({ queryKey: ["receipt"] });
        },
    });
}

// --- Сверка (отметки + номера) ---
export interface CheckReceiptItem {
    item_id: number;
    matched: boolean;
    container_number?: string | null;
}

export interface CheckReceiptRequest {
    items: CheckReceiptItem[];
}

export interface CheckReceiptResponse {
    receipt_id: number;
    total_items_count: number;
    matched_count: number;
    missing_count: number;
    errors: Array<Record<string, unknown>>;
}

export async function checkReceipt(
    receiptId: number,
    payload: CheckReceiptRequest,
): Promise<CheckReceiptResponse> {
    const { data } = await apiClient.post<CheckReceiptResponse>(
        `/receipts/${receiptId}/check/`,
        payload,
    );
    return data;
}

export function useCheckReceipt(receiptId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: CheckReceiptRequest) =>
            checkReceipt(receiptId, payload),
        onSuccess: () => {
            void qc.invalidateQueries({
                queryKey: ["receipt-items"],
            });
            void qc.invalidateQueries({ queryKey: ["receipt"] });
            void qc.invalidateQueries({ queryKey: ["containers"] });
        },
    });
}

// --- Завершение ---
export interface CompleteReceiptResponse {
    receipt_id: number;
    status: ReceiptStatus;
    total_items_count: number;
    matched_count: number;
    missing_count: number;
    other_count: number;
    shipment_id: number | null;
    shipment_status: string | null;
    errors: Array<Record<string, unknown>>;
}

export async function completeReceipt(
    receiptId: number,
): Promise<CompleteReceiptResponse> {
    const { data } = await apiClient.post<CompleteReceiptResponse>(
        `/receipts/${receiptId}/complete/`,
        {},
    );
    return data;
}

export function useCompleteReceipt(receiptId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: () => completeReceipt(receiptId),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["receipt"] });
            void qc.invalidateQueries({ queryKey: ["receipts"] });
            void qc.invalidateQueries({ queryKey: ["shipment"] });
            void qc.invalidateQueries({ queryKey: ["shipments"] });
        },
    });
}