/**
 * API задач на актуализацию (3.x-offline-sync-d-2).
 *
 * Создаются при offline-импорте, когда есть расхождение
 * между server и mobile. Разбираются человеком.
 *
 * - GET /actualization-tasks/?resolution=PENDING — список
 * - POST /actualization-tasks/{id}/resolve/ — разобрать
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type ActualizationTaskType =
    | "RECEIPT_ITEM_DELETED"
    | "SAMPLE_STATUS_CONFLICT"
    | "CONTAINER_MISPLACED"
    | "PICK_LIST_CONFLICT"
    | "OTHER";

export type ActualizationResolution =
    | "PENDING"
    | "ACCEPT_MOBILE"
    | "KEEP_SERVER"
    | "REJECTED";

export const ACTUALIZATION_TASK_TYPE_LABELS: Record<ActualizationTaskType, string> = {
    RECEIPT_ITEM_DELETED: "Тара не найдена на сервере",
    SAMPLE_STATUS_CONFLICT: "Статус пробы расходится",
    CONTAINER_MISPLACED: "Тара не на том месте",
    PICK_LIST_CONFLICT: "Расхождение по выборке",
    OTHER: "Другое",
};

export const ACTUALIZATION_RESOLUTION_LABELS: Record<ActualizationResolution, string> = {
    PENDING: "Ожидает разбора",
    ACCEPT_MOBILE: "Принято с устройства",
    KEEP_SERVER: "Оставлено на сервере",
    REJECTED: "Отклонено",
};

export interface ActualizationTask {
    id: number;
    task_type: ActualizationTaskType;
    task_type_display: string;
    entity_type: string;
    entity_id: number | null;
    server_value: Record<string, unknown> | null;
    mobile_value: Record<string, unknown> | null;
    payload: Record<string, unknown>;
    resolution: ActualizationResolution;
    resolution_display: string;
    resolution_note: string;
    resolved_by: number | null;
    resolved_by_username: string | null;
    resolved_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface ActualizationTasksListParams {
    page: number;
    resolution?: ActualizationResolution;
    task_type?: ActualizationTaskType;
    entity_type?: string;
    entity_id?: number;
}

export async function fetchActualizationTasks(
    params: ActualizationTasksListParams,
): Promise<PaginatedResponse<ActualizationTask>> {
    const query: Record<string, string | number> = { page: params.page };
    if (params.resolution) query.resolution = params.resolution;
    if (params.task_type) query.task_type = params.task_type;
    if (params.entity_type) query.entity_type = params.entity_type;
    if (params.entity_id !== undefined) query.entity_id = params.entity_id;

    const { data } = await apiClient.get<PaginatedResponse<ActualizationTask>>(
        "/actualization-tasks/",
        { params: query },
    );
    return data;
}

export function useActualizationTasks(params: ActualizationTasksListParams) {
    return useQuery({
        queryKey: ["actualization-tasks", params],
        queryFn: () => fetchActualizationTasks(params),
        placeholderData: keepPreviousData,
        staleTime: 10_000,
    });
}

// ------------------------------------------------------------
// Resolve
// ------------------------------------------------------------
export type ResolveAction = "accept_mobile" | "keep_server" | "reject";

export interface ResolveActualizationTaskPayload {
    action: ResolveAction;
    note?: string;
}

export async function resolveActualizationTask(
    id: number,
    payload: ResolveActualizationTaskPayload,
): Promise<ActualizationTask> {
    const { data } = await apiClient.post<ActualizationTask>(
        `/actualization-tasks/${id}/resolve/`,
        payload,
    );
    return data;
}

export function useResolveActualizationTask() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            payload,
        }: {
            id: number;
            payload: ResolveActualizationTaskPayload;
        }) => resolveActualizationTask(id, payload),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["actualization-tasks"] });
            void qc.invalidateQueries({ queryKey: ["containers"] });
            void qc.invalidateQueries({ queryKey: ["samples"] });
        },
    });
}