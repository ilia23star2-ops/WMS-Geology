/**
 * Хук создания партии тары с пробами.
 *
 * Backend: `POST /api/v1/storage/containers/bulk-create/`
 * (см. docs/API.md).
 *
 * Запрос — одна партия:
 * - общие Н/З (CODED + опционально INCOMING), тип исследования, участок;
 * - список тар; в каждой — группы проб (диапазоны).
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";
import type { Container } from "./containers";

export interface BulkSampleGroup {
    prefix: string;
    middle: string;
    sequence_from: number;
    sequence_to: number;
    sequence_digits: number;
    well_name?: string | null;
}

export interface BulkContainer {
    container_number: string;
    container_type_id: number;
    sample_groups: BulkSampleGroup[];
}

export interface BulkCreatePayload {
    work_order_coded: string;
    work_order_incoming?: string;
    research_type_id: number;
    site_id?: number | null;
    containers: BulkContainer[];
}

export interface BulkCreateResponse {
    created_containers: Container[];
    total_containers: number;
    total_samples: number;
}

export function useCreateContainers() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: BulkCreatePayload) => {
            const { data } = await apiClient.post<BulkCreateResponse>(
                "/storage/containers/bulk-create/",
                payload,
            );
            return data;
        },
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["containers"] });
            void qc.invalidateQueries({ queryKey: ["dashboard"] });
        },
    });
}