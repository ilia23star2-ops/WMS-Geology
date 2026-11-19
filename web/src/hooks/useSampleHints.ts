/**
 * Подсказки по пробам и переход к боксу на фото (6e-2-web-6, 6-c…6-e).
 * Единственный источник подсветки — activeWordIndex: клик по строке,
 * по чипу аномалии/префикса/подсказки и по слову фото пишут в него,
 * поэтому обведён ровно один бокс. activeSample остаётся для рамки строки
 * в таблице. Поиск слова терпимый: путаница OCR → один символ → хвост цифр.
 */
import {
    useMemo,
    useState,
    type Dispatch,
    type MutableRefObject,
    type SetStateAction,
} from "react";

import type { OcrWord } from "../api/ocr";
import type { RangeEntry } from "../components/ocr/RangesTable";
import { rangeNumbers, type SampleWordLink } from "../utils/ocrSampleAudit";
import {
    bestWordMatch,
    canonNumber,
    findSimilarHints,
    type SampleHint,
} from "../utils/ocrSampleHints";
import { checkPrefixes, type PrefixIssue } from "../utils/samplePrefixCheck";
import { parseSampleInput } from "../utils/parseSampleInput";
import { makeAllSeqs } from "../utils/ocrRangeHelpers";

export interface AnomalyChip {
    number: string;
    rangeId: string;
}

export interface CountMismatch {
    listCount: number;
    photoCount: number;
    message: string;
}

interface Options {
    ranges: RangeEntry[];
    setRanges: Dispatch<SetStateAction<RangeEntry[]>>;
    missing: string[];
    anomalyIds: string[];
    links: SampleWordLink[];
    words: OcrWord[];
    wordRefs: MutableRefObject<Map<number, SVGPolygonElement | null>>;
    setActiveSample: (value: string | null) => void;
    setActiveField: (value: string | null) => void;
    laboratoryPrefixes: string[];
    siteMatchPatterns: string[];
    workOrderIncoming: string;
    validPrefixes: string[];
    photoSampleCount: number;
}

export function useSampleHints({
    ranges,
    setRanges,
    missing,
    anomalyIds,
    links,
    words,
    wordRefs,
    setActiveSample,
    setActiveField,
    laboratoryPrefixes,
    siteMatchPatterns,
    workOrderIncoming,
    validPrefixes,
    photoSampleCount,
}: Options) {
    const [activeWordIndex, setActiveWordIndex] = useState<number | null>(null);

    const candidates = useMemo(() => {
        const out: { number: string; rangeId: string }[] = [];
        for (const r of ranges) {
            for (const n of rangeNumbers(r)) out.push({ number: n, rangeId: r.id });
        }
        return out;
    }, [ranges]);

    const wordTexts = useMemo(() => words.map((w) => w.text), [words]);

    const hints = useMemo(
        () => findSimilarHints(missing, candidates),
        [missing, candidates],
    );

    const prefixIssues = useMemo<PrefixIssue[]>(
        () => checkPrefixes(candidates, validPrefixes),
        [candidates, validPrefixes],
    );

    const countMismatch = useMemo<CountMismatch | null>(() => {
        const listCount = candidates.length;
        if (photoSampleCount <= 0 || listCount <= 0) return null;
        if (listCount === photoSampleCount) return null;
        const diff = listCount - photoSampleCount;
        return {
            listCount,
            photoCount: photoSampleCount,
            message:
                `На фото проб: ${photoSampleCount}, в списке: ${listCount}. ` +
                (diff > 0
                    ? `Лишних: ${diff} — проверь дубли и номера, которых нет на фото.`
                    : `Не хватает: ${-diff} — внеси пробы с фото.`),
        };
    }, [candidates.length, photoSampleCount]);

    const anomalies = useMemo<AnomalyChip[]>(() => {
        const ids = new Set(anomalyIds);
        const out: AnomalyChip[] = [];
        for (const r of ranges) {
            if (!ids.has(r.id)) continue;
            const nums = rangeNumbers(r);
            out.push({ number: nums[0] ?? r.rawInput, rangeId: r.id });
        }
        return out;
    }, [ranges, anomalyIds]);

    const scrollToWord = (index: number) => {
        window.setTimeout(() => {
            wordRefs.current.get(index)?.scrollIntoView({
                block: "center",
                inline: "center",
                behavior: "smooth",
            });
        }, 60);
    };

    /** Обвести ОДИН бокс и подсветить строку номером из списка. */
    const highlight = (index: number, listNumber: string) => {
        setActiveWordIndex(index >= 0 ? index : null);
        setActiveSample(listNumber);
        setActiveField("sample");
        if (index >= 0) scrollToWord(index);
    };

    /** Клик по слову на фото — обводим именно его. */
    const focusWord = (index: number, number: string) => {
        highlight(index, number);
    };

    /** Снять выбор слова: подсветка полей снова работает по activeField. */
    const clearFocus = () => {
        setActiveWordIndex(null);
    };

    /** Найти слово на фото по номеру — терпимо к ошибкам OCR. */
    const focusNumber = (number: string) => {
        const target = canonNumber(number);
        const link = links.find((l) => canonNumber(l.number) === target);
        if (link) {
            highlight(link.index, number);
            return;
        }
        highlight(bestWordMatch(number, wordTexts), number);
    };

    /** Клик по строке списка или по чипу — один бокс, без «двойной» обводки. */
    const focusRange = (rangeId: string) => {
        const row = ranges.find((r) => r.id === rangeId);
        const listNumber = row ? (rangeNumbers(row)[0] ?? row.rawInput) : "";
        const link = links.find((l) => l.rangeId === rangeId);
        if (link) {
            highlight(link.index, listNumber || link.number);
            return;
        }
        if (!listNumber) return;
        highlight(bestWordMatch(listNumber, wordTexts), listNumber);
    };

    /** Исправить номер строки на номер с фото — проба найдётся, лишняя уйдёт. */
    const fixHint = (hint: SampleHint) => {
        const parsed = parseSampleInput(hint.missing, {
            laboratoryPrefixes,
            siteMatchPatterns,
            hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
        });
        if (!parsed.ok) return;
        const v = parsed.value;
        const inRange = (s: number) => s >= v.sequenceFrom && s <= v.sequenceTo;
        setRanges((prev) =>
            prev.map((r) =>
                r.id === hint.rangeId
                    ? {
                        ...r,
                        rawInput: hint.missing,
                        ...v,
                        allSeqs: makeAllSeqs(v.sequenceFrom, v.sequenceTo),
                        skippedSeqs: r.skippedSeqs.filter(inRange),
                        selectedSeqs: r.selectedSeqs.filter(inRange),
                    }
                    : r,
            ),
        );
        highlight(bestWordMatch(hint.missing, wordTexts), hint.missing);
    };

    return {
        hints,
        anomalies,
        prefixIssues,
        countMismatch,
        activeWordIndex,
        focusWord,
        clearFocus,
        focusRange,
        focusNumber,
        fixHint,
    };
}