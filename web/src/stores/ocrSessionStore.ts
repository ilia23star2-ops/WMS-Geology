/**
 * Состояние сессии оцифровки (6e-3-web-c, +имя пакета 6e-3-backend).
 * Zustand: записи, фото и имя пакета переживают переходы между страницами.
 * Сами File лежат в module-level Map (не сериализуются), превью — objectURL.
 */
import { create } from "zustand";

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

interface OcrSessionState {
    records: SessionRecord[];
    batchId: number | null;
    /** Имя будущего пакета; null = сервер поставит автоимя. */
    batchName: string | null;
    addRecord: (cellId: number | null, cellLabel: string) => string;
    removeRecord: (id: string) => void;
    addPhotos: (recordId: string, files: File[]) => void;
    removePhoto: (recordId: string, photoId: string) => void;
    updatePhoto: (recordId: string, photoId: string, patch: Partial<SessionPhoto>) => void;
    setBatchId: (id: number | null) => void;
    setBatchName: (name: string | null) => void;
    clearAll: () => void;
}

export const useOcrSessionStore = create<OcrSessionState>((set) => ({
    records: [],
    batchId: null,
    batchName: null,

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

    clearAll: () =>
        set((s) => {
            s.records.forEach((r) => r.photos.forEach((p) => {
                if (p.preview) URL.revokeObjectURL(p.preview);
                sessionFiles.delete(p.id);
            }));
            return { records: [], batchId: null, batchName: null };
        }),
}));