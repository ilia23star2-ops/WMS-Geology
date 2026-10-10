/**
 * Хук справочника типов тары. Используется в фильтрах
 * и для отображения имени типа в реестре.
 */
import { useQuery } from "@tanstack/react-query";

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
    description: string;
}

export async function fetchContainerTypes(): Promise<ContainerType[]> {
    const { data } = await apiClient.get<PaginatedResponse<ContainerType>>(
        "/storage/container-types/",
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