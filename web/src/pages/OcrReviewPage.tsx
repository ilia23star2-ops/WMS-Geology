/**
 * Экран проверки OCR.
 *
 * c-3.x-migration-5c/5d: layout, approve, SmartAutocomplete, suggestions.
 * c-3.x-migration-5f:
 *   - Предзаполнение из task.raw_ocr_data.extracted.
 *   - Двусторонняя подсветка bbox ↔ поля (activeField).
 *   - Пробы: диапазон через SmartAutocomplete + RangeEditDialog (как в
 *     FillContainerContent: skipped / selected).
 *   - Подсказки в поле «Диапазон проб» — baseSampleOptions из suggestions.samples.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    IconButton,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

import { useContainerTypes } from "../api/containerTypes";
import {
    useLaboratories,
    useResearchTypes,
    useSites,
} from "../api/catalogs";
import {
    OCR_ZONE_LABELS,
    resolveImageUrl,
    useApproveOcrTask,
    useOcrTask,
    type OcrApprovePayload,
    type OcrTask,
    type OcrZone,
    type OcrZoneType,
    type SampleGroup,
} from "../api/ocr";
import { useSuggestions } from "../api/suggestions";
import SmartAutocomplete from "../components/SmartAutocomplete";
import RangeEditDialog from "../components/RangeEditDialog";
import {
    parseSampleInput,
    type ParsedSampleRange,
} from "../utils/parseSampleInput";

// ---------- типы ----------
interface RangeEntry extends ParsedSampleRange {
    id: string;
    rawInput: string;
    allSeqs: number[];
    skippedSeqs: number[];
    selectedSeqs: number[];
}

function newRangeId(): string {
    return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeAllSeqs(from: number, to: number): number[] {
    const out: number[] = [];
    for (let i = from; i <= to; i++) out.push(i);
    return out;
}

function groupSeqsToRanges(
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

export default function OcrReviewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const parsedTaskId = id ? parseInt(id, 10) : NaN;
    const taskId = Number.isFinite(parsedTaskId) && parsedTaskId > 0 ? parsedTaskId : null;

    const { data: task, isLoading, error } = useOcrTask(taskId);
    const approve = useApproveOcrTask(taskId ?? 0);

    const containerTypes = useContainerTypes();
    const researchTypes = useResearchTypes();
    const sites = useSites();
    const labs = useLaboratories();

    const laboratoryPrefixes = useMemo(
        () => (labs.data ?? []).flatMap((l) => l.prefixes ?? []),
        [labs.data],
    );
    const siteMatchPatterns = useMemo(
        () => (sites.data ?? []).flatMap((s) => s.match_patterns ?? []),
        [sites.data],
    );

    const [siteName, setSiteName] = useState("");
    const [researchTypeName, setResearchTypeName] = useState("");
    const [containerTypeName, setContainerTypeName] = useState("");
    const [workOrderCoded, setWorkOrderCoded] = useState("");
    const [workOrderIncoming, setWorkOrderIncoming] = useState("");
    const [containerNumber, setContainerNumber] = useState("");

    const [ranges, setRanges] = useState<RangeEntry[]>([]);
    const [rangeInput, setRangeInput] = useState("");
    const [rangeInputError, setRangeInputError] = useState<string | null>(null);
    const [editingRange, setEditingRange] = useState<RangeEntry | null>(null);

    const [activeField, setActiveField] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitOk, setSubmitOk] = useState<string | null>(null);
    const [prefilled, setPrefilled] = useState(false);

    const siteId = useMemo(() => {
        if (!siteName) return null;
        const s = sites.data?.find((x) => x.name === siteName || x.code === siteName);
        return s?.id ?? null;
    }, [sites.data, siteName]);

    const researchTypeId = useMemo(() => {
        if (!researchTypeName) return null;
        const clean = researchTypeName.split(" — ")[0].trim();
        const rt = researchTypes.data?.find((x) => x.code === clean || x.name === clean);
        return rt?.id ?? null;
    }, [researchTypes.data, researchTypeName]);

    const containerTypeId = useMemo(() => {
        if (!containerTypeName) return null;
        const ct = containerTypes.data?.find((x) => x.name === containerTypeName);
        return ct?.id ?? null;
    }, [containerTypes.data, containerTypeName]);

    const suggestions = useSuggestions(
        {
            site: siteId ?? undefined,
            research_type: researchTypeId
                ? researchTypes.data?.find((r) => r.id === researchTypeId)?.code
                : undefined,
        },
        siteId !== null || researchTypeId !== null,
    );

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

    const baseSampleOptions = useMemo(() => {
        const samples = suggestions.data?.samples ?? [];
        const groups = new Map<string, string[]>();
        for (const sampleNumber of samples) {
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
    }, [suggestions.data, usedSampleNumbers]);

    // ---------- предзаполнение ----------
    useEffect(() => {
        if (!task || prefilled) return;
        const ex = task.raw_ocr_data?.extracted;
        if (!ex) {
            setPrefilled(true);
            return;
        }
        if (ex.work_order_coded) setWorkOrderCoded(ex.work_order_coded);
        if (ex.work_order_incoming) setWorkOrderIncoming(ex.work_order_incoming);
        if (ex.container_number) setContainerNumber(ex.container_number);
        if (ex.research_type) {
            const rt = researchTypes.data?.find(
                (x) => x.code === ex.research_type || x.name === ex.research_type,
            );
            if (rt) setResearchTypeName(`${rt.code} — ${rt.name}`);
        }
        if (ex.samples && ex.samples.length > 0) {
            const opts = {
                laboratoryPrefixes,
                siteMatchPatterns,
                hasIncomingWorkOrder: (ex.work_order_incoming ?? "").trim() !== "",
            };
            const parsed: RangeEntry[] = [];
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
                }
            }
            setRanges(parsed);
        }
        setPrefilled(true);
    }, [task, prefilled, researchTypes.data, laboratoryPrefixes, siteMatchPatterns]);

    useEffect(() => {
        if (!task?.raw_ocr_data?.text) return;
        if (containerNumber) return;
        const m = task.raw_ocr_data.text.match(/\b[TТ][-–]?\d{2,6}\b/);
        if (m) setContainerNumber(m[0]);
    }, [task, containerNumber]);

    const rangesByWell = useMemo(() => {
        const map = new Map<string, RangeEntry[]>();
        for (const r of ranges) {
            const key = r.wellName ?? "__none__";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        return map;
    }, [ranges]);

    const handleAddRange = () => {
        const result = parseSampleInput(rangeInput, {
            laboratoryPrefixes,
            siteMatchPatterns,
            hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
        });
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
        const result = parseSampleInput(raw, {
            laboratoryPrefixes,
            siteMatchPatterns,
            hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
        });
        if (!result.ok) {
            setSubmitError(result.error);
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

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }
    if (error || !task) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                Не удалось загрузить задачу{error ? `: ${String(error)}` : "."}
            </Alert>
        );
    }
    if (task.status === "DONE") {
        return <Alert severity="info" sx={{ m: 2 }}>Задача уже подтверждена.</Alert>;
    }
    if (task.status === "ERROR") {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                OCR упал: {task.error_message || "нет сообщения"}
            </Alert>
        );
    }

    const onSubmit = () => {
        setSubmitError(null);
        setSubmitOk(null);
        if (ranges.length === 0) {
            setSubmitError("Добавь хотя бы одну группу проб.");
            return;
        }
        if (containerTypeId === null) {
            setSubmitError("Тип тары не найден — выбери из списка.");
            return;
        }
        if (researchTypeId === null) {
            setSubmitError("Тип исследования не найден — выбери из списка.");
            return;
        }
        const hasIncoming = workOrderIncoming.trim() !== "";
        const sampleGroups: SampleGroup[] = [];
        for (const r of ranges) {
            const wellName = hasIncoming ? null : r.middle;
            const skipped = new Set(r.skippedSeqs);
            const selected = new Set(r.selectedSeqs);
            const normal = r.allSeqs.filter((s) => !skipped.has(s) && !selected.has(s));
            const selArr = r.allSeqs.filter((s) => selected.has(s) && !skipped.has(s));
            sampleGroups.push(...groupSeqsToRanges(r, normal, "NORMAL", wellName));
            sampleGroups.push(...groupSeqsToRanges(r, selArr, "SELECTED", wellName));
        }
        if (sampleGroups.length === 0) {
            setSubmitError("Все пробы пропущены — оставь хотя бы одну.");
            return;
        }
        const payload: OcrApprovePayload = {
            container_number: containerNumber.trim(),
            container_type_id: containerTypeId,
            work_order_coded: workOrderCoded.trim(),
            work_order_incoming: workOrderIncoming.trim(),
            research_type_id: researchTypeId,
            site_id: siteId,
            sample_groups: sampleGroups,
        };
        approve.mutate(payload, {
            onSuccess: (res) => {
                setSubmitOk(
                    `Создана тара #${res.container_id}, проб: ${res.samples_created}.` +
                    (res.batch_completed ? " Батч закрыт." : ""),
                );
                setTimeout(
                    () => navigate(`/containers?highlight=${res.container_id}`),
                    1500,
                );
            },
            onError: (e) => {
                setSubmitError(
                    (e as { response?: { data?: { error?: string } } })
                        ?.response?.data?.error ?? String(e),
                );
            },
        });
    };

    const focusField = (name: string) => setActiveField(name);
    const blurField = () => setActiveField(null);
    const fieldSx = (name: string) => ({
        bgcolor: activeField === name ? "rgba(255, 152, 0, 0.1)" : "transparent",
        transition: "background-color 200ms",
        borderRadius: 1,
    });

    return (
        <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
            <Typography variant="h5" gutterBottom>
                Проверка OCR — задача #{task.id} ({task.status})
            </Typography>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                    alignItems: "start",
                }}
            >
                <ImageWithBboxes
                    task={task}
                    activeField={activeField}
                    onBboxClick={(type) => setActiveField(type)}
                />
                <Paper sx={{ p: 2 }}>
                    <Stack spacing={2}>
                        <Typography variant="subtitle1">Шапка тары</Typography>

                        <Box sx={fieldSx("site")} onFocus={() => focusField("site")} onBlur={blurField}>
                            <SmartAutocomplete
                                label="Участок"
                                value={siteName}
                                onChange={setSiteName}
                                options={(sites.data ?? []).map(
                                    (s) => `${s.code} — ${s.name}`,
                                )}
                                loading={sites.isLoading}
                            />
                        </Box>

                        <Box sx={fieldSx("research_type")} onFocus={() => focusField("research_type")} onBlur={blurField}>
                            <SmartAutocomplete
                                label="Тип исследования"
                                value={researchTypeName}
                                onChange={setResearchTypeName}
                                options={(researchTypes.data ?? []).map(
                                    (r) => `${r.code} — ${r.name}`,
                                )}
                                loading={researchTypes.isLoading}
                                required
                            />
                        </Box>

                        <Box sx={fieldSx("work_order_coded")} onFocus={() => focusField("work_order_coded")} onBlur={blurField}>
                            <SmartAutocomplete
                                label="Н/З (текущий)"
                                value={workOrderCoded}
                                onChange={setWorkOrderCoded}
                                options={suggestions.data?.work_orders ?? []}
                                loading={suggestions.isFetching}
                                required
                                helperText={
                                    siteId === null && researchTypeId === null
                                        ? "Выбери участок или ТИ — появятся подсказки"
                                        : suggestions.data?.work_orders?.length
                                            ? `Подсказок: ${suggestions.data.work_orders.length}`
                                            : "Подсказок нет — введи вручную"
                                }
                            />
                        </Box>

                        <Box sx={fieldSx("work_order_incoming")} onFocus={() => focusField("work_order_incoming")} onBlur={blurField}>
                            <SmartAutocomplete
                                label="Н/З (входящий)"
                                value={workOrderIncoming}
                                onChange={setWorkOrderIncoming}
                                options={suggestions.data?.work_orders_incoming ?? []}
                                loading={suggestions.isFetching}
                                helperText={
                                    workOrderIncoming.trim() !== ""
                                        ? "Заполнено — пробы считаются шифрованными (без скважины)"
                                        : "Не заполнено — проба нешифрованная (скважина = middle)"
                                }
                            />
                        </Box>

                        <Box sx={fieldSx("container_type")}>
                            <SmartAutocomplete
                                label="Тип тары"
                                value={containerTypeName}
                                onChange={setContainerTypeName}
                                options={(containerTypes.data ?? []).map((c) => c.name)}
                                loading={containerTypes.isLoading}
                                required
                            />
                        </Box>

                        <Box sx={fieldSx("container_number")} onFocus={() => focusField("container_number")} onBlur={blurField}>
                            <TextField
                                label="Номер тары"
                                value={containerNumber}
                                onChange={(e) => setContainerNumber(e.target.value)}
                                fullWidth
                                size="small"
                            />
                        </Box>

                        <Typography variant="subtitle1" sx={{ pt: 1 }}>
                            Пробы ({ranges.length})
                        </Typography>

                        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                            <Box sx={{ flexGrow: 1 }} onFocus={() => focusField("sample")} onBlur={blurField}>
                                <SmartAutocomplete
                                    label="Диапазон проб"
                                    value={rangeInput}
                                    onChange={(v) => {
                                        setRangeInput(v);
                                        setRangeInputError(null);
                                    }}
                                    options={baseSampleOptions}
                                    loading={suggestions.isFetching}
                                    appendOnSelect="-"
                                    error={Boolean(rangeInputError)}
                                    helperText={
                                        rangeInputError ??
                                        "Выбери базу из подсказок (клик → «-») или введи вручную: TAA-A34076001-031"
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddRange();
                                        }
                                    }}
                                />
                            </Box>
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={handleAddRange}
                                sx={{ whiteSpace: "nowrap", height: 40 }}
                            >
                                Добавить
                            </Button>
                        </Box>

                        {ranges.length > 0 && (
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Диапазон</TableCell>
                                        <TableCell>Скважина</TableCell>
                                        <TableCell align="right">Проб</TableCell>
                                        <TableCell align="right"></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Array.from(rangesByWell.entries()).map(
                                        ([wellKey, wellRanges]) => (
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
                                                    return (
                                                        <TableRow key={r.id}>
                                                            <TableCell>
                                                                <Typography
                                                                    variant="body2"
                                                                    sx={{ fontFamily: "monospace" }}
                                                                >
                                                                    {r.rawInput}
                                                                </Typography>
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
                                                                        onClick={() => setEditingRange(r)}
                                                                    >
                                                                        <EditIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Удалить">
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => removeRange(r.id)}
                                                                    >
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </TableCell>
                                                        </TableRow>
                                                    );
                                                })}
                                            </Fragment>
                                        ),
                                    )}
                                </TableBody>
                            </Table>
                        )}

                        {submitError && <Alert severity="error">{submitError}</Alert>}
                        {submitOk && <Alert severity="success">{submitOk}</Alert>}

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="contained"
                                onClick={onSubmit}
                                disabled={approve.isPending}
                            >
                                {approve.isPending ? "Сохраняем…" : "Подтвердить"}
                            </Button>
                            <Button onClick={() => navigate(-1)}>Отмена</Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>

            <RangeEditDialog
                open={editingRange !== null}
                initialRaw={editingRange?.rawInput ?? ""}
                initialSkipped={editingRange?.skippedSeqs.join(" ") ?? ""}
                initialSelected={editingRange?.selectedSeqs.join(" ") ?? ""}
                onClose={() => setEditingRange(null)}
                onSave={handleRangeSave}
            />
        </Box>
    );
}

// ---------- Image + bbox overlay с подсветкой ----------
function ImageWithBboxes({
    task,
    activeField,
    onBboxClick,
}: {
    task: OcrTask;
    activeField: string | null;
    onBboxClick: (type: string) => void;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
    const src = resolveImageUrl(task.image);

    const zones: OcrZone[] = task.zones ?? [];

    return (
        <Card sx={{ height: "100%" }}>
            <CardContent sx={{ position: "relative", overflow: "auto" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                        ref={imgRef}
                        src={src}
                        alt="OCR"
                        onLoad={() => {
                            const el = imgRef.current;
                            if (el) setDims({ w: el.naturalWidth, h: el.naturalHeight });
                        }}
                        style={{ maxWidth: "100%", display: "block" }}
                    />
                    {dims && (
                        <svg
                            viewBox={`0 0 ${dims.w} ${dims.h}`}
                            preserveAspectRatio="none"
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                pointerEvents: "none",
                            }}
                        >
                            {zones.map((zone, i) => {
                                const active = activeField === zone.type;
                                return (
                                    <polygon
                                        key={`zone-${i}`}
                                        points={zone.bbox
                                            .map(([x, y]) => `${x},${y}`)
                                            .join(" ")}
                                        fill={
                                            active
                                                ? "rgba(255, 152, 0, 0.3)"
                                                : "rgba(30, 58, 95, 0.08)"
                                        }
                                        stroke={
                                            active
                                                ? "rgba(255, 152, 0, 0.95)"
                                                : "rgba(30, 58, 95, 0.7)"
                                        }
                                        strokeWidth={active ? 3 : 1.5}
                                        style={{ pointerEvents: "all", cursor: "pointer" }}
                                        onClick={() => onBboxClick(zone.type)}
                                    />
                                );
                            })}
                            {zones.length === 0 && task.raw_ocr_data?.words.map((w, i) => (
                                <polygon
                                    key={`word-${i}`}
                                    points={w.bbox
                                        .map(([x, y]) => `${x},${y}`)
                                        .join(" ")}
                                    fill="rgba(30, 58, 95, 0.15)"
                                    stroke="rgba(30, 58, 95, 0.9)"
                                    strokeWidth={2}
                                />
                            ))}
                        </svg>
                    )}
                    {dims && zones.length > 0 && zones.map((zone, i) => {
                        const active = activeField === zone.type;
                        const xs = zone.bbox.map((p) => p[0]);
                        const ys = zone.bbox.map((p) => p[1]);
                        const minX = Math.min(...xs);
                        const minY = Math.min(...ys);
                        return (
                            <div
                                key={`label-${i}`}
                                onClick={() => onBboxClick(zone.type)}
                                style={{
                                    position: "absolute",
                                    left: `${(minX / dims.w) * 100}%`,
                                    top: `${(minY / dims.h) * 100}%`,
                                    transform: "translateY(-100%)",
                                    background: active ? "orange" : "#1E3A5F",
                                    color: "white",
                                    fontSize: 10,
                                    padding: "1px 4px",
                                    borderRadius: 2,
                                    cursor: "pointer",
                                    whiteSpace: "nowrap",
                                    zIndex: 10,
                                }}
                            >
                                {OCR_ZONE_LABELS[zone.type as OcrZoneType] ?? zone.type}
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}