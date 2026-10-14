/**
 * Хуки списка тары.
 *
 * Server-side пагинация: backend отдаёт фиксированные 50 на
 * страницу (PAGE_SIZE в settings). `?page=` — с 1.
 *
 * ВАЖНО: метки `CONTAINER_STATUS_LABELS` — только UI. Технические
 * значения в БД — `ACTIVE` / `PENDING_PLACEMENT` / `IN_TRANSIT` /
 * `ISSUED`. Модель статусов будет пересмотрена в отдельной серии
 * (`2.x-container-lifecycle`, см. PLAN.md).
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

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
    container_number: string | null;
    container_type: number;
    qr_code: string | null;
    pallet: number | null;
    floor_room: number | null;
    position_on_pallet: number | null;
    status: ContainerStatus;
    comment: string;
    comment_template: number | null;
    comment_template_text: string | null;
    draft_site: number | null;
    draft_site_name: string | null;
    draft_research_type: number | null;
    draft_research_type_name: string | null;
    draft_work_order_coded: string;
    draft_work_order_incoming: string;
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
 * Одна тара по id. Используется для предпросмотра после
 * заполнения: `useFillSamples` инвалидирует `["containers"]`,
 * а этот запрос подтягивает обновлённую тару (с номером).
 */
export async function fetchContainer(id: number): Promise<Container> {
    const { data } = await apiClient.get<Container>(
        `/storage/containers/${id}/`,
    );
    return data;
}

export function useContainer(id: number | null) {
    return useQuery({
        queryKey: ["container", id],
        queryFn: () => fetchContainer(id as number),
        enabled: typeof id === "number" && !Number.isNaN(id),
        staleTime: 10_000,
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

/**
 * Скачивает PDF-этикетку тары и возвращает object URL
 * (для встраивания в `<iframe>`).
 * Вызывающий код отвечает за `URL.revokeObjectURL`.
 */
export async function fetchLabelPdfUrl(
    containerId: number,
): Promise<string> {
    const { data } = await apiClient.get(
        `/storage/containers/${containerId}/label.pdf/`,
        { responseType: "blob" },
    );
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    return URL.createObjectURL(blob);
}

// ============================================================
// Bulk create — создание партии тары-заготовок
// ============================================================

export interface BulkCreateContainerItem {
    container_number?: string | null;
    container_type_id: number;
}

export interface BulkCreateContainersRequest {
    containers: BulkCreateContainerItem[];
    draft_site_id?: number | null;
    draft_research_type_id?: number | null;
    draft_work_order_coded?: string;
    draft_work_order_incoming?: string;
}

export interface BulkCreateContainersResponse {
    created_containers: Container[];
    total_containers: number;
}

export async function bulkCreateContainers(
    payload: BulkCreateContainersRequest,
): Promise<BulkCreateContainersResponse> {
    const { data } = await apiClient.post<BulkCreateContainersResponse>(
        "/storage/containers/bulk-create/",
        payload,
    );
    return data;
}

export function useBulkCreateContainers() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: bulkCreateContainers,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
        },
    });
}

// ============================================================
// Fill samples — заполнение существующей тары пробами
// ============================================================

export interface FillSamplesGroup {
    prefix: string;
    middle: string;
    sequence_from: number;
    sequence_to: number;
    sequence_digits: number;
    well_name: string | null;
}

export interface FillSamplesRequest {
    container_number?: string | null;
    work_order_coded: string;
    work_order_incoming?: string;
    research_type_id: number;
    site_id?: number | null;
    sample_groups: FillSamplesGroup[];
}

export interface FillSamplesResponse {
    container_id: number;
    container_number: string | null;
    created_samples: Array<{
        id: number;
        sample_number: string;
        status: string;
    }>;
    total_samples: number;
}

export async function fillContainerWithSamples(
    containerId: number,
    payload: FillSamplesRequest,
): Promise<FillSamplesResponse> {
    const { data } = await apiClient.post<FillSamplesResponse>(
        `/storage/containers/${containerId}/fill-samples/`,
        payload,
    );
    return data;
}

export function useFillSamples(containerId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (payload: FillSamplesRequest) =>
            fillContainerWithSamples(containerId, payload),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
            void queryClient.invalidateQueries({
                queryKey: ["container", containerId],
            });
            void queryClient.invalidateQueries({ queryKey: ["samples"] });
        },
    });
}