/**
 * Хелперы диапазонов проб OCR (вынесено из OcrReviewPage, 6e-2-web-fix5).
 * Чистая логика, без UI — покрывается тестами.
 */
import type { SampleGroup } from "../api/ocr";
import type { RangeEntry } from "../components/ocr/RangesTable";

export function newRangeId(): string {
    return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeAllSeqs(from: number, to: number): number[] {
    const out: number[] = [];
    for (let i = from; i <= to; i++) out.push(i);
    return out;
}

export function groupSeqsToRanges(
    r: RangeEntry,
    seqs: number[],
    status: "NORMAL" | "SELECTED",
    wellName: string | null,
): SampleGroup[] {
    if (seqs.length === 0) return [];
    const sorted = [...seqs].sort((a, b) => a - b);
    const groups: SampleGroup[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            groups.push({
                prefix: r.prefix,
                middle: r.middle,
                sequence_from: start,
                sequence_to: prev,
                sequence_digits: r.sequenceDigits,
                well_name: wellName,
                status,
            });
            start = sorted[i];
            prev = sorted[i];
        }
    }
    groups.push({
        prefix: r.prefix,
        middle: r.middle,
        sequence_from: start,
        sequence_to: prev,
        sequence_digits: r.sequenceDigits,
        well_name: wellName,
        status,
    });
    return groups;
}

/**
 * Группы проб для approve: пропущенные исключаются, выбранные идут отдельно.
 * Скважина = middle, если Н/З входящий не заполнен (нешифрованные пробы).
 */
export function buildSampleGroups(
    ranges: RangeEntry[],
    hasIncoming: boolean,
): SampleGroup[] {
    const out: SampleGroup[] = [];
    for (const r of ranges) {
        const wellName = hasIncoming ? null : r.middle;
        const skipped = new Set(r.skippedSeqs);
        const selected = new Set(r.selectedSeqs);
        const normal = r.allSeqs.filter((s) => !skipped.has(s) && !selected.has(s));
        const selArr = r.allSeqs.filter((s) => selected.has(s) && !skipped.has(s));
        out.push(...groupSeqsToRanges(r, normal, "NORMAL", wellName));
        out.push(...groupSeqsToRanges(r, selArr, "SELECTED", wellName));
    }
    return out;
}