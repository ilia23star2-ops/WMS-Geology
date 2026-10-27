/**
 * API партий печати.
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type PrintType = "LABELS" | "QR_ONLY";
export type PrintBatchStatus = "DRAFT" | "READY" | "PRINTED" | "CANCELLED";

export const PRINT_TYPE_LABELS: Record<PrintType, string> = {
    LABELS: "Этикетки",
    QR_ONLY: "QR-сетка",
};

export const PRINT_BATCH_STATUS_LABELS: Record<PrintBatchStatus, string> = {
    DRAFT: "Черновик",
    READY: "Готов к печати",
    PRINTED: "Напечатан",
    CANCELLED: "Отменён",
};

export interface PrintBatchItem {
    id: number;
    container: number;
    container_number: string;
    position: number;
    created_at: string;
}

export interface PrintBatch {
    id: number;
    batch_number: string;
    name: string;
    print_type: PrintType;
    print_type_display: string;
    status: PrintBatchStatus;
    status_display: string;
    created_by: number | null;
    created_by_username: string | null;
    printed_by: number | null;
    printed_by_username: string | null;
    printed_at: string | null;
    total_items: number;
    total_pages: number;
    comment: string;
    items: PrintBatchItem[];
    created_at: string;
    updated_at: string;
}

// ------------------------------------------------------------
// Список
// ------------------------------------------------------------
export interface PrintBatchesListParams {
    page: number;
    status?: PrintBatchStatus;
}

export async function fetchPrintBatches(
    params: PrintBatchesListParams,
): Promise<PaginatedResponse<PrintBatch>> {
    const query: Record<string, string | number> = { page: params.page };
    if (params.status) query.status = params.status;

    const { data } = await apiClient.get<PaginatedResponse<PrintBatch>>(
        "/labels/print-batches/",
        { params: query },
    );
    return data;
}

export function usePrintBatches(params: PrintBatchesListParams) {
    return useQuery({
        queryKey: ["print-batches", params],
        queryFn: () => fetchPrintBatches(params),
        placeholderData: keepPreviousData,
        staleTime: 15_000,
    });
}

// ------------------------------------------------------------
// Детали
// ------------------------------------------------------------
export async function fetchPrintBatch(id: number): Promise<PrintBatch> {
    const { data } = await apiClient.get<PrintBatch>(
        `/labels/print-batches/${id}/`,
    );
    return data;
}

export function usePrintBatch(id: number | undefined) {
    return useQuery({
        queryKey: ["print-batch", id],
        queryFn: () => fetchPrintBatch(id as number),
        enabled: typeof id === "number" && !Number.isNaN(id),
        staleTime: 10_000,
    });
}

// ------------------------------------------------------------
// Мутации
// ------------------------------------------------------------
export function useCreatePrintBatch() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (printType: PrintType) => {
            const { data } = await apiClient.post<PrintBatch>(
                "/labels/print-batches/",
                { print_type: printType },
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export interface UpdatePrintBatchPayload {
    name?: string;
    comment?: string;
}

export async function updatePrintBatch(
    batchId: number,
    payload: UpdatePrintBatchPayload,
): Promise<PrintBatch> {
    const { data } = await apiClient.patch<PrintBatch>(
        `/labels/print-batches/${batchId}/`,
        payload,
    );
    return data;
}

export function useUpdatePrintBatch(batchId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: UpdatePrintBatchPayload) =>
            updatePrintBatch(batchId, payload),
        onSuccess: (data) => {
            qc.setQueryData(["print-batch", batchId], data);
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export function useAddContainers(batchId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({
            containerIds,
            force = false
        }: {
            containerIds: number[];
            force?: boolean;
        }) => {
            const { data } = await apiClient.post<PrintBatch>(
                `/labels/print-batches/${batchId}/add-containers/`,
                { container_ids: containerIds, force },
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["print-batch", batchId] });
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export function useRemoveContainer(batchId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (containerId: number) => {
            const { data } = await apiClient.post<PrintBatch>(
                `/labels/print-batches/${batchId}/remove-container/`,
                { container_id: containerId },
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["print-batch", batchId] });
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export function useMarkReady(batchId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post<PrintBatch>(
                `/labels/print-batches/${batchId}/mark-ready/`,
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["print-batch", batchId] });
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export function useCancelBatch(batchId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post<PrintBatch>(
                `/labels/print-batches/${batchId}/cancel/`,
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["print-batch", batchId] });
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export function useMarkPrinted(batchId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post<PrintBatch>(
                `/labels/print-batches/${batchId}/mark-printed/`,
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["print-batch", batchId] });
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export function useDeletePrintBatch() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (batchId: number) => {
            await apiClient.delete(`/labels/print-batches/${batchId}/`);
        },
        onSuccess: (_void, batchId) => {
            qc.removeQueries({ queryKey: ["print-batch", batchId] });
            void qc.invalidateQueries({ queryKey: ["print-batches"] });
        },
    });
}

export async function downloadBatchPdf(batchId: number): Promise<void> {
    const { data } = await apiClient.get(
        `/labels/print-batches/${batchId}/pdf/`,
        { responseType: "blob" },
    );
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}