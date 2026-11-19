/**
 * Состояние инлайн-правок OCR-токенов (6e-2-web-2, fix2+fix3).
 * Правка не плодит дублей: своя строка обновляется, лишняя удаляется,
 * новая добавляется только если такой пробы нет. Каждой правке даётся вердикт
 * относительно фото; расхождение требует явного подтверждения человеком.
 */
import { useMemo, useState, type Dispatch, type SetStateAction } from "react";

import type { OcrWord } from "../api/ocr";
import type { RangeEntry } from "../components/ocr/RangesTable";
import { parseSampleInput } from "../utils/parseSampleInput";
import { makeAllSeqs, newRangeId } from "../utils/ocrRangeHelpers";
import { classifyEdit, needsConfirmation, type EditVerdict } from "../utils/ocrEditVerdict";
import {
    applyWordEdits,
    cleanEditText,
    collectWordEdits,
    numbersOf,
    planSampleEdit,
    withoutEdit,
} from "../utils/ocrTokenEdits";

interface Options {
    words: OcrWord[];
    ranges: RangeEntry[];
    setRanges: Dispatch<SetStateAction<RangeEntry[]>>;
    laboratoryPrefixes: string[];
    siteMatchPatterns: string[];
    workOrderIncoming: string;
}

interface LastChange {
    index: number;
    kind: "add" | "update" | "remove";
    rangeId: string;
    before: RangeEntry | null;
}

export function useOcrTokenEdits({
    words,
    ranges,
    setRanges,
    laboratoryPrefixes,
    siteMatchPatterns,
    workOrderIncoming,
}: Options) {
    const [edits, setEdits] = useState<Map<number, string>>(new Map());
    const [acknowledged, setAcknowledged] = useState<Set<number>>(new Set());
    const [lastChange, setLastChange] = useState<LastChange | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const editedWords = useMemo(() => applyWordEdits(words, edits), [words, edits]);
    const editList = useMemo(() => collectWordEdits(words, edits), [words, edits]);

    const parseOpts = {
        laboratoryPrefixes,
        siteMatchPatterns,
        hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
    };

    const verdicts = useMemo(() => {
        const m = new Map<number, EditVerdict>();
        for (const e of editList) {
            const parsed = parseSampleInput(e.text, {
                laboratoryPrefixes,
                siteMatchPatterns,
                hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
            });
            m.set(e.index, classifyEdit(e.original, e.text, parsed.ok));
        }
        return m;
    }, [editList, laboratoryPrefixes, siteMatchPatterns, workOrderIncoming]);

    const unconfirmedCount = useMemo(() => {
        let n = 0;
        for (const [index, v] of verdicts) {
            if (needsConfirmation(v) && !acknowledged.has(index)) n++;
        }
        return n;
    }, [verdicts, acknowledged]);

    const acknowledge = (index: number) => {
        setAcknowledged((prev) => new Set(prev).add(index));
    };

    const undoLast = () => {
        if (!lastChange) return;
        const { index, kind, rangeId, before } = lastChange;
        if (kind === "add") {
            setRanges((prev) => prev.filter((r) => r.id !== rangeId));
        } else if (kind === "update" && before) {
            setRanges((prev) => prev.map((r) => (r.id === rangeId ? before : r)));
        } else if (kind === "remove" && before) {
            setRanges((prev) => [...prev, before]);
        }
        setEdits((prev) => withoutEdit(prev, index));
        setAcknowledged((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
        });
        setLastChange(null);
        setNotice(null);
    };

    const revertEdit = (index: number) => {
        if (lastChange && lastChange.index === index) {
            undoLast();
            return;
        }
        setEdits((prev) => withoutEdit(prev, index));
        setAcknowledged((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
        });
    };

    const commitEdit = (index: number, text: string) => {
        const clean = cleanEditText(text);
        const original = words[index]?.text ?? "";
        if (clean === "" || clean === original) {
            revertEdit(index);
            return;
        }
        setEdits((prev) => new Map(prev).set(index, clean));
        setAcknowledged((prev) => {
            const next = new Set(prev);
            next.delete(index);
            return next;
        });

        const parsed = parseSampleInput(clean, parseOpts);
        const verdict = classifyEdit(original, clean, parsed.ok);

        if (!parsed.ok) {
            setLastChange(null);
            setNotice(`«${clean}» — ${verdict.message}`);
            return;
        }

        const v = parsed.value;
        const plan = planSampleEdit(
            ranges,
            original,
            numbersOf(v),
            lastChange?.index === index ? lastChange.rangeId : undefined,
        );
        const allSeqs = makeAllSeqs(v.sequenceFrom, v.sequenceTo);
        const tail = needsConfirmation(verdict) ? ` ${verdict.message}` : "";

        if (plan.kind === "none") {
            setLastChange(null);
            setNotice(`Проба «${clean}» уже есть в списке — ничего не добавлено.${tail}`);
            return;
        }

        if (plan.kind === "add") {
            const rangeId = newRangeId();
            setRanges((prev) => [
                ...prev,
                { id: rangeId, rawInput: clean, ...v, allSeqs, skippedSeqs: [], selectedSeqs: [] },
            ]);
            setLastChange({ index, kind: "add", rangeId, before: null });
            setNotice(`Проба ${clean} определена после правки и добавлена в список.${tail}`);
            return;
        }

        if (plan.kind === "update") {
            const before = plan.before;
            const inRange = (s: number) => s >= v.sequenceFrom && s <= v.sequenceTo;
            setRanges((prev) =>
                prev.map((r) =>
                    r.id === plan.targetId
                        ? {
                            ...r,
                            rawInput: clean,
                            ...v,
                            allSeqs,
                            skippedSeqs: before.skippedSeqs.filter(inRange),
                            selectedSeqs: before.selectedSeqs.filter(inRange),
                        }
                        : r,
                ),
            );
            setLastChange({ index, kind: "update", rangeId: plan.targetId, before });
            setNotice(`Проба «${original}» исправлена на «${clean}» — строка обновлена.${tail}`);
            return;
        }

        setRanges((prev) => prev.filter((r) => r.id !== plan.targetId));
        setLastChange({ index, kind: "remove", rangeId: plan.targetId, before: plan.before });
        setNotice(`Проба «${clean}» уже есть в списке — лишняя строка «${original}» удалена.${tail}`);
    };

    return {
        edits,
        editedWords,
        editList,
        verdicts,
        acknowledged,
        unconfirmedCount,
        notice,
        commitEdit,
        revertEdit,
        acknowledge,
        undoAutoAdd: undoLast,
    };
}