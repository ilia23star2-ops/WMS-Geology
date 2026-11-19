/**
 * Очередь загрузки фото в OCR (6e-3-web).
 * Чистая модель очереди: статусы, прогресс, порядок, повторы, сводка.
 * Сетевые вызовы и состояние — в hooks/useOcrUpload, здесь только логика.
 */

export type UploadStatus =
    | "queued"
    | "uploading"
    | "recognizing"
    | "done"
    | "error"
    | "canceled";

export interface QueueItem {
    id: string;
    name: string;
    size: number;
    preview: string | null;
    status: UploadStatus;
    /** Прогресс отправки байтов, 0..100. Распознавание идёт после 100%. */
    progress: number;
    taskId: number | null;
    error: string | null;
}

export interface QueueSummary {
    total: number;
    queued: number;
    active: number;
    done: number;
    failed: number;
    canceled: number;
    percent: number;
}

export type QueueSort = "order" | "name" | "size" | "status";

export const STATUS_LABELS: Record<UploadStatus, string> = {
    queued: "В очереди",
    uploading: "Отправка",
    recognizing: "Распознавание",
    done: "Готово",
    error: "Ошибка",
    canceled: "Остановлено",
};

export function makeItem(
    name: string,
    size: number,
    id: string,
    preview: string | null = null,
): QueueItem {
    return { id, name, size, preview, status: "queued", progress: 0, taskId: null, error: null };
}

export function patchItem(
    items: QueueItem[],
    id: string,
    patch: Partial<QueueItem>,
): QueueItem[] {
    return items.map((it) => (it.id === id ? { ...it, ...patch } : it));
}

export function nextQueuedId(items: QueueItem[]): string | null {
    const next = items.find((it) => it.status === "queued");
    return next ? next.id : null;
}

export function removeItem(items: QueueItem[], id: string): QueueItem[] {
    return items.filter((it) => it.id !== id);
}

/** Перемещение фото в очереди; за границы не выходит. */
export function moveItem(items: QueueItem[], id: string, dir: -1 | 1): QueueItem[] {
    const index = items.findIndex((it) => it.id === id);
    const target = index + dir;
    if (index < 0 || target < 0 || target >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    return next;
}

/** Ошибочные и остановленные — снова в очередь, прогресс сброшен. */
export function retryFailed(items: QueueItem[]): QueueItem[] {
    return items.map((it) =>
        it.status === "error" || it.status === "canceled"
            ? { ...it, status: "queued", progress: 0, error: null }
            : it,
    );
}

export function canStart(items: QueueItem[], running: boolean): boolean {
    return !running && items.some((it) => it.status === "queued");
}

export function queueSummary(items: QueueItem[]): QueueSummary {
    const total = items.length;
    let queued = 0;
    let active = 0;
    let done = 0;
    let failed = 0;
    let canceled = 0;
    let weight = 0;
    for (const it of items) {
        if (it.status === "queued") queued++;
        else if (it.status === "uploading") {
            active++;
            weight += Math.min(100, Math.max(0, it.progress)) / 100;
        } else if (it.status === "recognizing") {
            active++;
            weight += 0.9;
        } else if (it.status === "done") {
            done++;
            weight += 1;
        } else if (it.status === "error") failed++;
        else canceled++;
    }
    return {
        total,
        queued,
        active,
        done,
        failed,
        canceled,
        percent: total === 0 ? 0 : Math.round((weight / total) * 100),
    };
}

const STATUS_ORDER: Record<UploadStatus, number> = {
    uploading: 0,
    recognizing: 1,
    queued: 2,
    error: 3,
    canceled: 4,
    done: 5,
};

/** Порядок показа; исходная очередь не мутируется. */
export function sortItems(items: QueueItem[], sort: QueueSort): QueueItem[] {
    if (sort === "order") return items;
    const next = [...items];
    if (sort === "name") next.sort((a, b) => a.name.localeCompare(b.name, "ru"));
    else if (sort === "size") next.sort((a, b) => b.size - a.size);
    else next.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
    return next;
}

export function formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 Б";
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

/** Только изображения; прочее отсеиваем до постановки в очередь. */
export function isImageFile(file: { type?: string; name: string }): boolean {
    if (file.type && file.type.startsWith("image/")) return true;
    return /\.(jpe?g|png|webp|bmp|heic|heif)$/i.test(file.name);
}