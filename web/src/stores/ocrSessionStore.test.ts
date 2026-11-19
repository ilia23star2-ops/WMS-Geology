import { beforeEach, describe, expect, it } from "vitest";

import { sessionFiles, useOcrSessionStore } from "./ocrSessionStore";

function file(name: string, type = "image/png"): File {
    return new File([new Uint8Array(8)], name, { type });
}

beforeEach(() => {
    useOcrSessionStore.getState().clearAll();
});

describe("ocrSessionStore", () => {
    it("addRecord создаёт запись и возвращает id", () => {
        const id = useOcrSessionStore.getState().addRecord(7, "Комната 1 / Стеллаж 2");
        const { records } = useOcrSessionStore.getState();
        expect(records).toHaveLength(1);
        expect(records[0].id).toBe(id);
        expect(records[0].cellId).toBe(7);
        expect(records[0].photos).toEqual([]);
    });

    it("addPhotos добавляет только изображения и держит File вне стора", () => {
        const id = useOcrSessionStore.getState().addRecord(null, "Без ячейки");
        useOcrSessionStore.getState().addPhotos(id, [
            file("a.png"),
            file("doc.pdf", "application/pdf"),
        ]);
        const rec = useOcrSessionStore.getState().records[0];
        expect(rec.photos).toHaveLength(1);
        expect(rec.photos[0].name).toBe("a.png");
        expect(rec.photos[0].status).toBe("queued");
        expect(sessionFiles.has(rec.photos[0].id)).toBe(true);
    });

    it("updatePhoto меняет статус и прогресс одной фотографии", () => {
        const id = useOcrSessionStore.getState().addRecord(1, "X");
        useOcrSessionStore.getState().addPhotos(id, [file("a.png"), file("b.png")]);
        const [p1, p2] = useOcrSessionStore.getState().records[0].photos;
        useOcrSessionStore.getState().updatePhoto(id, p1.id, { status: "done", progress: 100, taskId: 5 });
        const after = useOcrSessionStore.getState().records[0].photos;
        expect(after[0].status).toBe("done");
        expect(after[0].taskId).toBe(5);
        expect(after[1].status).toBe("queued");
        expect(after[1].id).toBe(p2.id);
    });

    it("removePhoto очищает File и превью-ссылку", () => {
        const id = useOcrSessionStore.getState().addRecord(1, "X");
        useOcrSessionStore.getState().addPhotos(id, [file("a.png")]);
        const photoId = useOcrSessionStore.getState().records[0].photos[0].id;
        useOcrSessionStore.getState().removePhoto(id, photoId);
        expect(useOcrSessionStore.getState().records[0].photos).toEqual([]);
        expect(sessionFiles.has(photoId)).toBe(false);
    });

    it("clearAll стирает записи, файлы и batchId", () => {
        const id = useOcrSessionStore.getState().addRecord(2, "Y");
        useOcrSessionStore.getState().addPhotos(id, [file("a.png")]);
        useOcrSessionStore.getState().setBatchId(11);
        useOcrSessionStore.getState().clearAll();
        const s = useOcrSessionStore.getState();
        expect(s.records).toEqual([]);
        expect(s.batchId).toBeNull();
        expect(sessionFiles.size).toBe(0);
    });
});