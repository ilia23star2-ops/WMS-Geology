/**
 * API напольных зон (zones-web + zones-web-crud).
 * Контракт: docs/API.md «Зоны (напольное хранение)».
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiClient } from "./client";

export interface Zone {
    id: number;
    room: number;
    code: string;
    name: string;
    qr_code: string | null;
    description: string;
}

export type RowOrientation = "horizontal" | "vertical";

export interface ZoneRow {
    id: number;
    zone: number;
    code: string;
    orientation: RowOrientation;
    qr_code: string | null;
    description: string;
}

export interface FloorPlace {
    id: number;
    row: number;
    code: number;
    description: string;
}

export interface ZoneSchemeLevel {
    container_id: number;
    level: number;
}

export interface ZoneSchemePlace {
    id: number;
    code: number;
    count: number;
    levels: ZoneSchemeLevel[];
}

export interface ZoneSchemeRow {
    id: number;
    code: string;
    orientation: RowOrientation;
    places: ZoneSchemePlace[];
}

export interface ZoneScheme {
    id: number;
    code: string;
    rows: ZoneSchemeRow[];
}

export interface ZonePayload {
    room: number;
    code: string;
    name?: string;
    description?: string;
}

export interface ZoneUpdatePayload {
    code?: string;
    name?: string;
    description?: string;
}

export interface ZoneRowPayload {
    zone: number;
    code: string;
    orientation: RowOrientation;
    description?: string;
}

export interface FloorPlacePayload {
    row: number;
    code: number;
    description?: string;
}

/** Все зоны (фильтр по комнате — на клиенте). */
export function useZones() {
    return useQuery({
        queryKey: ["zones"],
        queryFn: async () => {
            const { data } = await apiClient.get<Zone[] | { results: Zone[] }>(
                "/storage/zones/",
            );
            return Array.isArray(data) ? data : data.results;
        },
    });
}

/** Схема зоны: ряды → места → стопки. */
export function useZoneScheme(zoneId: number | null) {
    return useQuery({
        queryKey: ["zone-scheme", zoneId],
        queryFn: async () => {
            const { data } = await apiClient.get<ZoneScheme>(
                `/storage/zones/${zoneId}/scheme/`,
            );
            return data;
        },
        enabled: zoneId !== null,
    });
}

function useInvalidateZones() {
    const qc = useQueryClient();
    return () => {
        void qc.invalidateQueries({ queryKey: ["zones"] });
        void qc.invalidateQueries({ queryKey: ["zone-scheme"] });
    };
}

export function useCreateZone() {
    const inv = useInvalidateZones();
    return useMutation({
        mutationFn: async (p: ZonePayload) => (await apiClient.post<Zone>("/storage/zones/", p)).data,
        onSuccess: inv,
    });
}

export function useUpdateZone() {
    const inv = useInvalidateZones();
    return useMutation({
        mutationFn: async ({ id, payload }: { id: number; payload: ZoneUpdatePayload }) =>
            (await apiClient.patch<Zone>(`/storage/zones/${id}/`, payload)).data,
        onSuccess: inv,
    });
}

export function useDeleteZone() {
    const inv = useInvalidateZones();
    return useMutation({
        mutationFn: async (id: number) => {
            await apiClient.delete(`/storage/zones/${id}/`);
        },
        onSuccess: inv,
    });
}

export function useCreateZoneRow() {
    const inv = useInvalidateZones();
    return useMutation({
        mutationFn: async (p: ZoneRowPayload) => (await apiClient.post<ZoneRow>("/storage/zone-rows/", p)).data,
        onSuccess: inv,
    });
}

export function useCreateFloorPlace() {
    const inv = useInvalidateZones();
    return useMutation({
        mutationFn: async (p: FloorPlacePayload) => (await apiClient.post<FloorPlace>("/storage/floor-places/", p)).data,
        onSuccess: inv,
    });
}