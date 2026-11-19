/**
 * Базы проб для подсказок ввода диапазона (вынесено из OcrReviewPage, fix5).
 * База = номер без последних двух цифр; уже использованные базы не предлагаются.
 */
import { useMemo } from "react";

import type { RangeEntry } from "../components/ocr/RangesTable";

export function useSampleBaseOptions(
    samples: string[] | undefined,
    ranges: RangeEntry[],
): string[] {
    const usedSampleNumbers = useMemo(() => {
        const set = new Set<string>();
        for (const r of ranges) {
            for (let i = r.sequenceFrom; i <= r.sequenceTo; i++) {
                const seq = String(i).padStart(r.sequenceDigits, "0");
                set.add(`${r.prefix}${r.middle}${seq}`);
            }
        }
        return set;
    }, [ranges]);

    return useMemo(() => {
        const groups = new Map<string, string[]>();
        for (const sampleNumber of samples ?? []) {
            const base = sampleNumber.slice(0, -2);
            const arr = groups.get(base);
            if (arr) arr.push(sampleNumber);
            else groups.set(base, [sampleNumber]);
        }
        const result: string[] = [];
        for (const [base, sampleNumbers] of groups) {
            const hasUnused = sampleNumbers.some((n) => !usedSampleNumbers.has(n));
            if (hasUnused) result.push(base);
        }
        return result.sort();
    }, [samples, usedSampleNumbers]);
}