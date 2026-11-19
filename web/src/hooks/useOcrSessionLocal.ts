/**
 * Отправка сессии оцифровки (6e-3-web-c, +имя пакета 6e-3-backend).
 * Состояние живёт в ocrSessionStore (переживает навигацию); здесь только
 * оркестрация: первое фото создаёт пакет (и несёт имя сессии), остальные
 * идут в него же с cell_id записи; в конце пакет закрывается статусом SENT.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useRecognizePhoto, useSendOcrBatch } from "../api/ocrUpload";
import { sessionFiles, useOcrSessionStore } from "../stores/ocrSessionStore";

function errorText(e: unknown): string {
    const resp = (e as { response?: { data?: { error?: string }; status?: number } })?.response;
    if (resp?.data?.error) return resp.data.error;
    if (resp?.status) return `Сервер ответил ${resp.status}`;
    return e instanceof Error ? e.message : String(e);
}

export function useOcrSessionLocal() {
    const qc = useQueryClient();
    const recognize = useRecognizePhoto();
    const sendBatch = useSendOcrBatch();

    const records = useOcrSessionStore((s) => s.records);
    const batchId = useOcrSessionStore((s) => s.batchId);
    const batchName = useOcrSessionStore((s) => s.batchName);
    const updatePhoto = useOcrSessionStore((s) => s.updatePhoto);
    const setBatchId = useOcrSessionStore((s) => s.setBatchId);

    const [sending, setSending] = useState(false);
    const [sentCount, setSentCount] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const stopRef = useRef(false);
    const batchRef = useRef<number | null>(null);

    const allPhotos = useMemo(
        () => records.flatMap((r) => r.photos.map((p) => ({ record: r, photo: p }))),
        [records],
    );
    const queuedCount = allPhotos.filter((x) => x.photo.status === "queued").length;
    const failedCount = allPhotos.filter((x) => x.photo.status === "error").length;
    const doneCount = allPhotos.filter((x) => x.photo.status === "done").length;

    const stop = useCallback(() => {
        stopRef.current = true;
    }, []);

    const start = useCallback(async () => {
        if (sending) return;
        stopRef.current = false;
        setSending(true);
        batchRef.current = batchId;
        const plan = records.flatMap((r) =>
            r.photos
                .filter((p) => p.status === "queued" || p.status === "error")
                .map((p) => ({ r, p })),
        );
        setTotalCount(plan.length);
        setSentCount(0);
        let sent = 0;
        try {
            for (const { r, p } of plan) {
                if (stopRef.current) break;
                const file = sessionFiles.get(p.id);
                if (!file) {
                    updatePhoto(r.id, p.id, { status: "error", error: "Файл недоступен — добавь фото заново" });
                    continue;
                }
                updatePhoto(r.id, p.id, { status: "uploading", progress: 0, error: null });
                try {
                    const res = await recognize.mutateAsync({
                        file,
                        cellId: r.cellId,
                        batchId: batchRef.current,
                        // имя имеет смысл только когда пакет создаётся сейчас
                        batchName: batchRef.current === null ? batchName : undefined,
                        onProgress: (percent: number) =>
                            updatePhoto(r.id, p.id, {
                                progress: percent,
                                status: percent >= 100 ? "recognizing" : "uploading",
                            }),
                    });
                    batchRef.current = res.batch_id;
                    setBatchId(res.batch_id);
                    updatePhoto(r.id, p.id, { status: "done", progress: 100, taskId: res.task_id, error: null });
                    qc.invalidateQueries({ queryKey: ["ocr"] });
                } catch (e) {
                    updatePhoto(r.id, p.id, {
                        status: stopRef.current ? "canceled" : "error",
                        error: stopRef.current ? null : errorText(e),
                    });
                }
                sent++;
                setSentCount(sent);
            }
            if (!stopRef.current && batchRef.current !== null) {
                await sendBatch.mutateAsync(batchRef.current);
            }
        } finally {
            setSending(false);
            stopRef.current = false;
        }
    }, [sending, records, batchId, batchName, updatePhoto, setBatchId, recognize, sendBatch, qc]);

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
        start,
        stop,
    };
}