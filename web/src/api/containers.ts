/**
 * API тары (`Container`).
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
    | "PENDING_FILLING"
    | "PENDING_PLACEMENT"
    | "ACTIVE"
    | "IN_TRANSIT"
    | "ISSUED";

export const CONTAINER_STATUS_LABELS: Record<ContainerStatus, string> = {
    PENDING_FILLING: "Ожидает заполнения",
    PENDING_PLACEMENT: "Ожидает размещения",
    ACTIVE: "Активна",
    IN_TRANSIT: "В пути",
    ISSUED: "Выдана",
};

export interface Container {
    id: number;
    container_number: string | null;
    container_type: number;
    qr_code: string | null;
    pallet: number | null;
    cell_id: number | null;
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
    label_printed_at: string | null;
    created_at: string;
}

export interface ContainerFilters {
    pallet_id?: number;
    floor_room_id?: number;
    container_type_id?: number;
    status?: ContainerStatus;
    comment_template_id?: number;
    draft_work_order_coded?: string;
    draft_research_type_id?: number;
}

export interface ContainersListParams {
    page: number;
    filters: ContainerFilters;
}

export async function fetchContainers(
    params: ContainersListParams,
): Promise<PaginatedResponse<Container>> {
    const query: Record<string, string | number> = { page: params.page };
    const f = params.filters;

    if (f.pallet_id !== undefined) query.pallet_id = f.pallet_id;
    if (f.floor_room_id !== undefined) query.floor_room_id = f.floor_room_id;
    if (f.container_type_id !== undefined) query.container_type_id = f.container_type_id;
    if (f.status) query.status = f.status;
    if (f.comment_template_id !== undefined) query.comment_template_id = f.comment_template_id;
    if (f.draft_work_order_coded) query.draft_work_order_coded = f.draft_work_order_coded;
    if (f.draft_research_type_id !== undefined) query.draft_research_type_id = f.draft_research_type_id;

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
        staleTime: 10_000,
    });
}

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
        staleTime: 5_000,
    });
}

export async function updateContainer(
    id: number,
    payload: UpdateContainerPayload,
): Promise<Container> {
    const { data } = await apiClient.patch<Container>(
        `/storage/containers/${id}/`,
        payload,
    );
    return data;
}

export function useUpdateContainer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: UpdateContainerPayload }) =>
            updateContainer(id, payload),
        onSuccess: (data) => {
            qc.setQueryData(["container", data.id], data);
            void qc.invalidateQueries({ queryKey: ["containers"] });
            void qc.invalidateQueries({ queryKey: ["container-history", data.id] });
        },
    });
}

export async function deleteContainer(id: number, force: boolean = false): Promise<void> {
    const query = force ? { force: "true" } : {};
    await apiClient.delete(`/storage/containers/${id}/`, { params: query });
}

export function useDeleteContainer() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, force = false }: { id: number; force?: boolean }) =>
            deleteContainer(id, force),
        onSuccess: (_void, variables) => {
            qc.removeQueries({ queryKey: ["container", variables.id] });
            void qc.invalidateQueries({ queryKey: ["containers"] });
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["topology"] });
        },
    });
}

export async function downloadLabelPdf(id: number): Promise<void> {
    const { data } = await apiClient.get(
        `/storage/containers/${id}/label.pdf/`,
        { responseType: "blob" },
    );
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function fetchLabelPdfUrl(id: number): Promise<string> {
    const { data } = await apiClient.get(
        `/storage/containers/${id}/label.pdf/`,
        { responseType: "blob" },
    );
    return URL.createObjectURL(data);
}

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
    const qc = useQueryClient();
    return useMutation({
        mutationFn: bulkCreateContainers,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["containers"] });
        },
    });
}

export interface FillSamplesGroup {
    prefix: string;
    middle: string;
    sequence_from: number;
    sequence_to: number;
    sequence_digits: number;
    well_name?: string | null;
    status?: string;
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
    container_number: string;
    created_samples: { id: number; sample_number: string; status: string }[];
    total_samples: number;
}

export async function fillContainerWithSamples(
    id: number,
    payload: FillSamplesRequest,
): Promise<FillSamplesResponse> {
    const { data } = await apiClient.post<FillSamplesResponse>(
        `/storage/containers/${id}/fill-samples/`,
        payload,
    );
    return data;
}

export function useFillSamples(containerId: number) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (payload: FillSamplesRequest) =>
            fillContainerWithSamples(containerId, payload),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["container", containerId] });
            void qc.invalidateQueries({ queryKey: ["containers"] });
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["container-history", containerId] });
        },
    });
}

export interface UpdateContainerPayload {
    container_number?: string | null;
    container_type?: number;
    pallet?: number | null;
    floor_room?: number | null;
    position_on_pallet?: number | null;
    status?: ContainerStatus;
    comment?: string;
    comment_template?: number | null;
    draft_site?: number | null;
    draft_research_type?: number | null;
    draft_work_order_coded?: string;
    draft_work_order_incoming?: string;
}

export interface CreateInCellRequest {
    cell_id: number;
    container_type_id: number;
    container_number?: string | null;
    work_order_coded: string;
    work_order_incoming?: string;
    research_type_id: number;
    site_id?: number | null;
    sample_groups: FillSamplesGroup[];
}

export interface CreateInCellResponse {
    container_id: number;
    container_number: string;
    total_samples: number;
}

export async function createInCell(
    payload: CreateInCellRequest,
): Promise<CreateInCellResponse> {
    const { data } = await apiClient.post<CreateInCellResponse>(
        "/storage/containers/create-in-cell/",
        payload,
    );
    return data;
}

export function useCreateInCell() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createInCell,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["containers"] });
            void qc.invalidateQueries({ queryKey: ["samples"] });
            void qc.invalidateQueries({ queryKey: ["topology"] });
        },
    });
}

// ============================================================
// История тары (2f-14b)
// ============================================================

export interface ContainerHistoryEntry {
    id: number;
    user: number | null;
    username: string | null;
    action: string;
    action_display: string;
    entity_type: string;
    entity_id: number | null;
    old_value: Record<string, unknown> | null;
    new_value: Record<string, unknown> | null;
    created_at: string;
}

export async function fetchContainerHistory(
    id: number,
): Promise<ContainerHistoryEntry[]> {
    const { data } = await apiClient.get<ContainerHistoryEntry[]>(
        `/storage/containers/${id}/history/`,
    );
    return data;
}

export function useContainerHistory(id: number | null) {
    return useQuery({
        queryKey: ["container-history", id],
        queryFn: () => fetchContainerHistory(id as number),
        enabled: typeof id === "number" && !Number.isNaN(id),
        staleTime: 5_000,
    });
}