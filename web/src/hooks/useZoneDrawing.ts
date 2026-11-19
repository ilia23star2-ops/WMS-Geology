/**
 * Рисование зон на фото в web (6e-2-web-5, авто-зоны 5-c, справочники 5-d).
 * Черновик разметки живёт в браузере: «Авто-зоны» строит его по словам OCR
 * и справочникам, «Применить к полям» извлекает значения (включая тип тары
 * из сокращения «Ящ.1»), «Сохранить» отправляет разметку на сервер.
 */
import {
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type SetStateAction,
} from "react";

import {
    OCR_ZONE_LABELS,
    type OcrTask,
    type OcrWord,
    type OcrZone,
    type OcrZoneType,
} from "../api/ocr";
import { useSaveOcrZones } from "../api/ocrZones";
import type { RangeEntry } from "../components/ocr/RangesTable";
import { parseSampleInput } from "../utils/parseSampleInput";
import { makeAllSeqs, newRangeId } from "../utils/ocrRangeHelpers";
import { rangeNumberSet } from "../utils/ocrSampleAudit";
import { extractFromZones, type ZoneExtracted } from "../utils/zoneExtract";
import { detectZones } from "../utils/zoneAutoDetect";

interface CatalogSite {
    id: number;
    code: string;
    name: string;
    match_patterns?: string[];
}

interface CatalogResearchType {
    id: number;
    code: string;
    name: string;
}

interface Options {
    task: OcrTask | undefined;
    words: OcrWord[];
    ranges: RangeEntry[];
    setRanges: Dispatch<SetStateAction<RangeEntry[]>>;
    laboratoryPrefixes: string[];
    siteMatchPatterns: string[];
    workOrderIncoming: string;
    sites: CatalogSite[] | undefined;
    researchTypes: CatalogResearchType[] | undefined;
    containerTypes: string[];
    setSiteName: (v: string) => void;
    setResearchTypeName: (v: string) => void;
    setContainerTypeName: (v: string) => void;
    setWorkOrderCoded: (v: string) => void;
    setWorkOrderIncoming: (v: string) => void;
    setContainerNumber: (v: string) => void;
}

export type DrawMode = "view" | "draw";

/** Регистр и пробелы — для сравнения номеров без фиксов префиксов. */
function canon(s: string): string {
    return (s ?? "").toUpperCase().replace(/\s+/g, "");
}

