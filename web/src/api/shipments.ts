/**
 * API рейсов (`Shipment`).
 *
 * Фильтры по direction / status / laboratory_id / site_id.
 * Список — DRF-пагинация (50 на страницу).
 *
 * Пачка 2f-6a: добавлены update / delete / cancel.
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type ShipmentDirection = "INBOUND" | "OUTBOUND";

export const SHIPMENT_DIRECTION_LABELS: Record<ShipmentDirection, string> = {
    INBOUND: "Входящий (лаборатория → мы)",
    OUTBOUND: "Исходящий (мы → лаборатория)",
};

export type ShipmentStatus =
    | "DRAFT"
    | "ASSEMBLED"
    | "SENT"
    | "RECEIVED"
    | "PARTIALLY_RECEIVED"
    | "RETURNED"
    | "CANCELLED"
    | "LOST";

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
    DRAFT: "Черновик",
    ASSEMBLED: "Собран",
    SENT: "Отправлен",
    RECEIVED: "Принят",
    PARTIALLY_RECEIVED: "Принят с расхождениями",
    RETURNED: "Возвращён",
    CANCELLED: "Отменён",
    LOST: "Утерян",
};

export interface Shipment {
    id: number;
    shipment_number: string;
    direction: ShipmentDirection;
    destination: string;
    laboratory: number | null;
    laboratory_name: string | null;
    site: number | null;
    site_name: string | null;
    shipment_date: string | null;
    driver_name: string;
    vehicle_number: string;
    status: ShipmentStatus;
    sent_by: number | null;
    sent_by_username: string | null;
    sent_at: string;
    assembled_at: string | null;
    received_at: string | null;
    cancelled_at: string | null;
    cancelled_by: number | null;
    cancelled_by_username: string | null;
    cancel_reason: string;
    items_count: number;
    containers_count: number;
    note: string;
}

export interface ShipmentFilters {
    direction?: ShipmentDirection;
    status?: ShipmentStatus;
    laboratory_id?: number;
    site_id?: number;
}

export interface ShipmentsListParams {
    page: number;
    filters: ShipmentFilters;
}

export async function fetchShipments(
    params: ShipmentsListParams,
): Promise<PaginatedResponse<Shipment>> {
    const query: Record<string, string | number> = { page: params.page };
    const f = params.filters;

    if (f.direction) query.direction = f.direction;
    if (f.status) query.status = f.status;
    if (f.laboratory_id !== undefined) {
        query.laboratory_id = f.laboratory_id;
    }
    if (f.site_id !== undefined) query.site_id = f.site_id;

    const { data } = await apiClient.get<PaginatedResponse<Shipment>>(
        "/shipments/",
        { params: query },
    );
    return data;
}

export function useShipments(params: ShipmentsListParams) {
    return useQuery({
        queryKey: ["shipments", params],
        queryFn: () => fetchShipments(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}

export async function fetchShipment(id: number): Promise<Shipment> {
    const { data } = await apiClient.get<Shipment>(
        `/shipments/${id}/`,
    );
    return data;
}

export function useShipment(id: number | null) {
    return useQuery({
        queryKey: ["shipment", id],
        queryFn: () => fetchShipment(id as number),
        enabled: typeof id === "number" && !Number.isNaN(id),
        staleTime: 10_000,
    });
}

// ============================================================
// Мутации (2f-6a)
// ============================================================

/**
 * Поля, доступные для правки рейса.
 * `status` — намеренно не здесь: меняется через `cancel` action.
 * `sent_by`, `sent_at`, `cancelled_*` — read-only.
 */
export interface UpdateShipmentPayload {
    shipment_number?: string;
    direction?: ShipmentDirection;
    destination?: string;
    laboratory?: number | null;
    site?: number | null;
    shipment_date?: string | null;
    driver_name?: string;
    vehicle_number?: string;
    note?: string;
}

export async function updateShipment(
    id: number,
    payload: UpdateShipmentPayload,
): Promise<Shipment> {
    const { data } = await apiClient.patch<Shipment>(
        `/shipments/${id}/`,
        payload,
    );
    return data;
}

export function useUpdateShipment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            payload,
        }: {
            id: number;
            payload: UpdateShipmentPayload;
        }) => updateShipment(id, payload),
        onSuccess: (data) => {
            queryClient.setQueryData(["shipment", data.id], data);
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
        },
    });
}

export async function deleteShipment(id: number): Promise<void> {
    await apiClient.delete(`/shipments/${id}/`);
}

export function useDeleteShipment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteShipment(id),
        onSuccess: (_void, id) => {
            queryClient.removeQueries({ queryKey: ["shipment", id] });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
            // Связанные Receipt теряют shipment (SET_NULL на backend).
            void queryClient.invalidateQueries({ queryKey: ["receipts"] });
        },
    });
}

/**
 * Отмена рейса: `POST /shipments/{id}/cancel/`.
 * Backend вернёт 400, если статус — RECEIVED / PARTIALLY_RECEIVED /
 * CANCELLED. `reason` опционален.
 */
export async function cancelShipment(
    id: number,
    reason?: string,
): Promise<Shipment> {
    const body = reason && reason.trim() ? { reason: reason.trim() } : {};
    const { data } = await apiClient.post<Shipment>(
        `/shipments/${id}/cancel/`,
        body,
    );
    return data;
}

export function useCancelShipment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            reason,
        }: {
            id: number;
            reason?: string;
        }) => cancelShipment(id, reason),
        onSuccess: (data) => {
            queryClient.setQueryData(["shipment", data.id], data);
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
        },
    });
}