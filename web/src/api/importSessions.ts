/**
 * API импорта Excel-рейса.
 *
 * Один эндпоинт: `POST /import-sessions/import-shipment/`.
 * Form-data: file, target_date, опционально shipment_number и laboratory_id.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

/**
 * Вопрос по спорной ячейке (см. API.md → `import-shipment`).
 * Код `NEEDS_CONFIRMATION`, `reason` — один из трёх.
 */
export type ImportQuestionReason =
    | "no_dates"
    | "multi_date_match"
    | "target_date_not_matched";

export interface ImportQuestion {
    code: "NEEDS_CONFIRMATION";
    reason: ImportQuestionReason;
    sheet: string;
    work_order: string;
    research_type: string;
    container_type: string;
    containers_count: number;
    raw_dates: string[];
    target_date?: string;
    message: string;
}

export interface ImportError {
    code?: string;
    sheet?: string;
    row?: number;
    column?: number;
    error?: string;
    work_order?: string;
    [key: string]: unknown;
}

export interface ImportShipmentRequest {
    file: File;
    target_date: string; // ISO или `DD.MM.YYYY`
    shipment_number?: string;
    laboratory_id?: number;
}

export interface ImportShipmentResponse {
    import_session_id: number;
    status: "APPLIED" | "PARSED" | "ERROR";
    shipment_id: number | null;
    shipment_number: string | null;
    receipt_id: number | null;
    receipt_number: string | null;
    containers_count: number;
    questions_count: number;
    parse_errors: ImportError[];
}

export async function importShipment(
    payload: ImportShipmentRequest,
): Promise<ImportShipmentResponse> {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("target_date", payload.target_date);
    if (payload.shipment_number) {
        form.append("shipment_number", payload.shipment_number);
    }
    if (payload.laboratory_id !== undefined) {
        form.append(
            "laboratory_id",
            String(payload.laboratory_id),
        );
    }

    const { data } = await apiClient.post<ImportShipmentResponse>(
        "/import-sessions/import-shipment/",
        form,
        {
            headers: { "Content-Type": "multipart/form-data" },
        },
    );
    return data;
}

export function useImportShipment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: importShipment,
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["shipments"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["receipts"],
            });
            void queryClient.invalidateQueries({
                queryKey: ["containers"],
            });
        },
    });
}