export function useZoneDrawing({
    task,
    words,
    ranges,
    setRanges,
    laboratoryPrefixes,
    siteMatchPatterns,
    workOrderIncoming,
    sites,
    researchTypes,
    containerTypes,
    setSiteName,
    setResearchTypeName,
    setContainerTypeName,
    setWorkOrderCoded,
    setWorkOrderIncoming,
    setContainerNumber,
}: Options) {
    const [mode, setMode] = useState<DrawMode>("view");
    const [type, setType] = useState<OcrZoneType>("sample");
    const [zones, setZones] = useState<OcrZone[]>(task?.zones ?? []);
    const [notice, setNotice] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savedCount, setSavedCount] = useState<number | null>(null);
    const saveZones = useSaveOcrZones(task?.id ?? null);

    const taskId = task?.id ?? 0;
    // Синхронизация только при смене задачи — черновик не перезатираем.
    useEffect(() => {
        setZones(task?.zones ?? []);
        setNotice(null);
        setError(null);
        setSavedCount(null);
        setMode("view");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId]);

    const original = task?.zones ?? [];
    const dirty = useMemo(
        () => JSON.stringify(zones) !== JSON.stringify(original),
        [zones, original],
    );

    const extracted: ZoneExtracted = useMemo(
        () => extractFromZones(words, zones, containerTypes),
        [words, zones, containerTypes],
    );

    const previewCount =
        [
            extracted.work_order_coded,
            extracted.work_order_incoming,
            extracted.container_number,
            extracted.container_type,
            extracted.research_type,
            extracted.site,
        ].filter(Boolean).length + extracted.samples.length;

    /** bbox уже обрезан и раздвинут компонентом (он знает размеры фото). */
    const addZone = (bbox: number[][]) => {
        setZones((prev) => [...prev, { type, bbox, source: "manual" }]);
        setNotice(null);
        setSavedCount(null);
    };

    const removeZone = (index: number) => {
        setZones((prev) => prev.filter((_, i) => i !== index));
        setNotice(null);
    };

    const changeType = (index: number, next: OcrZoneType) => {
        setZones((prev) => prev.map((z, i) => (i === index ? { ...z, type: next } : z)));
    };

    const clear = () => {
        setZones([]);
        setNotice("Разметка очищена — нажми «Сохранить», чтобы применить на сервере.");
    };

    const reset = () => {
        setZones(original);
        setNotice("Вернул разметку, которая пришла с фото.");
        setError(null);
    };

    /** Авто-разметка: метки этикетки + контекст справочников. */
    const autoDetect = () => {
        setError(null);
        const res = detectZones(words, undefined, {
            researchTypes,
            containerTypes,
            sites,
        });
        if (res.zones.length === 0) {
            setNotice(null);
            setError(
                "Не нашёл ни меток («Уч:», «Н/З:», «Исп:», «№:»), ни значений из справочников, ни номеров проб — нарисуй зоны вручную.",
            );
            return;
        }
        setZones(res.zones);
        setSavedCount(null);
        setMode("draw");
        const labels = res.found.map((t) => OCR_ZONE_LABELS[t]).join(", ");
        const missing = res.missing.map((t) => OCR_ZONE_LABELS[t]).join(", ");
        setNotice(
            `Авто-зоны: ${res.zones.length} (${labels}). Номеров проб найдено: ${res.sampleCount}.` +
            (missing ? ` Не нашёл: ${missing} — дорисуй вручную.` : "") +
            " Проверь рамки и нажми «Применить к полям».",
        );
    };

    /** Заполнить шапку и пробы значениями из зон. */
    const apply = () => {
        setError(null);
        if (zones.length === 0) {
            setError("Нарисуй хотя бы одну зону или нажми «Авто-зоны».");
            return;
        }
        const ex = extractFromZones(words, zones, containerTypes);
        const filled: string[] = [];

        if (ex.work_order_coded) {
            setWorkOrderCoded(ex.work_order_coded);
            filled.push("Н/З");
        }
        if (ex.work_order_incoming) {
            setWorkOrderIncoming(ex.work_order_incoming);
            filled.push("Н/З входящий");
        }
        if (ex.container_number) {
            setContainerNumber(ex.container_number);
            filled.push("№ тары");
        }
        if (ex.container_type) {
            setContainerTypeName(ex.container_type);
            filled.push("тип тары");
        }
        if (ex.research_type) {
            const rt = researchTypes?.find(
                (x) => x.code === ex.research_type || x.name === ex.research_type,
            );
            setResearchTypeName(rt ? `${rt.code} — ${rt.name}` : ex.research_type);
            filled.push("ТИ");
        }
        if (ex.site) {
            const s = sites?.find((x) => x.code === ex.site || x.name === ex.site);
            setSiteName(s ? `${s.code} — ${s.name}` : ex.site);
            filled.push("участок");
        }

        const existing = new Set([...rangeNumberSet(ranges)].map(canon));
        const opts = {
            laboratoryPrefixes,
            siteMatchPatterns,
            hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
        };
        const added: RangeEntry[] = [];
        const failed: string[] = [];
        for (const num of ex.samples) {
            const parsed = parseSampleInput(num, opts);
            if (!parsed.ok) {
                failed.push(num);
                continue;
            }
            const v = parsed.value;
            const allSeqs = makeAllSeqs(v.sequenceFrom, v.sequenceTo);
            const nums = allSeqs.map(
                (i) => canon(`${v.prefix}${v.middle}${String(i).padStart(v.sequenceDigits, "0")}`),
            );
            if (nums.every((n) => existing.has(n))) continue;
            nums.forEach((n) => existing.add(n));
            added.push({
                id: newRangeId(),
                rawInput: num,
                ...v,
                allSeqs,
                skippedSeqs: [],
                selectedSeqs: [],
            });
        }
        if (added.length > 0) setRanges((prev) => [...prev, ...added]);

        const parts: string[] = [];
        if (filled.length > 0) parts.push(`поля: ${filled.join(", ")}`);
        if (added.length > 0) parts.push(`проб добавлено: ${added.length}`);
        if (failed.length > 0) parts.push(`не разобрано: ${failed.join(", ")}`);
        setNotice(
            parts.length > 0
                ? `Применено из зон — ${parts.join(" · ")}.`
                : "В зонах не нашлось значений — проверь, что рамка накрывает текст.",
        );
    };

    const save = () => {
        setError(null);
        saveZones.mutate(zones, {
            onSuccess: (res) => {
                setSavedCount(res.zones_count);
                setNotice(`Разметка сохранена на сервере: зон ${res.zones_count}.`);
            },
            onError: (e) => {
                setError(
                    (e as { response?: { data?: { error?: string } } })
                        ?.response?.data?.error ?? String(e),
                );
            },
        });
    };

    return {
        mode,
        setMode,
        type,
        setType,
        zones,
        dirty,
        extracted,
        previewCount,
        notice,
        error,
        savedCount,
        saving: saveZones.isPending,
        hasWords: words.length > 0,
        addZone,
        removeZone,
        changeType,
        clear,
        reset,
        autoDetect,
        apply,
        save,
    };
}

export type ZoneDrawing = ReturnType<typeof useZoneDrawing>;