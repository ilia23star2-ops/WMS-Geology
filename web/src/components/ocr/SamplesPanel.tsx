/**
 * Вкладка «Пробы» (6e-2-web-fix7): счётчики, ввод диапазона, таблица на всю
 * высоту колонки и алерты аудита. Слева фото остаётся sticky — сверять удобно.
 * 6e-2-web-6: аномалии чипами и подсказки «похоже на ошибку OCR» с переходом
 * к мини-зоне на фото и исправлением номера.
 */
import type { MutableRefObject } from "react";
import { Box, Typography } from "@mui/material";

import type { SampleAudit, SampleWordLink } from "../../utils/ocrSampleAudit";
import type { SampleHint } from "../../utils/ocrSampleHints";
import type { AnomalyChip, CountMismatch } from "../../hooks/useSampleHints";
import type { PrefixIssue } from "../../utils/samplePrefixCheck";
import type { RangeEntry } from "./RangesTable";
import RangesTable from "./RangesTable";
import SampleInputBar from "./SampleInputBar";
import AuditAlerts from "./AuditAlerts";

export default function SamplesPanel({
    rangesCount,
    audit,
    parseErrors,
    rangeInput,
    onRangeInputChange,
    rangeInputError,
    baseSampleOptions,
    suggestionsLoading,
    onAddRange,
    onFocusInput,
    onBlurInput,
    rangesByWell,
    anomalySet,
    notOnPhotoSet,
    duplicateSet,
    linksByRange,
    numbersByRange,
    activeSample,
    rowRefs,
    anomalies,
    hints,
    prefixIssues,
    countMismatch,
    onRowClick,
    onEdit,
    onRemove,
    onAnomalyClick,
    onHintView,
    onHintFix,
    onPrefixClick,
}: {
    rangesCount: number;
    audit: SampleAudit;
    parseErrors: string[];
    rangeInput: string;
    onRangeInputChange: (value: string) => void;
    rangeInputError: string | null;
    baseSampleOptions: string[];
    suggestionsLoading: boolean;
    onAddRange: () => void;
    onFocusInput: () => void;
    onBlurInput: () => void;
    rangesByWell: [string, RangeEntry[]][];
    anomalySet: Set<string>;
    notOnPhotoSet: Set<string>;
    duplicateSet: Set<string>;
    linksByRange: Map<string, SampleWordLink[]>;
    numbersByRange: Map<string, string[]>;
    activeSample: string | null;
    rowRefs: MutableRefObject<Map<string, HTMLTableRowElement | null>>;
    anomalies: AnomalyChip[];
    hints: SampleHint[];
    prefixIssues: PrefixIssue[];
    countMismatch: CountMismatch | null;
    onRowClick: (rangeId: string) => void;
    onEdit: (range: RangeEntry) => void;
    onRemove: (id: string) => void;
    onAnomalyClick: (rangeId: string) => void;
    onHintView: (rangeId: string) => void;
    onHintFix: (hint: SampleHint) => void;
    onPrefixClick: (rangeId: string) => void;
}) {
    return (
        <>
            <Box>
                <Typography variant="subtitle1">Пробы ({rangesCount})</Typography>
                <Typography variant="caption" color="text.secondary">
                    На фото распознано: {audit.photoSamples.length} · в списке: {rangesCount}
                    {audit.duplicateNumbers.length > 0 && ` · дублей: ${audit.duplicateNumbers.length}`}
                    {audit.notOnPhotoIds.length > 0 && ` · нет на фото: ${audit.notOnPhotoIds.length}`}
                    {hints.length > 0 && ` · похожих на ошибку OCR: ${hints.length}`}
                </Typography>
            </Box>

            <SampleInputBar
                value={rangeInput}
                onChange={onRangeInputChange}
                options={baseSampleOptions}
                loading={suggestionsLoading}
                error={rangeInputError}
                onAdd={onAddRange}
                onFocus={onFocusInput}
                onBlur={onBlurInput}
            />

            {rangesCount > 0 && (
                <RangesTable
                    rangesByWell={rangesByWell}
                    anomalySet={anomalySet}
                    notOnPhotoSet={notOnPhotoSet}
                    duplicateSet={duplicateSet}
                    linksByRange={linksByRange}
                    numbersByRange={numbersByRange}
                    activeSample={activeSample}
                    rowRefs={rowRefs}
                    onRowClick={onRowClick}
                    onEdit={onEdit}
                    onRemove={onRemove}
                    maxHeight="calc(100vh - 430px)"
                />
            )}

            <AuditAlerts
                missing={audit.missing}
                anomalies={anomalies}
                hints={hints}
                prefixIssues={prefixIssues}
                countMismatch={countMismatch}
                parseErrors={parseErrors}
                duplicates={audit.duplicateNumbers}
                notOnPhotoNumbers={audit.notOnPhotoIds.flatMap(
                    (rid) => numbersByRange.get(rid) ?? [],
                )}
                onMissingClick={onRangeInputChange}
                onAnomalyClick={onAnomalyClick}
                onHintView={onHintView}
                onHintFix={onHintFix}
                onPrefixClick={onPrefixClick}
            />
        </>
    );
}