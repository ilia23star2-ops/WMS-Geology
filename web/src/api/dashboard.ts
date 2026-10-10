/**
 * Хуки TanStack Query для главной страницы.
 *
 * Счётчики берём из DRF-пагинации: запрашиваем 1 элемент,
 * читаем `count` из ответа. Без изменений backend.
 */
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

async function fetchCount(url: string): Promise<number> {
    const { data } = await apiClient.get<PaginatedResponse<unknown>>(url, {
        params: { page: 1, per_page: 1 },
    });
    return data.count;
}

export function useContainersCount() {
    return useQuery({
        queryKey: ["dashboard", "containers-count"],
        queryFn: () => fetchCount("/storage/containers/"),
    });
}

export function useSamplesCount() {
    return useQuery({
        queryKey: ["dashboard", "samples-count"],
        queryFn: () => fetchCount("/samples/"),
    });
}

export function usePendingPlacementCount() {
    return useQuery({
        queryKey: ["dashboard", "pending-placement-count"],
        queryFn: () =>
            fetchCount("/storage/containers/?status=PENDING_PLACEMENT"),
    });
}

export function usePrintBatchesCount() {
    return useQuery({
        queryKey: ["dashboard", "print-batches-count"],
        queryFn: () => fetchCount("/labels/print-batches/"),
    });
}