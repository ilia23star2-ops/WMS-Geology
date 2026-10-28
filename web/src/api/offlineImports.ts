/**
 * API офлайн-импорта (3.x-offline-sync-d-1).
 *
 * `POST /offline-imports/` — принимает JSON-файл от mobile,
 * возвращает сводку: сколько операций применилось, сколько
 * конфликтов, сколько ActualizationTask создано.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

// ------------------------------------------------------------
// Типы (см. OfflineExportSerializer / OfflineImportResponseSerializer)
// ------------------------------------------------------------
export type OfflineOperationType =
    | "RECEIVING_MATCH"
    | "RECEIVING_MISSING"
    | "PICKED"
    | "NOT_FOUND"
    | "DISPOSE_SAMPLE"
    | "PLACE";

export interface OfflineOperation {
    op_id: string;
    type: OfflineOperationType;
    entity: string;
    entity_id: number;
    server_updated_at?: string;
    data?: Record<string, unknown>;
}

export interface OfflineExport {
    format: string;
    version: number;
    exported_at?: string;
    device_id: string;
    user?: Record<string, unknown>;
    task_context?: Record<string, unknown>;
    operations: OfflineOperation[];
}

export interface OfflineImportError {
    op_id?: string;
    error: string;
}

export interface OfflineImportResponse {
    applied: number;
    conflicts: number;
    tasks_created: number;
    errors: OfflineImportError[];
}

// ------------------------------------------------------------
// API
// ------------------------------------------------------------
export async function offlineImport(
    payload: OfflineExport,
): Promise<OfflineImportResponse> {
    const { data } = await apiClient.post<OfflineImportResponse>(
        "/offline-imports/",
        payload,
    );
    return data;
}

export function useOfflineImport() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: offlineImport,
        onSuccess: () => {
            // Могли создаться ActualizationTask — обновить список.
            void qc.invalidateQueries({ queryKey: ["actualization-tasks"] });
            // И контейнеры/пробы — они изменились.
            void qc.invalidateQueries({ queryKey: ["containers"] });
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["receipts"] });
            void qc.invalidateQueries({ queryKey: ["pick-lists"] });
        },
    });
}