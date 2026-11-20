/**
 * Загрузка фото в OCR из web (6e-3-web, +SENT 6e-3-web-c, +name 6e-3-backend).
 * POST /ocr/recognize/ — multipart: image + cell_id + batch_id + name.
 * `name` применяется сервером только когда пакет создаётся этим запросом.
 * PATCH /ocr/batches/{id}/ {status:"SENT"} — закрыть пакет после отправки.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export interface RecognizeResult {
    status: string;
    task_id: number;
    batch_id: number;
    data?: unknown;
    extracted?: unknown;
}

export interface RecognizeVars {
    file: File;
    cellId: number | null;
    batchId: number | null;
    /** Имя пакета — имеет смысл только для первого фото (создание пакета). */
    batchName?: string | null;
    signal?: AbortSignal;
    onProgress?: (percent: number) => void;
}

export function useRecognizePhoto() {
    return useMutation({
        mutationFn: async ({ file, cellId, batchId, batchName, signal, onProgress }: RecognizeVars) => {
            const form = new FormData();
            form.append("image", file);
            if (cellId !== null) form.append("cell_id", String(cellId));
            if (batchId !== null) form.append("batch_id", String(batchId));
            if (batchName) form.append("name", batchName);
            const { data } = await apiClient.post<RecognizeResult>(
                "/ocr/recognize/",
                form,
                {
                    headers: { "Content-Type": "multipart/form-data" },
                    signal,
                    timeout: 180000,
                    onUploadProgress: (e) => {
                        if (!onProgress) return;
                        const total = e.total ?? file.size;
                        const percent = total > 0 ? Math.round((e.loaded / total) * 100) : 0;
                        onProgress(Math.min(100, Math.max(0, percent)));
                    },
                },
            );
            return data;
        },
    });
}

/** Закрыть пакет после отправки сессии: статус SENT. */
export function useSendOcrBatch() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (batchId: number) => {
            const { data } = await apiClient.patch(`/ocr/batches/${batchId}/`, {
                status: "SENT",
            });
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["ocr"] });
        },
    });
}