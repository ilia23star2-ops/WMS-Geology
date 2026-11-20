/**
 * Состояние и отправка сессии оцифровки (6e-3-web-c, 6e-3-backend-4b).
 * Zustand: записи, фото, имя пакета и ПРОЦЕСС отправки живут вне компонента,
 * поэтому уход со страницы не теряет очередь и не обрывает отправку.
 * File-объекты — в module-level Map (переживают навигацию, не F5: ТД-96).
 */
import { create } from "zustand";

import { apiClient } from "../api/client";
import type { UploadStatus } from "../utils/uploadQueue";

export interface SessionPhoto {
    id: string;
    name: string;
    size: number;
    preview: string | null;
    status: UploadStatus;
    progress: number;
    taskId: number | null;
    error: string | null;
}

export interface SessionRecord {
    id: string;
    cellId: number | null;
    cellLabel: string;
    photos: SessionPhoto[];
}

/** File-объекты вне стора: переживают навигацию, не переживают перезагрузку. */
export const sessionFiles = new Map<string, File>();

let seq = 0;
const nid = (p: string) => `${p}-${Date.now()}-${++seq}`;

function errorText(e: unknown): string {
    const resp = (e as { response?: { data?: { error?: string }; status?: number } })?.response;
    if (resp?.data?.error) return resp.data.error;
    if (resp?.status) return `Сервер ответил ${resp.status}`;
    return e instanceof Error ? e.message : String(e);
}

interface OcrSessionState {
    records: SessionRecord[];
    batchId: number | null;
    /** Имя будущего пакета; null = сервер поставит автоимя. */
    batchName: string | null;
    /** Процесс отправки — глобальный, виден из любой страницы. */
    sending: boolean;
    stopRequested: boolean;
    sentCount: number;
    totalCount: number;
    currentLabel: string;
    addRecord: (cellId: number | null, cellLabel: string) => string;
    removeRecord: (id: string) => void;
    addPhotos: (recordId: string, files: File[]) => void;
    removePhoto: (recordId: string, photoId: string) => void;
    updatePhoto: (recordId: string, photoId: string, patch: Partial<SessionPhoto>) => void;
    setBatchId: (id: number | null) => void;
    setBatchName: (name: string | null) => void;
    requestStop: () => void;
    startSend: () => Promise<void>;
    clearAll: () => void;
}

