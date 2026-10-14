/**
 * API партий приёмки (`Receipt`, `ReceiptItem`).
 *
 * - `Receipt` — партия (одна машина / один день).
 * - `ReceiptItem` — строка партии (одна тара).
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

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