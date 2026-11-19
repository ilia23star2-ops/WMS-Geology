/**
 * Таблица проб с группами по скважинам (вынесено из OcrReviewPage, 6e-2-web).
 * Клик по строке — переход к боксу на фото; цвет строки = цвет её статуса.
 * fix6: статусы «дубль» (красный, блокер) и «нет на фото» (серо-синий, курсив).
 */
import { Fragment, type MutableRefObject } from "react";
import {
    Box,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import type { ParsedSampleRange } from "../../utils/parseSampleInput";
import type { SampleWordLink, SampleWordStatus } from "../../utils/ocrSampleAudit";
import { STATUS_COLORS, STATUS_LABELS } from "./ImageWithBboxes";

/** fix6: цвета статусов, которых нет на фото (они только у строк списка). */
const DUPLICATE_COLOR = "#C62828";
const NOT_ON_PHOTO_COLOR = "#546E7A";

export interface RangeEntry extends ParsedSampleRange {
    id: string;
    rawInput: string;
    allSeqs: number[];
    skippedSeqs: number[];
    selectedSeqs: number[];
}

export default function RangesTable({
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
    maxHeight,
}: {
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
    maxHeight?: number | string;
}) {
    return (
        <Box sx={{ maxHeight: maxHeight ?? 340, overflow: "auto" }}>
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell>Диапазон</TableCell>
                        <TableCell>Скважина</TableCell>
                        <TableCell align="right">Проб</TableCell>
                        <TableCell align="right"></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {rangesByWell.map(([wellKey, wellRanges]) => (
                        <Fragment key={wellKey}>
                            <TableRow>
                                <TableCell
                                    colSpan={4}
                                    sx={{
                                        bgcolor: "action.hover",
                                        fontWeight: 600,
                                        fontSize: "0.85rem",
                                    }}
                                >
                                    {wellKey === "__none__"
                                        ? "Без скважины (шифрованные)"
                                        : `Скважина: ${wellKey}`}
                                </TableCell>
                            </TableRow>
                            {wellRanges.map((r) => {
                                const validCount =
                                    r.allSeqs.length - r.skippedSeqs.length;
                                const isAnomaly = anomalySet.has(r.id);
                                const isDuplicate = duplicateSet.has(r.id);
                                const isNotOnPhoto = notOnPhotoSet.has(r.id);
                                const rowLinks = linksByRange.get(r.id) ?? [];
                                const nums = numbersByRange.get(r.id) ?? [];
                                const isActiveRow =
                                    activeSample !== null && nums.includes(activeSample);
                                const rowStatus: SampleWordStatus | null = isAnomaly
                                    ? "anomaly"
                                    : rowLinks.length > 0
                                        ? "covered"
                                        : null;
                                // Приоритет: дубль → аномалия → нет на фото →普通的 статус.
                                const rowColor = isDuplicate
                                    ? DUPLICATE_COLOR
                                    : isAnomaly
                                        ? STATUS_COLORS.anomaly
                                        : isNotOnPhoto
                                            ? NOT_ON_PHOTO_COLOR
                                            : rowStatus
                                                ? STATUS_COLORS[rowStatus]
                                                : null;
                                const rowLabel = isDuplicate
                                    ? "дубль — такой номер уже есть в списке, удали лишнюю строку"
                                    : isAnomaly
                                        ? `проба ${STATUS_LABELS.anomaly}`
                                        : isNotOnPhoto
                                            ? "нет на фото — добавлено вручную, проверь номер"
                                            : rowStatus
                                                ? `проба ${STATUS_LABELS[rowStatus]}`
                                                : "";
                                const rowMark = isDuplicate
                                    ? "⛔ "
                                    : isAnomaly
                                        ? "⚠ "
                                        : isNotOnPhoto
                                            ? "◌ "
                                            : "";
                                return (
                                    <TableRow
                                        key={r.id}
                                        ref={(el) => {
                                            rowRefs.current.set(r.id, el);
                                        }}
                                        onClick={() => onRowClick(r.id)}
                                        sx={{
                                            cursor: "pointer",
                                            bgcolor: rowColor ? `${rowColor}1F` : undefined,
                                            boxShadow: isActiveRow
                                                ? `inset 0 0 0 2px ${rowColor ?? "#1E88E5"}`
                                                : undefined,
                                            "&:hover": {
                                                bgcolor: rowColor ? `${rowColor}33` : "action.hover",
                                            },
                                        }}
                                    >
                                        <TableCell>
                                            <Tooltip
                                                title={
                                                    rowLabel
                                                        ? `${rowLabel} — клик ведёт к боксу на фото`
                                                        : "Клик ведёт к боксу на фото"
                                                }
                                            >
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontFamily: "monospace",
                                                        fontWeight: isDuplicate || isAnomaly ? 700 : 400,
                                                        fontStyle: isNotOnPhoto ? "italic" : undefined,
                                                        color: rowColor ?? "text.primary",
                                                    }}
                                                >
                                                    {rowMark}{r.rawInput}
                                                </Typography>
                                            </Tooltip>
                                            {(r.skippedSeqs.length > 0 ||
                                                r.selectedSeqs.length > 0) && (
                                                    <Typography
                                                        variant="caption"
                                                        sx={{ color: "text.secondary" }}
                                                    >
                                                        {r.skippedSeqs.length > 0 &&
                                                            `Проп: ${r.skippedSeqs.length}`}
                                                        {r.skippedSeqs.length > 0 &&
                                                            r.selectedSeqs.length > 0 &&
                                                            " · "}
                                                        {r.selectedSeqs.length > 0 &&
                                                            `Выбр: ${r.selectedSeqs.length}`}
                                                    </Typography>
                                                )}
                                        </TableCell>
                                        <TableCell>
                                            {r.wellName ?? "—"}
                                        </TableCell>
                                        <TableCell align="right">
                                            {validCount}
                                        </TableCell>
                                        <TableCell align="right">
                                            <Tooltip title="Редактировать">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEdit(r);
                                                    }}
                                                >
                                                    <EditIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Удалить">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onRemove(r.id);
                                                    }}
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </Fragment>
                    ))}
                </TableBody>
            </Table>
        </Box>
    );
}