export const useOcrSessionStore = create<OcrSessionState>((set, get) => ({
    records: [],
    batchId: null,
    batchName: null,
    sending: false,
    stopRequested: false,
    sentCount: 0,
    totalCount: 0,
    currentLabel: "",

    addRecord: (cellId, cellLabel) => {
        const id = nid("rec");
        set((s) => ({ records: [...s.records, { id, cellId, cellLabel, photos: [] }] }));
        return id;
    },

    removeRecord: (id) =>
        set((s) => {
            const rec = s.records.find((r) => r.id === id);
            rec?.photos.forEach((p) => {
                if (p.preview) URL.revokeObjectURL(p.preview);
                sessionFiles.delete(p.id);
            });
            return { records: s.records.filter((r) => r.id !== id) };
        }),

    addPhotos: (recordId, files) =>
        set((s) => {
            const added: SessionPhoto[] = [];
            for (const file of files) {
                const ok =
                    file.type.startsWith("image/") ||
                    /\.(jpe?g|png|webp|bmp|heic|heif)$/i.test(file.name);
                if (!ok) continue;
                const id = nid("ph");
                sessionFiles.set(id, file);
                let preview: string | null = null;
                try {
                    preview = URL.createObjectURL(file);
                } catch {
                    preview = null;
                }
                added.push({
                    id, name: file.name, size: file.size, preview,
                    status: "queued", progress: 0, taskId: null, error: null,
                });
            }
            return {
                records: s.records.map((r) =>
                    r.id === recordId ? { ...r, photos: [...r.photos, ...added] } : r,
                ),
            };
        }),

    removePhoto: (recordId, photoId) =>
        set((s) => ({
            records: s.records.map((r) => {
                if (r.id !== recordId) return r;
                const ph = r.photos.find((p) => p.id === photoId);
                if (ph?.preview) URL.revokeObjectURL(ph.preview);
                sessionFiles.delete(photoId);
                return { ...r, photos: r.photos.filter((p) => p.id !== photoId) };
            }),
        })),

    updatePhoto: (recordId, photoId, patch) =>
        set((s) => ({
            records: s.records.map((r) =>
                r.id === recordId
                    ? {
                        ...r,
                        photos: r.photos.map((p) => (p.id === photoId ? { ...p, ...patch } : p)),
                    }
                    : r,
            ),
        })),

    setBatchId: (id) => set({ batchId: id }),

    setBatchName: (name) =>
        set({ batchName: name === null ? null : name.trim() || null }),

    requestStop: () => set({ stopRequested: true }),

    /**
     * Отправка всей очереди. Первое фото создаёт пакет (и несёт имя сессии),
     * остальные идут в него же с cell_id своей записи. В конце — SENT.
     * Выполняется в сторе: уход со страницы не прерывает процесс.
     */
    startSend: async () => {
        if (get().sending) return;
        const plan = get().records.flatMap((r) =>
            r.photos
                .filter((p) => p.status === "queued" || p.status === "error")
                .map((p) => ({ r, p })),
        );
        if (plan.length === 0) return;

        set({
            sending: true,
            stopRequested: false,
            sentCount: 0,
            totalCount: plan.length,
            currentLabel: "",
        });

        let batch = get().batchId;
        let sent = 0;

        for (const { r, p } of plan) {
            if (get().stopRequested) break;
            const file = sessionFiles.get(p.id);
            if (!file) {
                get().updatePhoto(r.id, p.id, {
                    status: "error",
                    error: "Файл недоступен — добавь фото заново",
                });
                continue;
            }
            set({ currentLabel: r.cellLabel });
            get().updatePhoto(r.id, p.id, { status: "uploading", progress: 0, error: null });
            try {
                const form = new FormData();
                form.append("image", file);
                if (r.cellId !== null) form.append("cell_id", String(r.cellId));
                if (batch !== null) form.append("batch_id", String(batch));
                const name = get().batchName;
                if (batch === null && name) form.append("name", name);

                const { data } = await apiClient.post<{ task_id: number; batch_id: number }>(
                    "/ocr/recognize/",
                    form,
                    {
                        headers: { "Content-Type": "multipart/form-data" },
                        timeout: 180000,
                        onUploadProgress: (e) => {
                            const total = e.total ?? file.size;
                            const percent = total > 0 ? Math.round((e.loaded / total) * 100) : 0;
                            get().updatePhoto(r.id, p.id, {
                                progress: Math.min(100, Math.max(0, percent)),
                                status: percent >= 100 ? "recognizing" : "uploading",
                            });
                        },
                    },
                );
                batch = data.batch_id;
                set({ batchId: batch });
                get().updatePhoto(r.id, p.id, {
                    status: "done", progress: 100, taskId: data.task_id, error: null,
                });
            } catch (e) {
                const stopped = get().stopRequested;
                get().updatePhoto(r.id, p.id, {
                    status: stopped ? "canceled" : "error",
                    error: stopped ? null : errorText(e),
                });
            }
            sent += 1;
            set({ sentCount: sent });
        }

        if (!get().stopRequested && batch !== null) {
            try {
                await apiClient.patch(`/ocr/batches/${batch}/`, { status: "SENT" });
            } catch {
                // пакет останется DRAFT — повторить отправку можно из сессии
            }
        }
        set({ sending: false, currentLabel: "" });
    },

    clearAll: () =>
        set((s) => {
            s.records.forEach((r) => r.photos.forEach((p) => {
                if (p.preview) URL.revokeObjectURL(p.preview);
                sessionFiles.delete(p.id);
            }));
            return {
                records: [], batchId: null, batchName: null,
                sentCount: 0, totalCount: 0, currentLabel: "", stopRequested: false,
            };
        }),
}));