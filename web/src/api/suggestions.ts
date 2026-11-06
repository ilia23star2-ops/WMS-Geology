/**
 * Хук контекстных подсказок (Smart Input).
 *
 * Backend: GET /storage/suggestions/?site=1&work_order=TST0001&research_type=ШЛ
 */
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

export interface SuggestionResponse {
    work_orders: string[];
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
        enabled: enabled, // Запрос только когда есть контекст
        staleTime: 60_000,
    });
}