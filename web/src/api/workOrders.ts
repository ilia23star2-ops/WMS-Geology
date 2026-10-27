/**
 * API наряд-заказов (WorkOrder).
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

export type WorkOrderType = "INCOMING" | "CODED";
export type WorkOrderStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export const WORK_ORDER_TYPE_LABELS: Record<WorkOrderType, string> = {
    INCOMING: "Входящий",
    CODED: "Текущий",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
    ACTIVE: "Активен",
    COMPLETED: "Завершён",
    CANCELLED: "Отменён",
};

export interface WorkOrderContainer {
    id: number;
    number: string | null;
    container_type_name: string;
    location: string;
    samples_count: number;
}

export interface WorkOrder {
    id: number;
    order_number: string;
    order_type: WorkOrderType;
    linked_order: number | null;
    linked_order_number: string | null;
    site: number | null;
    site_name: string | null;
    status: WorkOrderStatus;
    description: string;
    samples_count: number;
    containers: WorkOrderContainer[];
    created_at: string;
}

export interface WorkOrdersListParams {
    page: number;
    order_type?: WorkOrderType;
    status?: WorkOrderStatus;
    order_number?: string;
}

export async function fetchWorkOrders(
    params: WorkOrdersListParams,
): Promise<PaginatedResponse<WorkOrder>> {
    const query: Record<string, string | number> = { page: params.page };
    if (params.order_type) query.order_type = params.order_type;
    if (params.status) query.status = params.status;
    if (params.order_number) query.order_number = params.order_number;

    const { data } = await apiClient.get<PaginatedResponse<WorkOrder>>(
        "/work-orders/",
        { params: query },
    );
    return data;
}

export function useWorkOrders(params: WorkOrdersListParams) {
    return useQuery({
        queryKey: ["work-orders", params],
        queryFn: () => fetchWorkOrders(params),
        placeholderData: keepPreviousData,
        staleTime: 30_000,
    });
}

export interface UpdateWorkOrderPayload {
    order_number?: string;
    order_type?: WorkOrderType;
    linked_order?: number | null;
    site?: number | null;
    status?: WorkOrderStatus;
    description?: string;
}

export async function createWorkOrder(
    payload: UpdateWorkOrderPayload,
): Promise<WorkOrder> {
    const { data } = await apiClient.post<WorkOrder>("/work-orders/", payload);
    return data;
}

export function useCreateWorkOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: createWorkOrder,
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["work-orders"] });
        },
    });
}

export async function updateWorkOrder(
    id: number,
    payload: UpdateWorkOrderPayload,
): Promise<WorkOrder> {
    const { data } = await apiClient.patch<WorkOrder>(
        `/work-orders/${id}/`,
        payload,
    );
    return data;
}

export function useUpdateWorkOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, payload }: { id: number; payload: UpdateWorkOrderPayload }) =>
            updateWorkOrder(id, payload),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["work-orders"] });
        },
    });
}

export async function deleteWorkOrder(id: number): Promise<void> {
    await apiClient.delete(`/work-orders/${id}/`);
}

export function useDeleteWorkOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: (id: number) => deleteWorkOrder(id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["work-orders"] });
        },
    });
}

export async function linkWorkOrder(
    id: number,
    linkedOrderId: number,
): Promise<WorkOrder> {
    const { data } = await apiClient.post<WorkOrder>(
        `/work-orders/${id}/link/`,
        { linked_order_id: linkedOrderId },
    );
    return data;
}

export function useLinkWorkOrder() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ id, linkedId }: { id: number; linkedId: number }) =>
            linkWorkOrder(id, linkedId),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: ["work-orders"] });
        },
    });
}