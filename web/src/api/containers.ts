/**
 * Хук списка тары.
 *
 * Server-side пагинация: backend отдаёт фиксированные 50 на
 * страницу (PAGE_SIZE в settings). `?page=` — с 1.
 *
 * ВАЖНО: метки `CONTAINER_STATUS_LABELS` — только UI. Технические
 * значения в БД — `ACTIVE` / `PENDING_PLACEMENT` / `IN_TRANSIT` /
 * `ISSUED`. Модель статусов будет пересмотрена в отдельной серии
 * (`2.x-container-lifecycle`, см. PLAN.md).
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type ContainerStatus =
    | "ACTIVE"
    | "PENDING_PLACEMENT"
    | "IN_TRANSIT"
    | "ISSUED";

export const CONTAINER_STATUS_LABELS: Record<ContainerStatus, string> = {
    ACTIVE: "Размещена",
    PENDING_PLACEMENT: "Ожидает размещения",
    IN_TRANSIT: "В пути",
    ISSUED: "Выдана",
};

export interface Container {
    id: number;
    container_number: string;
    container_type: number;
    qr_code: string | null;
    pallet: number | null;
    floor_room: number | null;
    position_on_pallet: number | null;
    status: ContainerStatus;
    comment: string;
    comment_template: number | null;
    comment_template_text: string | null;
    created_at: string;
}

export interface ContainerFilters {
    status?: ContainerStatus;
    container_type_id?: number;
}

export interface ContainersListParams {
    page: number; // 1-based
    filters: ContainerFilters;
}

export async function fetchContainers(
    params: ContainersListParams,
): Promise<PaginatedResponse<Container>> {
    const query: Record<string, string | number> = { page: params.page };
    if (params.filters.status) {
        query.status = params.filters.status;
    }
    if (params.filters.container_type_id) {
        query.container_type_id = params.filters.container_type_id;
    }

    const { data } = await apiClient.get<PaginatedResponse<Container>>(
        "/storage/containers/",
        { params: query },
    );
    return data;
}

export function useContainers(params: ContainersListParams) {
    return useQuery({
        queryKey: ["containers", params],
        queryFn: () => fetchContainers(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}

/**
 * Скачивает PDF-этикетку тары через авторизованный запрос.
 * Открывает blob в новой вкладке.
 */
export async function downloadLabelPdf(containerId: number): Promise<void> {
    const { data } = await apiClient.get(
        `/storage/containers/${containerId}/label.pdf/`,
        { responseType: "blob" },
    );
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}