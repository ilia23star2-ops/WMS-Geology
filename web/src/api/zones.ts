/**
 * API напольных зон (zones-web).
 * Контракт: docs/API.md «Зоны (напольное хранение)».
 */
import { useQuery } from "@tanstack/react-query";

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