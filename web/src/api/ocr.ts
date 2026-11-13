/**
 * API OCR: OcrTask, OcrBatch, approve.
 *
 * c-3.x-migration-5b.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export type OcrTaskStatus =
    | "PENDING"
    | "PROCESSING"
    | "READY"
    | "DONE"
    | "ERROR";

export interface OcrWord {
    text: string;
    confidence: number;
    bbox: number[][]; // 4 точки: [[x,y], [x,y], [x,y], [x,y]]
}

export interface OcrRawData {
    text: string;
    words: OcrWord[];
}

export interface OcrTask {
    id: number;
    batch: number;
    image: string; // относительный URL от MEDIA_ROOT
    status: OcrTaskStatus;
    raw_ocr_data: OcrRawData | null;
    reviewed_data: Record<string, unknown> | null;
    error_message: string;
    created_at: string;
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
    cell_id: number | null;
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

/**
 * OcrTask.image приходит из DRF как относительный путь
 * (например, `media/ocr_tasks/2026/11/13/foo.png`).
 * Приводим к абсолютному URL от текущего origin.
 */
export function resolveImageUrl(image: string): string {
    if (!image) return "";
    if (image.startsWith("http://") || image.startsWith("https://")) return image;
    return "/" + image.replace(/^\/+/, "");
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