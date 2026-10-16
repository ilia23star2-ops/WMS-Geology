/**
 * Хук списка проб.
 *
 * Server-side пагинация: backend отдаёт 50 на страницу.
 *
 * ВАЖНО: метки `SAMPLE_STATUS_LABELS` — только UI. Технические
 * значения в БД — из модели Sample. Модель статусов будет
 * пересмотрена в серии `2.x-lifecycle` (см. PLAN.md).
 *
 * Группировка (`2f-2a`): `useSamplesGrouped` — группы по
 * (Н/З × ТИ), пагинация по 20 групп.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type SampleStatus =
    | "IN_STORAGE"
    | "IN_TRANSIT"
    | "ISSUED"
    | "CONSUMED"
    | "DISPOSED"
    | "PENDING_DECRYPTION"
    | "PENDING_PLACEMENT";

export const SAMPLE_STATUS_LABELS: Record<SampleStatus, string> = {
    IN_STORAGE: "В хранении",
    IN_TRANSIT: "В пути",
    ISSUED: "Выдана",
    CONSUMED: "Израсходована",
    DISPOSED: "Утилизирована",
    PENDING_DECRYPTION: "Ожидает расшифровки",
    PENDING_PLACEMENT: "Ожидает размещения",
};

export interface Sample {
    id: number;
    sample_number: string;
    research_type: number;
    research_type_name: string;
    well: number | null;
    well_name: string | null;
    depth_from: string | null;
    depth_to: string | null;
    site: number | null;
    site_name: string | null;
    container: number;
    container_number: string | null;
    current_work_order: number | null;
    current_work_order_number: string | null;
    status: SampleStatus;
    qr_code: string | null;
    legacy_data: Record<string, unknown> | null;
    disposed_at: string | null;
    disposed_by: number | null;
    disposal_reason: string;
    created_at: string;
    updated_at: string;
}

export interface SampleFilters {
    sample_number?: string;
    research_type?: number;
    site?: number;
    status?: SampleStatus;
    work_order?: string;
    show_disposed?: boolean;
    container_id?: number;
}

export interface SamplesListParams {
    page: number; // 1-based
    filters: SampleFilters;
}

export async function fetchSamples(
    params: SamplesListParams,
): Promise<PaginatedResponse<Sample>> {
    const query: Record<string, string | number> = { page: params.page };
    const f = params.filters;

    if (f.sample_number) query.sample_number = f.sample_number;
    if (f.research_type !== undefined) query.research_type = f.research_type;
    if (f.site !== undefined) query.site = f.site;
    if (f.status) query.status = f.status;
    if (f.work_order) query.work_order = f.work_order;
    if (f.show_disposed) query.show_disposed = "true";
    if (f.container_id !== undefined) query.container_id = f.container_id;

    const { data } = await apiClient.get<PaginatedResponse<Sample>>(
        "/samples/",
        { params: query },
    );
    return data;
}

export function useSamples(params: SamplesListParams) {
    return useQuery({
        queryKey: ["samples", params],
        queryFn: () => fetchSamples(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}

// ============================================================
// Группировка проб (пачка 2f-2a)
// ============================================================

export interface GroupedWorkOrder {
    id: number;
    number: string;
    type: string;
}

export interface GroupedResearchType {
    id: number;
    code: string;
    name: string;
}

export interface GroupedContainerBrief {
    id: number;
    number: string | null;
    status: string;
}

export interface GroupedSampleBrief {
    id: number;
    sample_number: string;
    status: SampleStatus;
    updated_at: string;
}

export interface GroupedContainer {
    container: GroupedContainerBrief;
    location: string;
    samples: GroupedSampleBrief[];
}

export interface SampleGroup {
    work_order: GroupedWorkOrder | null;
    research_type: GroupedResearchType;
    total_samples: number;
    containers: GroupedContainer[];
}

export interface SamplesGroupedResponse {
    count: number;   // всего групп
    next: string | null;
    previous: string | null;
    page_size: number;
    results: SampleGroup[];
}

export interface SamplesGroupedParams {
    page: number; // 1-based, по группам
    filters: SampleFilters;
}

export async function fetchSamplesGrouped(
    params: SamplesGroupedParams,
): Promise<SamplesGroupedResponse> {
    const query: Record<string, string | number> = { page: params.page };
    const f = params.filters;

    if (f.sample_number) query.sample_number = f.sample_number;
    if (f.research_type !== undefined) query.research_type = f.research_type;
    if (f.site !== undefined) query.site = f.site;
    if (f.status) query.status = f.status;
    if (f.work_order) query.work_order = f.work_order;
    if (f.show_disposed) query.show_disposed = "true";

    const { data } = await apiClient.get<SamplesGroupedResponse>(
        "/samples/grouped/",
        { params: query },
    );
    return data;
}

export function useSamplesGrouped(params: SamplesGroupedParams) {
    return useQuery({
        queryKey: ["samples-grouped", params],
        queryFn: () => fetchSamplesGrouped(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}