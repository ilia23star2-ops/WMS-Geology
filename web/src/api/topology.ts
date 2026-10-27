/**
 * API топологии склада.
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
// Списки
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
// Одиночные сущности
// ============================================================

export function useRoom(id: number | null) {
    return useQuery({
        queryKey: ["topology", "room", id],
        queryFn: async () => {
            const { data } = await apiClient.get<Room>(`/storage/rooms/${id}/`);
            return data;
        },
        enabled: id !== null,
    });
}

export function useRack(id: number | null) {
    return useQuery({
        queryKey: ["topology", "rack", id],
        queryFn: async () => {
            const { data } = await apiClient.get<Rack>(`/storage/racks/${id}/`);
            return data;
        },
        enabled: id !== null,
    });
}

export function useSection(id: number | null) {
    return useQuery({
        queryKey: ["topology", "section", id],
        queryFn: async () => {
            const { data } = await apiClient.get<Section>(`/storage/sections/${id}/`);
            return data;
        },
        enabled: id !== null,
    });
}

export function useTier(id: number | null) {
    return useQuery({
        queryKey: ["topology", "tier", id],
        queryFn: async () => {
            const { data } = await apiClient.get<Tier>(`/storage/tiers/${id}/`);
            return data;
        },
        enabled: id !== null,
    });
}

export function useCell(id: number | null) {
    return useQuery({
        queryKey: ["topology", "cell", id],
        queryFn: async () => {
            const { data } = await apiClient.get<Cell>(`/storage/cells/${id}/`);
            return data;
        },
        enabled: id !== null,
    });
}

// ============================================================
// CRUD (мутации)
// ============================================================

function invalidateAll(qc: ReturnType<typeof useQueryClient>): void {
    void qc.invalidateQueries({ queryKey: ["topology"] });
}

export function useCreateRoom() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: RoomPayload) => {
            const { data } = await apiClient.post<Room>("/storage/rooms/", payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateRoom() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: RoomPayload }) => {
            const { data } = await apiClient.patch<Room>(`/storage/rooms/${id}/`, payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteRoom() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
            const query = force ? { force: "true" } : {};
            await apiClient.delete(`/storage/rooms/${id}/`, { params: query });
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useCreateRack() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: RackPayload) => {
            const { data } = await apiClient.post<Rack>("/storage/racks/", payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateRack() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: RackPayload }) => {
            const { data } = await apiClient.patch<Rack>(`/storage/racks/${id}/`, payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteRack() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
            const query = force ? { force: "true" } : {};
            await apiClient.delete(`/storage/racks/${id}/`, { params: query });
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useCreateSection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: SectionPayload) => {
            const { data } = await apiClient.post<Section>("/storage/sections/", payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateSection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: SectionPayload }) => {
            const { data } = await apiClient.patch<Section>(`/storage/sections/${id}/`, payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteSection() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
            const query = force ? { force: "true" } : {};
            await apiClient.delete(`/storage/sections/${id}/`, { params: query });
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useCreateTier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: TierPayload) => {
            const { data } = await apiClient.post<Tier>("/storage/tiers/", payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateTier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: TierPayload }) => {
            const { data } = await apiClient.patch<Tier>(`/storage/tiers/${id}/`, payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteTier() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
            const query = force ? { force: "true" } : {};
            await apiClient.delete(`/storage/tiers/${id}/`, { params: query });
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useCreateCell() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: CellPayload) => {
            const { data } = await apiClient.post<Cell>("/storage/cells/", payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdateCell() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: CellPayload }) => {
            const { data } = await apiClient.patch<Cell>(`/storage/cells/${id}/`, payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useDeleteCell() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, force }: { id: number; force?: boolean }) => {
            const query = force ? { force: "true" } : {};
            await apiClient.delete(`/storage/cells/${id}/`, { params: query });
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useCreatePallet() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (payload: PalletPayload) => {
            const { data } = await apiClient.post<Pallet>("/storage/pallets/", payload);
            return data;
        },
        onSuccess: () => invalidateAll(qc),
    });
}

export function useUpdatePallet() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: Partial<PalletPayload> }) => {
            const { data } = await apiClient.patch<Pallet>(`/storage/pallets/${id}/`, payload);
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
// QR
// ============================================================

export async function downloadSectionQrPdf(id: number): Promise<void> {
    const { data } = await apiClient.get(`/storage/sections/${id}/qr.pdf/`, { responseType: "blob" });
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadCellQrPdf(id: number): Promise<void> {
    const { data } = await apiClient.get(`/storage/cells/${id}/qr.pdf/`, { responseType: "blob" });
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export async function downloadCellsBatchQrPdf(items: QrBatchItem[]): Promise<void> {
    const { data } = await apiClient.post("/storage/sections/qr-batch/", { items }, { responseType: "blob" });
    const blob = new Blob([data as BlobPart], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
}