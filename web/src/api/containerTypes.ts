/**
 * API типов тары (ContainerType).
 *
 * c-2.x-lifecycle-1-ui: `is_disposable` + CRUD (создать / обновить / удалить).
 */
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export interface ContainerType {
    id: number;
    name: string;
    laboratory: number | null;
    laboratory_name: string | null;
    size_class: string;
    max_on_standard_pallet: number;
    is_core: boolean;
    /** c-2.x-lifecycle-1: одноразовая тара (при утилизации последней
     *  пробы → Container.DISPOSED). */
    is_disposable: boolean;
    description: string;
}

export interface ContainerTypePayload {
    name: string;
    laboratory?: number | null;
    size_class?: string;
    max_on_standard_pallet?: number;
    is_core?: boolean;
    is_disposable?: boolean;
    description?: string;
}

const URL = "/storage/container-types/";

export async function fetchContainerTypes(): Promise<ContainerType[]> {
    const { data } = await apiClient.get<PaginatedResponse<ContainerType>>(
        URL,
    );
    return data.results;
}

export function useContainerTypes() {
    return useQuery({
        queryKey: ["container-types"],
        queryFn: fetchContainerTypes,
        staleTime: 5 * 60_000,
    });
}

export async function createContainerType(
    payload: ContainerTypePayload,
): Promise<ContainerType> {
    const { data } = await apiClient.post<ContainerType>(URL, payload);
    return data;
}

export function useCreateContainerType() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createContainerType,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["container-types"] });
        },
    });
}

export async function updateContainerType(
    id: number,
    payload: Partial<ContainerTypePayload>,
): Promise<ContainerType> {
    const { data } = await apiClient.patch<ContainerType>(
        `${URL}${id}/`,
        payload,
    );
    return data;
}

export function useUpdateContainerType() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            payload,
        }: {
            id: number;
            payload: Partial<ContainerTypePayload>;
        }) => updateContainerType(id, payload),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["container-types"] });
        },
    });
}

export async function deleteContainerType(id: number): Promise<void> {
    await apiClient.delete(`${URL}${id}/`);
}

export function useDeleteContainerType() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteContainerType(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["container-types"] });
        },
    });
}
