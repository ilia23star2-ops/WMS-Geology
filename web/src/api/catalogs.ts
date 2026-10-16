/**
 * Хуки справочников: типы исследования, участки, лаборатории.
 *
 * URL: `/api/v1/<resource>/` — приложение `samples` подключено
 * к `/api/v1/` без префикса.
 *
 * Пачка 2f-3a: добавлены CRUD-мутации (create / update / delete
 * + soft `toggleActive`).
 */
import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { apiClient } from "./client";
import type { PaginatedResponse } from "./types";

// ============================================================
// Типы
// ============================================================

export interface ResearchType {
    id: number;
    code: string;
    name: string;
    description: string;
    sort_order: number;
    is_active: boolean;
}

export interface Site {
    id: number;
    code: string;
    name: string;
    match_patterns: string[];
    description: string;
    sort_order: number;
    is_active: boolean;
}

export interface Laboratory {
    id: number;
    code: string;
    name: string;
    prefixes: string[];
    description: string;
    sort_order: number;
    is_active: boolean;
}

/** Универсальная форма payload для трёх справочников. */
export interface CatalogPayload {
    code: string;
    name: string;
    description: string;
    sort_order: number;
    is_active: boolean;
    /** Только для `Site`. */
    match_patterns?: string[];
    /** Только для `Laboratory`. */
    prefixes?: string[];
}

export type CatalogKind = "research-types" | "sites" | "laboratories";

/** Соответствие `kind` → URL и query-key. */
export const CATALOG_META: Record<
    CatalogKind,
    { url: string; queryKey: string }
> = {
    "research-types": {
        url: "/research-types/",
        queryKey: "research-types",
    },
    sites: {
        url: "/sites/",
        queryKey: "sites",
    },
    laboratories: {
        url: "/laboratories/",
        queryKey: "laboratories",
    },
};

// ============================================================
// Список (для фильтров и отображения)
// ============================================================

async function fetchList<T>(url: string): Promise<T[]> {
    const { data } = await apiClient.get<PaginatedResponse<T>>(url);
    return data.results;
}

export function useResearchTypes() {
    return useQuery({
        queryKey: ["research-types"],
        queryFn: () => fetchList<ResearchType>("/research-types/"),
        staleTime: 5 * 60_000,
    });
}

export function useSites() {
    return useQuery({
        queryKey: ["sites"],
        queryFn: () => fetchList<Site>("/sites/"),
        staleTime: 5 * 60_000,
    });
}

export function useLaboratories() {
    return useQuery({
        queryKey: ["laboratories"],
        queryFn: () => fetchList<Laboratory>("/laboratories/"),
        staleTime: 5 * 60_000,
    });
}

// ============================================================
// CRUD (пачка 2f-3a)
// ============================================================

async function createOne<T>(
    kind: CatalogKind,
    payload: CatalogPayload,
): Promise<T> {
    const meta = CATALOG_META[kind];
    const { data } = await apiClient.post<T>(meta.url, payload);
    return data;
}

async function updateOne<T>(
    kind: CatalogKind,
    id: number,
    payload: Partial<CatalogPayload>,
): Promise<T> {
    const meta = CATALOG_META[kind];
    const { data } = await apiClient.patch<T>(
        `${meta.url}${id}/`,
        payload,
    );
    return data;
}

async function deleteOne(kind: CatalogKind, id: number): Promise<void> {
    const meta = CATALOG_META[kind];
    await apiClient.delete(`${meta.url}${id}/`);
}

export function useCreateCatalog(kind: CatalogKind) {
    const qc = useQueryClient();
    const meta = CATALOG_META[kind];
    return useMutation({
        mutationFn: (payload: CatalogPayload) =>
            createOne(kind, payload),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: [meta.queryKey] });
        },
    });
}

export function useUpdateCatalog(kind: CatalogKind) {
    const qc = useQueryClient();
    const meta = CATALOG_META[kind];
    return useMutation({
        mutationFn: ({ id, payload }: {
            id: number;
            payload: Partial<CatalogPayload>;
        }) => updateOne(kind, id, payload),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: [meta.queryKey] });
        },
    });
}

export function useDeleteCatalog(kind: CatalogKind) {
    const qc = useQueryClient();
    const meta = CATALOG_META[kind];
    return useMutation({
        mutationFn: (id: number) => deleteOne(kind, id),
        onSuccess: () => {
            void qc.invalidateQueries({ queryKey: [meta.queryKey] });
        },
    });
}