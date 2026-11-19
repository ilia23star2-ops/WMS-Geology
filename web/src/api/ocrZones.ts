/**
 * Сохранение разметки зон на фото (6e-2-web-5).
 * POST /ocr/tasks/{id}/zones/ — backend сохраняет zones и возвращает zones_count;
 * extracted он не пересчитывает, значения полей web берёт из utils/zoneExtract.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { OcrZone } from "./ocr";

export interface OcrZonesResult {
    task_id: number;
    zones_count: number;
}

export function useSaveOcrZones(taskId: number | null) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (zones: OcrZone[]) => {
            const { data } = await apiClient.post<OcrZonesResult>(
                `/ocr/tasks/${taskId}/zones/`,
                { zones },
            );
            return data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["ocr"] });
        },
    });
}