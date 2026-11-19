import { describe, expect, it } from "vitest";

import {
    canStart,
    formatBytes,
    isImageFile,
    makeItem,
    moveItem,
    nextQueuedId,
    patchItem,
    queueSummary,
    removeItem,
    retryFailed,
    sortItems,
} from "./uploadQueue";

const a = makeItem("a.jpg", 1000, "a");
const b = makeItem("b.jpg", 3000, "b");
const c = makeItem("c.png", 2000, "c");

describe("makeItem", () => {
    it("новое фото стоит в очереди с нулевым прогрессом", () => {
        expect(a).toEqual({
            id: "a", name: "a.jpg", size: 1000, preview: null,
            status: "queued", progress: 0, taskId: null, error: null,
        });
    });
});

describe("patchItem", () => {
    it("меняет только нужное фото и не мутирует исходный список", () => {
        const next = patchItem([a, b], "b", { status: "done", progress: 100, taskId: 7 });
        expect(next[0]).toBe(a);
        expect(next[1].status).toBe("done");
        expect(next[1].taskId).toBe(7);
        expect(b.status).toBe("queued");
    });
});

describe("nextQueuedId", () => {
    it("берёт первое фото в очереди", () => {
        const items = patchItem([a, b, c], "a", { status: "done" });
        expect(nextQueuedId(items)).toBe("b");
        expect(nextQueuedId([])).toBeNull();
    });
});

describe("removeItem и moveItem", () => {
    it("удаление убирает фото", () => {
        expect(removeItem([a, b], "a").map((i) => i.id)).toEqual(["b"]);
    });

    it("перемещение работает и не выходит за границы", () => {
        expect(moveItem([a, b, c], "c", -1).map((i) => i.id)).toEqual(["a", "c", "b"]);
        expect(moveItem([a, b], "a", -1).map((i) => i.id)).toEqual(["a", "b"]);
        expect(moveItem([a, b], "b", 1).map((i) => i.id)).toEqual(["a", "b"]);
    });
});

describe("retryFailed и canStart", () => {
    it("ошибки и остановки возвращаются в очередь", () => {
        const items = [
            patchItem([a], "a", { status: "error", error: "500", progress: 40 })[0],
            patchItem([b], "b", { status: "canceled" })[0],
            patchItem([c], "c", { status: "done" })[0],
        ];
        const next = retryFailed(items);
        expect(next[0].status).toBe("queued");
        expect(next[0].progress).toBe(0);
        expect(next[0].error).toBeNull();
        expect(next[1].status).toBe("queued");
        expect(next[2].status).toBe("done");
    });

    it("старт возможен только когда есть очередь и не идёт отправка", () => {
        expect(canStart([a], false)).toBe(true);
        expect(canStart([a], true)).toBe(false);
        expect(canStart([patchItem([a], "a", { status: "done" })[0]], false)).toBe(false);
    });
});

describe("queueSummary", () => {
    it("считает категории и общий прогресс", () => {
        const items = [
            patchItem([a], "a", { status: "done", progress: 100 })[0],
            patchItem([b], "b", { status: "uploading", progress: 50 })[0],
            patchItem([c], "c", { status: "error" })[0],
            makeItem("d.jpg", 10, "d"),
        ];
        const s = queueSummary(items);
        expect(s.total).toBe(4);
        expect(s.done).toBe(1);
        expect(s.active).toBe(1);
        expect(s.failed).toBe(1);
        expect(s.queued).toBe(1);
        expect(s.percent).toBe(38);
    });

    it("пустая очередь безопасна", () => {
        expect(queueSummary([]).percent).toBe(0);
        expect(queueSummary([]).total).toBe(0);
    });
});

describe("sortItems", () => {
    it("сортирует по имени, размеру и статусу, не мутируя вход", () => {
        expect(sortItems([c, a, b], "name").map((i) => i.id)).toEqual(["a", "b", "c"]);
        expect(sortItems([a, c, b], "size").map((i) => i.id)).toEqual(["b", "c", "a"]);
        const items = [
            patchItem([a], "a", { status: "done" })[0],
            b,
            patchItem([c], "c", { status: "uploading" })[0],
        ];
        expect(sortItems(items, "status").map((i) => i.id)).toEqual(["c", "b", "a"]);
        expect(sortItems(items, "order").map((i) => i.id)).toEqual(["a", "b", "c"]);
    });
});

describe("formatBytes и isImageFile", () => {
    it("размер читается человеком", () => {
        expect(formatBytes(0)).toBe("0 Б");
        expect(formatBytes(512)).toBe("512 Б");
        expect(formatBytes(2048)).toBe("2 КБ");
        expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 МБ");
    });

    it("в очередь идут только изображения", () => {
        expect(isImageFile({ type: "image/jpeg", name: "x" })).toBe(true);
        expect(isImageFile({ type: "", name: "scan.HEIC" })).toBe(true);
        expect(isImageFile({ type: "application/pdf", name: "doc.pdf" })).toBe(false);
    });
});