/**
 * Предзаполнение формы проверки из распознанных данных OCR
 * (вынесено из OcrReviewPage, 6e-2-web-fix5). Поведение прежнее.
 */
import { useEffect, useState } from "react";

import type { OcrTask } from "../api/ocr";
import type { RangeEntry } from "../components/ocr/RangesTable";
import { parseSampleInput } from "../utils/parseSampleInput";
import { makeAllSeqs, newRangeId } from "../utils/ocrRangeHelpers";

interface CatalogSite { id: number; code: string; name: string }
interface CatalogResearchType { id: number; code: string; name: string }
interface CatalogContainerType { id: number; name: string }

interface Options {
    task: OcrTask | undefined;
    sites: CatalogSite[] | undefined;
    researchTypes: CatalogResearchType[] | undefined;
    containerTypes: CatalogContainerType[] | undefined;
    laboratoryPrefixes: string[];
    siteMatchPatterns: string[];
    containerNumber: string;
    setSiteName: (v: string) => void;
    setResearchTypeName: (v: string) => void;
    setContainerTypeName: (v: string) => void;
    setWorkOrderCoded: (v: string) => void;
    setWorkOrderIncoming: (v: string) => void;
    setContainerNumber: (v: string) => void;
    setRanges: (v: RangeEntry[]) => void;
    setParseErrors: (v: string[]) => void;
}

export function useOcrTaskPrefill({
    task,
    sites,
    researchTypes,
    containerTypes,
    laboratoryPrefixes,
    siteMatchPatterns,
    containerNumber,
    setSiteName,
    setResearchTypeName,
    setContainerTypeName,
    setWorkOrderCoded,
    setWorkOrderIncoming,
    setContainerNumber,
    setRanges,
    setParseErrors,
}: Options) {
    const [prefilled, setPrefilled] = useState(false);

    useEffect(() => {
        if (!task || prefilled) return;
        const ex = task.raw_ocr_data?.extracted;
        if (!ex) {
            setPrefilled(true);
            return;
        }
        if (ex.work_order_coded) setWorkOrderCoded(ex.work_order_coded);
        if (ex.work_order_incoming) setWorkOrderIncoming(ex.work_order_incoming);
        // ждём справочники, иначе mapping code → name не сработает
        if (!sites || !researchTypes || !containerTypes) return;
        if (ex.container_number) setContainerNumber(ex.container_number);
        if (ex.site) {
            const s = sites.find((x) => x.code === ex.site);
            setSiteName(s ? `${s.code} — ${s.name}` : ex.site);
        }
        if (ex.container_type) setContainerTypeName(ex.container_type);
        if (ex.research_type) {
            const rt = researchTypes.find(
                (x) => x.code === ex.research_type || x.name === ex.research_type,
            );
            setResearchTypeName(rt ? `${rt.code} — ${rt.name}` : ex.research_type);
        }
        if (ex.samples && ex.samples.length > 0) {
            const opts = {
                laboratoryPrefixes,
                siteMatchPatterns,
                hasIncomingWorkOrder: (ex.work_order_incoming ?? "").trim() !== "",
            };
            const parsed: RangeEntry[] = [];
            const errors: string[] = [];
            for (const num of ex.samples) {
                const r = parseSampleInput(num, opts);
                if (r.ok) {
                    parsed.push({
                        id: newRangeId(),
                        rawInput: num,
                        ...r.value,
                        allSeqs: makeAllSeqs(r.value.sequenceFrom, r.value.sequenceTo),
                        skippedSeqs: [],
                        selectedSeqs: [],
                    });
                } else {
                    errors.push(num);
                    parsed.push({
                        id: newRangeId(),
                        rawInput: num,
                        prefix: "",
                        middle: num,
                        sequenceFrom: 1,
                        sequenceTo: 1,
                        sequenceDigits: 1,
                        wellName: null,
                        allSeqs: [1],
                        skippedSeqs: [],
                        selectedSeqs: [],
                    });
                }
            }
            setRanges(parsed);
            setParseErrors(errors);
        }
        setPrefilled(true);
    }, [task, prefilled, sites, researchTypes, containerTypes, laboratoryPrefixes, siteMatchPatterns]);

    // Номер тары из текста, если OCR не отдал его в extracted.
    useEffect(() => {
        if (!task?.raw_ocr_data?.text) return;
        if (containerNumber) return;
        const m = task.raw_ocr_data.text.match(/\b[TТ][-–]?\d{2,6}\b/);
        if (m) setContainerNumber(m[0]);
    }, [task, containerNumber]);
}