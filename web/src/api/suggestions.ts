/**
 * Хук контекстных подсказок (Smart Input).
 *
 * Backend: GET /storage/suggestions/?site=1&work_order=TST0001&research_type=ШЛ
 *
 * c-3.x-migration-5d-fix: + work_orders_incoming (Н/З входящие).
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface SuggestionResponse {
    work_orders: string[];
    work_orders_incoming: string[];
    research_types: string[];
    samples: string[];
    wells: string[];
}

export interface SuggestionParams {
    site?: number;
    work_order?: string;
    research_type?: string;
}

export async function fetchSuggestions(
    params: SuggestionParams,
): Promise<SuggestionResponse> {
    const { data } = await apiClient.get<SuggestionResponse>(
        "/storage/suggestions/",
        { params },
    );
    return data;
}

export function useSuggestions(params: SuggestionParams, enabled: boolean = true) {
    return useQuery({
        queryKey: ["suggestions", params],
        queryFn: () => fetchSuggestions(params),
        enabled: enabled,
        staleTime: 60_000,
    });
}