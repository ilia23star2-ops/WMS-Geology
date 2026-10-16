/**
 * API топологии склада: Room → Rack → Section → Tier → Cell → Pallet.
 *
 * CRUD для всех шести сущностей (Pallet добавлен в 2f-4b).
 *
 * QR (2f-4c-2):
 * - `downloadSectionQrPdf` — PDF с QR одной секции.
 * - `downloadCellQrPdf` — PDF с QR одной ячейки.
 * - `downloadCellsBatchQrPdf` — POST-батч, PDF с несколькими QR.
 */
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

// ============================================================
// Типы
// ============================================================

export interface Room {
    id: number;
    name: string;
    description: string;
}

export interface Rack {
    id: number;
    room: number;
    code: string;
    description: string;
}

export type TierCode = "A" | "B" | "C" | "D";

export interface Section {
    id: number;
    rack: number;
    code: string;
    qr_code: string | null;
    description: string;
}

export interface Tier {
    id: number;
    section: number;
    code: TierCode;
    level_number: number | null;
    description: string;
}

export type CellType = "STANDARD" | "CORE";

export const CELL_TYPE_LABELS: Record<CellType, string> = {
    STANDARD: "Обычная",
    CORE: "Керновая",
};

export interface Cell {
    id: number;
    tier: number;
    code: string;
    full_address: string;
    cell_type: CellType;
    qr_code: string | null;
    is_active: boolean;
}

export type PalletType = "STANDARD" | "CORE";

export const PALLET_TYPE_LABELS: Record<PalletType, string> = {
    STANDARD: "Обычный",
    CORE: "Керновый",
};

export type PalletStatus = "ACTIVE" | "EMPTY" | "IN_TRANSIT";

export const PALLET_STATUS_LABELS: Record<PalletStatus, string> = {
    ACTIVE: "Активен",
    EMPTY: "Пуст",
    IN_TRANSIT: "В пути",
};

export interface Pallet {
    id: number;
    cell: number | null;
    floor_room: number | null;
    pallet_type: PalletType;
    capacity_override: Record<string, number>;
    status: PalletStatus;
    created_at: string;
}

// ============================================================
// Payload
// ============================================================

export interface RoomPayload {
    name: string;
    description: string;
}

export interface RackPayload {
    room: number;
    code: string;
    description: string;
}

export interface SectionPayload {
    rack: number;
    code: string;
    qr_code: string | null;
    description: string;
}

export interface TierPayload {
    section: number;
    code: TierCode;
    level_number: number | null;
    description: string;
}

export interface CellPayload {
    tier: number;
    code: string;
    full_address: string;
    cell_type: CellType;
    qr_code: string | null;
    is_active: boolean;
}

export interface PalletPayload {
    cell?: number | null;
    floor_room?: number | null;
    pallet_type: PalletType;
    status: PalletStatus;
}

export type QrBatchItemType = "SECTION" | "CELL";

export interface QrBatchItem {
    type: QrBatchItemType;
    id: number;
}

// ============================================================
// Списки (с фильтрами по родителю)
// ============================================================

async function fetchList<T>(
    url: string,
    params?: Record<string, string | number>,
): Promise<T[]> {
    const { data } = await apiClient.get<PaginatedResponse<T>>(url, {
        params,
    });
    return data.results;
}

export function useRooms() {
    return useQuery({
        queryKey: ["topology", "rooms"],
        queryFn: () => fetchList<Room>("/storage/rooms/"),
        staleTime: 60_000,
    });
}

export function useRacks(roomId: number | null) {
    return useQuery({
        queryKey: ["topology", "racks", roomId],
        queryFn: () =>
            fetchList<Rack>("/storage/racks/", {
                room_id: roomId as number,
            }),
        enabled: roomId !== null,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });
}

export function useSections(rackId: number | null) {
    return useQuery({
        queryKey: ["topology", "sections", rackId],
        queryFn: () =>
            fetchList<Section>("/storage/sections/", {
                rack_id: rackId as number,
            }),
        enabled: rackId !== null,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });
}

export function useTiers(sectionId: number | null) {
    return useQuery({
        queryKey: ["topology", "tiers", sectionId],
        queryFn: () =>
            fetchList<Tier>("/storage/tiers/", {
                section_id: sectionId as number,
            }),
        enabled: sectionId !== null,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });
}

export function useCells(tierId: number | null) {
    return useQuery({
        queryKey: ["topology", "cells", tierId],
        queryFn: () =>
            fetchList<Cell>("/storage/cells/", {
                tier_id: tierId as number,
            }),
        enabled: tierId !== null,
        placeholderData: keepPreviousData,
        staleTime: 60_000,
    });
}

