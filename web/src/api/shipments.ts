/**
 * API рейсов (`Shipment`).
 * ...
 * Пачка c-2.x-lab-portal-3: create-return.
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

export interface ShipmentContainerItem {
    id: number;
    shipment: number;
    container: number;
    position: number;
    container_number: string | null;
    container_status: string;
    container_type_name: string | null;
    draft_work_order_coded: string;
    draft_research_type_name: string | null;
    current_holder?: string | null;
}

export interface Shipment {
    id: number;
    shipment_number: string;
    name: string;
    direction: ShipmentDirection;
    destination: string;
    laboratory: number | null;
    laboratory_name: string | null;
    origin_laboratory: number | null;
    origin_laboratory_name: string | null;
    site: number | null;
    site_name: string | null;
    shipment_date: string | null;
    driver_name: string;
    vehicle_number: string;
    status: ShipmentStatus;
    sent_by: number | null;
    sent_by_username: string | null;
    sent_at: string | null;
    assembled_at: string | null;
    received_at: string | null;
    cancelled_at: string | null;
    cancelled_by: number | null;
    cancelled_by_username: string | null;
    cancel_reason: string;
    items_count: number;
    containers_count: number;
    container_items: ShipmentContainerItem[];
    can_mark_received: boolean;
    note: string;
    updated_at: string;
}

export interface ShipmentFilters {
    direction?: ShipmentDirection;
    status?: ShipmentStatus;
    laboratory_id?: number;
    site_id?: number;
    my_lab?: boolean;
}

export interface ShipmentsListParams {
    page: number;
    filters: ShipmentFilters;
}

export async function fetchShipments(
    params: ShipmentsListParams,
): Promise<PaginatedResponse<Shipment>> {
    const query: Record<string, string | number | boolean> = {
        page: params.page,
    };
    const f = params.filters;

    if (f.direction) query.direction = f.direction;
    if (f.status) query.status = f.status;
    if (f.laboratory_id !== undefined) {
        query.laboratory_id = f.laboratory_id;
    }
    if (f.site_id !== undefined) query.site_id = f.site_id;
    if (f.my_lab) query.my_lab = true;

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
        staleTime: 10_000,
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
        staleTime: 0,
    });
}

export interface CreateShipmentPayload {
    name?: string;
    direction: ShipmentDirection;
    shipment_number?: string;
    destination?: string;
    laboratory?: number | null;
    origin_laboratory?: number | null;
    site?: number | null;
    shipment_date?: string | null;
    driver_name?: string;
    vehicle_number?: string;
    note?: string;
}

export async function createShipment(
    payload: CreateShipmentPayload,
): Promise<Shipment> {
    const { data } = await apiClient.post<Shipment>(
        "/shipments/",
        payload,
    );
    return data;
}

export function useCreateShipment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: createShipment,
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
        },
    });
}

export interface UpdateShipmentPayload {
    shipment_number?: string;
    name?: string;
    direction?: ShipmentDirection;
    destination?: string;
    laboratory?: number | null;
    origin_laboratory?: number | null;
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
        onSuccess: (_data, { id }) => {
            void queryClient.invalidateQueries({ queryKey: ["shipment", id] });
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
            void queryClient.invalidateQueries({ queryKey: ["receipts"] });
        },
    });
}

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
        onSuccess: (_data, { id }) => {
            void queryClient.invalidateQueries({ queryKey: ["shipment", id] });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
        },
    });
}

export async function markReceived(id: number): Promise<Shipment> {
    const { data } = await apiClient.post<Shipment>(
        `/shipments/${id}/mark-received/`,
    );
    return data;
}

export function useMarkReceived() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: markReceived,
        onSuccess: (_data, id) => {
            void queryClient.invalidateQueries({ queryKey: ["shipment", id] });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
        },
    });
}

// ============================================================
// OUTBOUND: тары в рейсе
// ============================================================

interface AddContainersResponse {
    shipment: Shipment;
    added_count: number;
}

async function addContainersToShipment(
    shipmentId: number,
    containerIds: number[],
): Promise<AddContainersResponse> {
    const { data } = await apiClient.post<AddContainersResponse>(
        `/shipments/${shipmentId}/add-containers/`,
        { container_ids: containerIds },
    );
    return data;
}

export function useAddShipmentContainers(shipmentId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (containerIds: number[]) =>
            addContainersToShipment(shipmentId, containerIds),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["shipment", shipmentId],
            });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
        },
    });
}

interface RemoveContainerResponse {
    shipment: Shipment;
    removed: boolean;
}

async function removeContainerFromShipment(
    shipmentId: number,
    containerId: number,
): Promise<RemoveContainerResponse> {
    const { data } = await apiClient.post<RemoveContainerResponse>(
        `/shipments/${shipmentId}/remove-container/`,
        { container_id: containerId },
    );
    return data;
}

export function useRemoveShipmentContainer(shipmentId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (containerId: number) =>
            removeContainerFromShipment(shipmentId, containerId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["shipment", shipmentId],
            });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
        },
    });
}

// ============================================================
// Send / assemble
// ============================================================

export async function assembleShipment(shipmentId: number): Promise<Shipment> {
    const { data } = await apiClient.post<Shipment>(
        `/shipments/${shipmentId}/assemble/`,
    );
    return data;
}

export function useAssembleShipment(shipmentId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => assembleShipment(shipmentId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["shipment", shipmentId],
            });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
        },
    });
}

export async function sendShipment(shipmentId: number): Promise<Shipment> {
    const { data } = await apiClient.post<Shipment>(
        `/shipments/${shipmentId}/send/`,
    );
    return data;
}

export function useSendShipment(shipmentId: number) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: () => sendShipment(shipmentId),
        onSuccess: () => {
            void queryClient.invalidateQueries({
                queryKey: ["shipment", shipmentId],
            });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
            void queryClient.invalidateQueries({ queryKey: ["samples"] });
        },
    });
}

// ============================================================
// Create Return (c-2.x-lab-portal-3)
// ============================================================

interface CreateReturnResponse {
    shipment: Shipment;
    returned_containers_count: number;
    new_container_ids: number[];
}

export async function createReturn(
    shipmentId: number,
    containerIds?: number[],
): Promise<CreateReturnResponse> {
    const { data } = await apiClient.post<CreateReturnResponse>(
        `/shipments/${shipmentId}/create-return/`,
        { container_ids: containerIds },
    );
    return data;
}

export function useCreateReturn() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            shipmentId,
            containerIds,
        }: {
            shipmentId: number;
            containerIds?: number[];
        }) => createReturn(shipmentId, containerIds),
        onSuccess: (_data, { shipmentId }) => {
            void queryClient.invalidateQueries({ queryKey: ["shipment", shipmentId] });
            void queryClient.invalidateQueries({ queryKey: ["shipments"] });
            void queryClient.invalidateQueries({ queryKey: ["containers"] });
            void queryClient.invalidateQueries({ queryKey: ["samples"] });
        },
    });
}