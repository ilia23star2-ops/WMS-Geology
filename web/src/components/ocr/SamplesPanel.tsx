/**
 * Вкладка «Пробы» (6e-2-web-fix7): счётчики, ввод диапазона, таблица на всю
 * высоту колонки и алерты аудита. Слева фото остаётся sticky — сверять удобно.
 */
import type { MutableRefObject } from "react";
import { Box, Typography } from "@mui/material";

import type { SampleAudit, SampleWordLink } from "../../utils/ocrSampleAudit";
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
    onRowClick,
    onEdit,
    onRemove,
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
    onRowClick: (rangeId: string) => void;
    onEdit: (range: RangeEntry) => void;
    onRemove: (id: string) => void;
}) {
    return (
        <>
            <Box>
                <Typography variant="subtitle1">Пробы ({rangesCount})</Typography>
                <Typography variant="caption" color="text.secondary">
                    На фото распознано: {audit.photoSamples.length} · в списке: {rangesCount}
                    {audit.duplicateNumbers.length > 0 && ` · дублей: ${audit.duplicateNumbers.length}`}
                    {audit.notOnPhotoIds.length > 0 && ` · нет на фото: ${audit.notOnPhotoIds.length}`}
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
                anomalyCount={audit.anomalyIds.length}
                parseErrors={parseErrors}
                duplicates={audit.duplicateNumbers}
                notOnPhotoNumbers={audit.notOnPhotoIds.flatMap(
                    (rid) => numbersByRange.get(rid) ?? [],
                )}
                onMissingClick={onRangeInputChange}
            />
        </>
    );
}