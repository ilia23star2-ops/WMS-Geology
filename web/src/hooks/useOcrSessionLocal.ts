/**
 * Тонкая обёртка над стором сессии (6e-3-backend-4b).
 * Вся логика отправки — в ocrSessionStore, чтобы переживать навигацию.
 * Здесь только селекторы, счётчики и обновление кэша пакетов после отправки.
 */
import { useEffect, useMemo, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useOcrSessionStore } from "../stores/ocrSessionStore";

export function useOcrSessionLocal() {
    const qc = useQueryClient();

    const records = useOcrSessionStore((s) => s.records);
    const batchId = useOcrSessionStore((s) => s.batchId);
    const batchName = useOcrSessionStore((s) => s.batchName);
    const sending = useOcrSessionStore((s) => s.sending);
    const sentCount = useOcrSessionStore((s) => s.sentCount);
    const totalCount = useOcrSessionStore((s) => s.totalCount);
    const startSend = useOcrSessionStore((s) => s.startSend);
    const requestStop = useOcrSessionStore((s) => s.requestStop);

    const wasSending = useRef(false);
    useEffect(() => {
        if (wasSending.current && !sending) {
            qc.invalidateQueries({ queryKey: ["ocr"] });
        }
        wasSending.current = sending;
    }, [sending, qc]);

    const allPhotos = useMemo(() => records.flatMap((r) => r.photos), [records]);
    const queuedCount = allPhotos.filter((p) => p.status === "queued").length;
    const failedCount = allPhotos.filter((p) => p.status === "error").length;
    const doneCount = allPhotos.filter((p) => p.status === "done").length;

    return {
        records,
        batchId,
        batchName,
        sending,
        sentCount,
        totalCount,
        queuedCount,
        doneCount,
        failedCount,
        start: startSend,
        stop: requestStop,
    };
}