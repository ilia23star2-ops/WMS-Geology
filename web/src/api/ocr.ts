/**
 * API OCR: OcrTask, OcrBatch, approve, zones, extracted.
 *
 * c-3.x-migration-5b: recognize, approve, bbox.
 * c-3.x-migration-5c: batch list / detail.
 * c-3.x-migration-5e: zones, extracted fields.
 * c-3.x-migration-5f: типизация для подсветки bbox ↔ поля.
 * c-3.x-migration-6a-fix5b: +site, +container_type в ExtractedFields.
 * c-3.x-migration-6e-a3: +SENT — сессия отправлена с мобильного.
 * c-3.x-migration-6e-2-web: зона «Участок», label «Пробы», approvedContainerId.
 * c-3.x-migration-6e-3-backend: +name у OcrBatch, useRenameOcrBatch.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type OcrTaskStatus =
    | "PENDING"
    | "PROCESSING"
    | "READY"
    | "DONE"
    | "ERROR";

export type OcrBatchStatus =
    | "DRAFT"
    | "SENT"
    | "UPLOADING"
    | "PROCESSING"
    | "REVIEW"
    | "COMPLETED"
    | "FAILED";

export const OCR_BATCH_STATUS_LABELS: Record<OcrBatchStatus, string> = {
    DRAFT: "Черновик",
    // 6e-a3: мобильная сессия отправлена на сервер
    SENT: "Отправлено",
    UPLOADING: "Загрузка фото",
    PROCESSING: "Распознавание",
    REVIEW: "Готово к проверке",
    COMPLETED: "Подтверждено",
    FAILED: "Ошибка",
};

export const OCR_TASK_STATUS_LABELS: Record<OcrTaskStatus, string> = {
    PENDING: "Ожидает загрузки",
    PROCESSING: "В процессе",
    READY: "Распознано",
    DONE: "Подтверждено",
    ERROR: "Ошибка",
};

export type OcrZoneType =
    | "work_order_coded"
    | "work_order_incoming"
    | "container_number"
    | "research_type"
    | "sample"
    | "well"
    | "site";

export const OCR_ZONE_LABELS: Record<OcrZoneType, string> = {
    work_order_coded: "Н/З (текущий)",
    work_order_incoming: "Н/З (входящий)",
    container_number: "Номер тары",
    research_type: "Тип исследования",
    // 6e-2-web: в зоне несколько проб
    sample: "Пробы",
    well: "Скважина",
    // 6e-2-site: тип зоны с мобильного
    site: "Участок",
};

export interface OcrWord {
    text: string;
    confidence: number;
    bbox: number[][];
}

export interface OcrZone {
    type: OcrZoneType;
    bbox: number[][];
    source: "manual" | "mlkit";
}

export interface ExtractedFields {
    work_order_coded: string | null;
    work_order_incoming: string | null;
    container_number: string | null;
    research_type: string | null;
    /** c-6a-fix5b: код участка (TST) — fuzzy match в mapping.py */
    site?: string | null;
    /** c-6a-fix5b: имя типа тары (Ящик) — fuzzy match в mapping.py */
    container_type?: string | null;
    samples: string[];
    wells: string[];
    source: "zones" | "fallback" | "mixed" | "none";
}

export interface OcrRawData {
    text: string;
    words: OcrWord[];
    extracted?: ExtractedFields;
}

export interface OcrTask {
    id: number;
    batch: number;
    image: string;
    status: OcrTaskStatus;
    raw_ocr_data: OcrRawData | null;
    reviewed_data: Record<string, unknown> | null;
    zones: OcrZone[] | null;
    error_message: string;
    created_at: string;
}

export interface OcrBatch {
    id: number;
    user: number;
    cell: number | null;
    /** 6e-3-backend: имя пакета; пусто = безымянный («Пакет #id»). */
    name: string;
    status: OcrBatchStatus;
    created_at: string;
    processed_at: string | null;
    tasks: OcrTask[];
}

export interface SampleGroup {
    prefix: string;
    middle: string;
    sequence_from: number;
    sequence_to: number;
    sequence_digits: number;
    well_name: string | null;
    status: "NORMAL" | "SELECTED";
}

export interface OcrApprovePayload {
    container_number: string;
    container_type_id: number;
    work_order_coded: string;
    work_order_incoming: string;
    research_type_id: number;
    site_id: number | null;
    sample_groups: SampleGroup[];
}

export interface OcrApproveResult {
    container_id: number;
    samples_created: number;
    batch_completed: boolean;
}

export function resolveImageUrl(image: string): string {
    if (!image) return "";
    if (image.startsWith("http://") || image.startsWith("https://")) return image;
    return "/" + image.replace(/^\/+/, "");
}

/**
 * 6e-2-web: id тары, созданной при approve.
 * Backend кладёт `container_id` в `reviewed_data` (6e-2-web-a).
 * У задач, подтверждённых раньше, поля нет → null (кнопка не показывается).
 */
export function approvedContainerId(task: OcrTask): number | null {
    const raw = task.reviewed_data?.["container_id"];
    return typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? raw
        : null;
}

export function useOcrTask(taskId: number | null) {
    return useQuery({
        queryKey: ["ocr", "task", taskId],
        queryFn: async () => {
            const { data } = await apiClient.get<OcrTask>(
                `/ocr/tasks/${taskId}/`,
            );
            return data;
        },
        enabled: taskId !== null && taskId > 0,
    });
}

export function useApproveOcrTask(taskId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: OcrApprovePayload) => {
            const { data } = await apiClient.post<OcrApproveResult>(
                `/ocr/tasks/${taskId}/approve/`,
                payload,
            );
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["ocr"] });
        },
    });
}

export function useOcrBatches() {
    return useQuery({
        queryKey: ["ocr", "batches"],
        queryFn: async () => {
            const { data } = await apiClient.get<PaginatedResponse<OcrBatch>>(
                "/ocr/batches/?per_page=200",
            );
            return data;
        },
    });
}

export function useOcrBatch(batchId: number | null) {
    return useQuery({
        queryKey: ["ocr", "batch", batchId],
        queryFn: async () => {
            const { data } = await apiClient.get<OcrBatch>(
                `/ocr/batches/${batchId}/`,
            );
            return data;
        },
        enabled: batchId !== null && batchId > 0,
    });
}

/** 6e-3-backend: переименовать пакет PATCH /ocr/batches/{id}/. */
export function useRenameOcrBatch() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, name }: { id: number; name: string }) => {
            const { data } = await apiClient.patch<OcrBatch>(
                `/ocr/batches/${id}/`,
                { name },
            );
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["ocr"] });
        },
    });
}