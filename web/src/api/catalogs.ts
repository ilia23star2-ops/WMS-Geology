/**
 * Хуки справочников, используемых в фильтрах и отображении.
 *
 * URL: `/api/v1/<resource>/` — приложение `samples` подключено
 * к `/api/v1/` без префикса (см. wms_geology/urls.py).
 */
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export interface ResearchType {
    id: number;
    code: string;
    name: string;
    description: string;
    sort_order: number;
    is_active: boolean;
}

export interface Site {
    id: number;
    code: string;
    name: string;
    match_patterns: string[];
    description: string;
    sort_order: number;
    is_active: boolean;
}

export interface Laboratory {
    id: number;
    code: string;
    name: string;
    prefixes: string[];
    description: string;
    sort_order: number;
    is_active: boolean;
}

async function fetchList<T>(url: string): Promise<T[]> {
    const { data } = await apiClient.get<PaginatedResponse<T>>(url);
    return data.results;
}

export function useResearchTypes() {
    return useQuery({
        queryKey: ["research-types"],
        queryFn: () => fetchList<ResearchType>("/research-types/"),
        staleTime: 5 * 60_000,
    });
}

export function useSites() {
    return useQuery({
        queryKey: ["sites"],
        queryFn: () => fetchList<Site>("/sites/"),
        staleTime: 5 * 60_000,
    });
}

export function useLaboratories() {
    return useQuery({
        queryKey: ["laboratories"],
        queryFn: () => fetchList<Laboratory>("/laboratories/"),
        staleTime: 5 * 60_000,
    });
}