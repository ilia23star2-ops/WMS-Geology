/**
 * API для работы с Пулом (корзиной).
 * Пачка 2.x-pool.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface PoolItem {
    id: number;
    pool: number;
    container: number | null;
    container_number: string | null;
    draft_work_order_coded?: string;
    draft_research_type_name?: string | null;
    sample: number | null;
    sample_number: string | null;
    container_status?: string;
    sample_status?: string;
    sample_work_order?: string | null;
    sample_research_type?: string | null;
    created_at: string;
}

export interface Pool {
    id: number;
    user: number;
    items: PoolItem[];
    items_count: number;
    created_at: string;
    updated_at: string;
}

export async function fetchPool(): Promise<Pool> {
    const { data } = await apiClient.get<Pool>("/pool/");
    return data;
}

export function usePool() {
    return useQuery({
        queryKey: ["pool"],
        queryFn: fetchPool,
        staleTime: 10_000,
    });
}

interface AddToPoolPayload {
    container_ids?: number[];
    sample_ids?: number[];
}

export function useAddToPool() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (payload: AddToPoolPayload) => {
            const { data } = await apiClient.post("/pool/add/", payload);
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["pool"] });
        },
    });
}

export function useClearPool() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () => {
            const { data } = await apiClient.post("/pool/clear/");
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["pool"] });
        },
    });
}
export function useRemoveFromPool() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (itemIds: number[]) => {
            const { data } = await apiClient.post("/pool/remove/", { item_ids: itemIds });
            return data;
        },
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["pool"] });
        },
    });
}