/**
 * Поддон, стоящий в ячейке (или `null`, если пусто).
 *
 * `Pallet.cell` — OneToOne, максимум один поддон на ячейку.
 * Фильтр `?cell_id=` возвращает 0 или 1 запись.
 */
export function usePalletByCell(cellId: number | null) {
    return useQuery({
        queryKey: ["topology", "pallet-by-cell", cellId],
        queryFn: async (): Promise<Pallet | null> => {
            const list = await fetchList<Pallet>("/storage/pallets/", {
                cell_id: cellId as number,
            });
            return list[0] ?? null;
        },
        enabled: cellId !== null,
        staleTime: 30_000,
    });
}

// ============================================================
// CRUD
// ============================================================

/** Инвалидирует все запросы топологии (после любой мутации). */
function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
    void qc.invalidateQueries({ queryKey: ["topology"] });
}

// --- Rooms ---
export function useCreateRoom() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: RoomPayload) => {
            const { data } = await apiClient.post<Room>(
                "/storage/rooms/",
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateRoom() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: {
            id: number;
            payload: RoomPayload;
        }) => {
            const { data } = await apiClient.patch<Room>(
                `/storage/rooms/${id}/`,
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteRoom() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/storage/rooms/${id}/`);
        },
        onSuccess: () => invalidateAll(qc),
    });
}

// --- Racks ---
export function useCreateRack() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: RackPayload) => {
            const { data } = await apiClient.post<Rack>(
                "/storage/racks/",
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateRack() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: {
            id: number;
            payload: RackPayload;
        }) => {
            const { data } = await apiClient.patch<Rack>(
                `/storage/racks/${id}/`,
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteRack() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/storage/racks/${id}/`);
        },
        onSuccess: () => invalidateAll(qc),
    });
}

// --- Sections ---
export function useCreateSection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: SectionPayload) => {
            const { data } = await apiClient.post<Section>(
                "/storage/sections/",
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateSection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: {
            id: number;
            payload: SectionPayload;
        }) => {
            const { data } = await apiClient.patch<Section>(
                `/storage/sections/${id}/`,
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteSection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/storage/sections/${id}/`);
        },
        onSuccess: () => invalidateAll(qc),
    });
}

// --- Tiers ---
export function useCreateTier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TierPayload) => {
            const { data } = await apiClient.post<Tier>(
                "/storage/tiers/",
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateTier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: {
            id: number;
            payload: TierPayload;
        }) => {
            const { data } = await apiClient.patch<Tier>(
                `/storage/tiers/${id}/`,
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteTier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/storage/tiers/${id}/`);
        },
        onSuccess: () => invalidateAll(qc),
    });
}

// --- Cells ---
export function useCreateCell() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CellPayload) => {
            const { data } = await apiClient.post<Cell>(
                "/storage/cells/",
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateCell() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: {
            id: number;
            payload: CellPayload;
        }) => {
            const { data } = await apiClient.patch<Cell>(
                `/storage/cells/${id}/`,
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteCell() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/storage/cells/${id}/`);
        },
        onSuccess: () => invalidateAll(qc),
    });
}

// --- Pallets (2f-4b) ---
export function useCreatePallet() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: PalletPayload) => {
            const { data } = await apiClient.post<Pallet>(
                "/storage/pallets/",
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdatePallet() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: {
            id: number;
            payload: Partial<PalletPayload>;
        }) => {
            const { data } = await apiClient.patch<Pallet>(
                `/storage/pallets/${id}/`,
                payload,
            );
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeletePallet() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/storage/pallets/${id}/`);
        },
        onSuccess: () => invalidateAll(qc),
    });
}

// ============================================================
// QR (2f-4c-2)
// ============================================================

/**
 * Открывает в новой вкладке PDF с QR одной секции.
 *
 * Паттерн тот же, что в `containers.ts` → `downloadLabelPdf`.
 * URL живёт 60 секунд — вкладка успевает подхватить.
 */
export async function downloadSectionQrPdf(id: number): Promise<void> {
    const { data } = await apiClient.get(
        `/storage/sections/${id}/qr.pdf/`,
        { responseType: "blob" },
    );
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Открывает в новой вкладке PDF с QR одной ячейки. */
export async function downloadCellQrPdf(id: number): Promise<void> {
    const { data } = await apiClient.get(
        `/storage/cells/${id}/qr.pdf/`,
        { responseType: "blob" },
    );
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * POST-батч: PDF с несколькими QR.
 *
 * `items` — массив `{type, id}` (Section / Cell).
 * Backend сам собирает адреса под каждым QR.
 */
export async function downloadCellsBatchQrPdf(
    items: QrBatchItem[],
): Promise<void> {
    const { data } = await apiClient.post(
        "/storage/sections/qr-batch/",
        { items },
        { responseType: "blob" },
    );
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}