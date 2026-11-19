/**
 * Состояние и операции со списком проб OCR (вынесено из OcrReviewPage, fix5).
 * Поведение дословно прежнее: добавление, правка, удаление, группировка по скважинам.
 */
import { useMemo, useState } from "react";

import type { RangeEntry } from "../components/ocr/RangesTable";
import { parseSampleInput } from "../utils/parseSampleInput";
import { makeAllSeqs, newRangeId } from "../utils/ocrRangeHelpers";

interface Options {
    laboratoryPrefixes: string[];
    siteMatchPatterns: string[];
    workOrderIncoming: string;
    onError: (message: string) => void;
}

export function useOcrRanges({
    laboratoryPrefixes,
    siteMatchPatterns,
    workOrderIncoming,
    onError,
}: Options) {
    const [ranges, setRanges] = useState<RangeEntry[]>([]);
    const [rangeInput, setRangeInput] = useState("");
    const [rangeInputError, setRangeInputError] = useState<string | null>(null);
    const [editingRange, setEditingRange] = useState<RangeEntry | null>(null);
    const [parseErrors, setParseErrors] = useState<string[]>([]);

    const parseOpts = {
        laboratoryPrefixes,
        siteMatchPatterns,
        hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
    };

    const rangesByWell = useMemo(() => {
        const map = new Map<string, RangeEntry[]>();
        for (const r of ranges) {
            const key = r.wellName ?? "__none__";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        const entries = Array.from(map.entries()).sort((a, b) =>
            a[0].localeCompare(b[0], "ru", { numeric: true }),
        );
        for (const [, list] of entries) {
            list.sort((a, b) =>
                a.rawInput.localeCompare(b.rawInput, "ru", { numeric: true }),
            );
        }
        return entries;
    }, [ranges]);

    const handleAddRange = () => {
        const result = parseSampleInput(rangeInput, parseOpts);
        if (!result.ok) {
            setRangeInputError(result.error);
            return;
        }
        setRanges((prev) => [
            ...prev,
            {
                id: newRangeId(),
                rawInput: rangeInput.trim(),
                ...result.value,
                allSeqs: makeAllSeqs(result.value.sequenceFrom, result.value.sequenceTo),
                skippedSeqs: [],
                selectedSeqs: [],
            },
        ]);
        setRangeInput("");
        setRangeInputError(null);
    };

    const handleRangeSave = (raw: string, skipped: number[], selected: number[]) => {
        if (!editingRange) return;
        const result = parseSampleInput(raw, parseOpts);
        if (!result.ok) {
            onError(result.error);
            return;
        }
        const validSkipped = skipped.filter(
            (s) => s >= result.value.sequenceFrom && s <= result.value.sequenceTo,
        );
        const validSelected = selected.filter(
            (s) => s >= result.value.sequenceFrom && s <= result.value.sequenceTo,
        );
        setRanges((prev) =>
            prev.map((r) =>
                r.id === editingRange.id
                    ? {
                        id: r.id,
                        rawInput: raw.trim(),
                        ...result.value,
                        allSeqs: makeAllSeqs(result.value.sequenceFrom, result.value.sequenceTo),
                        skippedSeqs: validSkipped,
                        selectedSeqs: validSelected,
                    }
                    : r,
            ),
        );
        setEditingRange(null);
    };

    const removeRange = (id: string) => {
        setRanges((prev) => prev.filter((r) => r.id !== id));
    };

    return {
        ranges,
        setRanges,
        rangeInput,
        setRangeInput,
        rangeInputError,
        setRangeInputError,
        editingRange,
        setEditingRange,
        parseErrors,
        setParseErrors,
        rangesByWell,
        handleAddRange,
        handleRangeSave,
        removeRange,
    };
}