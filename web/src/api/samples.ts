/**
 * Хуки списка проб.
 *
 * Server-side пагинация: backend отдаёт 50 на страницу.
 *
 * ВАЖНО: метки `SAMPLE_STATUS_LABELS` — только UI. Технические
 * значения в БД — из модели Sample. Модель статусов будет
 * пересмотрена в серии `2.x-lifecycle` (см. PLAN.md).
 *
 * Группировка (`2f-2a`): `useSamplesGrouped` — группы по
 * (Н/З × ТИ), пагинация по 20 групп.
 *
 * CRUD + действия (`2f-2b`): `useUpdateSample`, `useDeleteSample`,
 * `useDisposeSample`, `useRestoreSample`.
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

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
    PENDING_PLACEMENT: "Выбрана", // 2f-9a: изменено с «Ожидает размещения»
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
    current_location?: string;
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

// ============================================================
// CRUD + действия (пачка 2f-2b)
// ============================================================

export async function fetchSample(id: number): Promise<Sample> {
    const { data } = await apiClient.get<Sample>(`/samples/${id}/`);
    return data;
}

export function useSample(id: number | null) {
    return useQuery({
        queryKey: ["sample", id],
        queryFn: () => fetchSample(id as number),
        enabled: typeof id === "number" && !Number.isNaN(id),
        staleTime: 10_000,
    });
}

export interface UpdateSamplePayload {
    sample_number?: string;
    research_type?: number;
    site?: number | null;
    status?: SampleStatus;
}

export async function updateSample(
    id: number,
    payload: UpdateSamplePayload,
): Promise<Sample> {
    const { data } = await apiClient.patch<Sample>(
        `/samples/${id}/`,
        payload,
    );
    return data;
}

export function useUpdateSample() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: {
            id: number;
            payload: UpdateSamplePayload;
        }) => updateSample(id, payload),
        onSuccess: (_data, variables) => {
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["samples-grouped"] });
            void qc.invalidateQueries({
                queryKey: ["sample", variables.id],
            });
        },
    });
}

export async function deleteSample(id: number): Promise<void> {
    await apiClient.delete(`/samples/${id}/`);
}

export function useDeleteSample() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteSample(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["samples-grouped"] });
        },
    });
}

export async function disposeSample(
    id: number,
    reason: string,
): Promise<Sample> {
    const { data } = await apiClient.post<Sample>(
        `/samples/${id}/dispose/`,
        { disposal_reason: reason },
    );
    return data;
}

export function useDisposeSample() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: number; reason: string }) =>
            disposeSample(id, reason),
        onSuccess: (_data, variables) => {
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["samples-grouped"] });
            void qc.invalidateQueries({
                queryKey: ["sample", variables.id],
            });
        },
    });
}

export async function restoreSample(id: number): Promise<Sample> {
    const { data } = await apiClient.post<Sample>(
        `/samples/${id}/restore/`,
    );
    return data;
}

export function useRestoreSample() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => restoreSample(id),
        onSuccess: (_data, id) => {
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["samples-grouped"] });
            void qc.invalidateQueries({ queryKey: ["sample", id] });
        },
    });
}