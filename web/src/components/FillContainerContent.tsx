/**
 * Содержимое формы управления пробами в таре (2f-17a).
 *
 * Вынесено из FillContainerDialog, чтобы использовать один и тот же
 * компонент:
 * - как тело диалога (`FillContainerDialog`);
 * - как вкладку «Редактирование» в `ContainerDetailDialog` (2f-17c).
 *
 * Без <Dialog>/<DialogContent>/<DialogActions> — кнопки в <Box> в конце.
 * Все внутренние модалки (RangeEditDialog, SampleEditDialog)
 * рендерятся как есть — MUI stacking через portal.
 *
 * 2f-17c: порядок блоков — сначала строка добавления диапазонов
 * (и таблица добавленных), потом список существующих проб.
 * 2f-17c-fix: убрана кнопка «Предпросмотр» внизу — она теперь
 * только в шапке ContainerDetailDialog (этикетка/QR).
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Divider,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { useQueryClient } from "@tanstack/react-query";

import {
    useFillSamples,
    useLaboratories,
    useSamples,
    useSites,
    deleteSample,
    SAMPLE_STATUS_LABELS,
    type Container,
    type FillSamplesGroup,
    type SampleStatus,
} from "../api";
import {
    buildSampleNumbers,
    parseSampleInput,
} from "../utils/parseSampleInput";
import RangeEditDialog from "./RangeEditDialog";
import SampleEditDialog from "./SampleEditDialog";

interface FillContainerContentProps {
    container: Container;
    onClose: () => void;
    onSuccess: (containerId: number, totalSamples: number) => void;
}

interface AddedRange {
    id: string;
    rawInput: string;
    prefix: string;
    middle: string;
    sequenceFrom: number;
    sequenceTo: number;
    sequenceDigits: number;
    wellName: string | null;
    allSeqs: number[];
    skippedSeqs: number[];
    selectedSeqs: number[];
}

const STATUS_COLORS: Record<
    SampleStatus,
    "success" | "warning" | "info" | "default" | "error"
> = {
    IN_STORAGE: "success",
    IN_TRANSIT: "info",
    CONSUMED: "warning",
    DISPOSED: "error",
    PENDING_PLACEMENT: "warning",
    SELECTED: "default",
};

function groupSeqsToRanges(range: AddedRange, seqs: number[], status: string): FillSamplesGroup[] {
    if (seqs.length === 0) return [];
    const sorted = [...seqs].sort((a, b) => a - b);
    const groups: Array<{ from: number; to: number }> = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            groups.push({ from: start, to: prev });
            start = sorted[i];
            prev = sorted[i];
        }
    }
    groups.push({ from: start, to: prev });

    return groups.map((g) => ({
        prefix: range.prefix,
        middle: range.middle,
        sequence_from: g.from,
        sequence_to: g.to,
        sequence_digits: range.sequenceDigits,
        well_name: range.wellName,
        status: status,
    }));
}

function summarizeRange(range: AddedRange): string {
    const skipped = new Set(range.skippedSeqs);
    const selected = new Set(range.selectedSeqs);
    const valid = range.allSeqs.filter((s) => !skipped.has(s));

    if (valid.length === 0) return "все пропущены";

    const parts: string[] = [];
    const normal = valid.filter(s => !selected.has(s));
    if (normal.length > 0) parts.push(formatSeqArray(normal, range.sequenceDigits));

    if (selected.size > 0) {
        const sArr = Array.from(selected).filter(s => valid.includes(s)).sort((a, b) => a - b);
        if (sArr.length > 0) parts.push(`[Выб: ${formatSeqArray(sArr, range.sequenceDigits)}]`);
    }
    return parts.join(" ");
}

function formatSeqArray(seqs: number[], digits: number): string {
    const sorted = [...seqs].sort((a, b) => a - b);
    const pad = (n: number) => String(n).padStart(digits, "0");
    const parts: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            parts.push(start === prev ? pad(start) : `${pad(start)}-${pad(prev)}`);
            start = sorted[i];
            prev = sorted[i];
        }
    }
    parts.push(start === prev ? pad(start) : `${pad(start)}-${pad(prev)}`);
    return parts.join(", ");
}

export default function FillContainerContent({
    container,
    onClose,
    onSuccess,
}: FillContainerContentProps) {
    const queryClient = useQueryClient();
    const [containerNumber, setContainerNumber] = useState("");
    const [input, setInput] = useState("");
    const [ranges, setRanges] = useState<AddedRange[]>([]);
    const [deletedIds, setDeletedIds] = useState<number[]>([]);
    const [inputError, setInputError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [editingRange, setEditingRange] = useState<AddedRange | null>(null);
    const [editingSampleId, setEditingSampleId] = useState<number | null>(null);

    const laboratories = useLaboratories();
    const sites = useSites();
    const fillMutation = useFillSamples(container.id);

    const samplesQuery = useSamples({
        page: 1,
        filters: { container_id: container.id, show_disposed: true },
    });

    const existingSamples = useMemo(() => {
        return (samplesQuery.data?.results ?? []).filter(s => !deletedIds.includes(s.id));
    }, [samplesQuery.data, deletedIds]);

    const existingNumbers = useMemo(() => {
        const set = new Set<string>();
        for (const s of samplesQuery.data?.results ?? []) {
            if (!deletedIds.includes(s.id)) set.add(s.sample_number);
        }
        for (const r of ranges) {
            const valid = r.allSeqs.filter(s => !r.skippedSeqs.includes(s));
            for (const seq of valid) {
                set.add(`${r.prefix}${r.middle}${String(seq).padStart(r.sequenceDigits, "0")}`);
            }
        }
        return set;
    }, [ranges, samplesQuery.data, deletedIds]);

    const labPrefixes = useMemo(() => (laboratories.data ?? []).flatMap((l) => l.prefixes ?? []), [laboratories.data]);
    const sitePatterns = useMemo(() => (sites.data ?? []).flatMap((s) => s.match_patterns ?? []), [sites.data]);

    const hasIncoming = Boolean(container.draft_work_order_incoming);

    function reset() {
        setContainerNumber("");
        setInput("");
        setRanges([]);
        setDeletedIds([]);
        setInputError(null);
        setSubmitError(null);
        setEditingRange(null);
        setEditingSampleId(null);
    }

    function handleClose() {
        if (fillMutation.isPending) return;
        reset();
        onClose();
    }

    function handleDeleteExisting(id: number) {
        if (window.confirm("Удалить эту пробу?")) {
            setDeletedIds(prev => [...prev, id]);
        }
    }

    function handleAddRange() {
        setInputError(null);
        const result = parseSampleInput(input, {
            laboratoryPrefixes: labPrefixes,
            siteMatchPatterns: sitePatterns,
            hasIncomingWorkOrder: hasIncoming,
        });
        if (!result.ok) {
            setInputError(result.error);
            return;
        }

        const nums = buildSampleNumbers(result.value);
        const dupes = nums.filter((n) => existingNumbers.has(n));
        if (dupes.length > 0) {
            setInputError(`Проба уже добавлена: ${dupes.slice(0, 3).join(", ")}`);
            return;
        }

        const allSeqs: number[] = [];
        for (let i = result.value.sequenceFrom; i <= result.value.sequenceTo; i++) allSeqs.push(i);

        setRanges((prev) => [
            ...prev,
            {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                rawInput: input.trim(),
                prefix: result.value.prefix,
                middle: result.value.middle,
                sequenceFrom: result.value.sequenceFrom,
                sequenceTo: result.value.sequenceTo,
                sequenceDigits: result.value.sequenceDigits,
                wellName: result.value.wellName,
                allSeqs,
                skippedSeqs: [],
                selectedSeqs: [],
            },
        ]);
        setInput("");
    }

    function handleRemoveRange(id: string) {
        setRanges((prev) => prev.filter((r) => r.id !== id));
    }

    function handleSaveRangeEdit(newRaw: string, skipped: number[], selected: number[]) {
        if (!editingRange) return;

        const parseResult = parseSampleInput(newRaw, {
            laboratoryPrefixes: labPrefixes,
            siteMatchPatterns: sitePatterns,
            hasIncomingWorkOrder: hasIncoming,
        });

        if (!parseResult.ok) {
            alert("Не удалось распознать новый диапазон. Проверьте формат.");
            return;
        }

        const newAllSeqs: number[] = [];
        for (let i = parseResult.value.sequenceFrom; i <= parseResult.value.sequenceTo; i++) {
            newAllSeqs.push(i);
        }

        const validSkipped = skipped.filter(s => s >= parseResult.value.sequenceFrom && s <= parseResult.value.sequenceTo);
        const validSelected = selected.filter(s => s >= parseResult.value.sequenceFrom && s <= parseResult.value.sequenceTo);

        setRanges((prev) =>
            prev.map((r) =>
                r.id === editingRange.id
                    ? {
                        ...r,
                        rawInput: newRaw,
                        prefix: parseResult.value.prefix,
                        middle: parseResult.value.middle,
                        sequenceFrom: parseResult.value.sequenceFrom,
                        sequenceTo: parseResult.value.sequenceTo,
                        sequenceDigits: parseResult.value.sequenceDigits,
                        allSeqs: newAllSeqs,
                        skippedSeqs: validSkipped,
                        selectedSeqs: validSelected,
                    }
                    : r,
            ),
        );
    }

    async function handleSubmit() {
        setSubmitError(null);

        const trimmedNumber = containerNumber.trim();
        if (!container.container_number && !trimmedNumber && existingSamples.length === 0) {
            setSubmitError("Укажите номер тары или добавьте пробы.");
            return;
        }

        const sampleGroups: FillSamplesGroup[] = [];
        let totalToCreate = 0;

        for (const r of ranges) {
            const skipped = new Set(r.skippedSeqs);
            const selected = new Set(r.selectedSeqs);

            const normal = r.allSeqs.filter(s => !skipped.has(s) && !selected.has(s));
            sampleGroups.push(...groupSeqsToRanges(r, normal, "NORMAL"));

            const selArr = r.allSeqs.filter(s => selected.has(s) && !skipped.has(s));
            sampleGroups.push(...groupSeqsToRanges(r, selArr, "SELECTED"));

            totalToCreate += normal.length + selArr.length;
        }

        try {
            if (deletedIds.length > 0) {
                for (const id of deletedIds) {
                    await deleteSample(id);
                }
            }

            if (totalToCreate > 0) {
                const workOrderCoded = container.draft_work_order_coded?.trim();
                const researchTypeId = container.draft_research_type;
                const siteId = container.draft_site;

                if (!workOrderCoded || !researchTypeId) {
                    setSubmitError("У тары отсутствуют данные для создания новых проб (Н/З или ТИ).");
                    return;
                }

                await fillMutation.mutateAsync({
                    container_number: container.container_number ? null : trimmedNumber,
                    work_order_coded: workOrderCoded,
                    work_order_incoming: container.draft_work_order_incoming,
                    research_type_id: researchTypeId,
                    site_id: siteId,
                    sample_groups: sampleGroups,
                });
            }

            queryClient.invalidateQueries({ queryKey: ["containers"] });
            queryClient.invalidateQueries({ queryKey: ["container", container.id] });
            queryClient.invalidateQueries({ queryKey: ["samples"] });
            queryClient.invalidateQueries({ queryKey: ["container-history", container.id] });

            onSuccess(container.id, existingSamples.length + totalToCreate - deletedIds.length);
            reset();
        } catch (err) {
            const anyErr = err as { response?: { data?: { error?: string; detail?: string } } };
            const data = anyErr?.response?.data;
            let msg = "Не удалось сохранить данные.";

            if (typeof data === "string") msg = data;
            else if (data?.error) msg = data.error;
            else if (data?.detail) msg = data.detail;
            else if (data) msg = JSON.stringify(data);

            setSubmitError(msg);
        }
    }

    const totalSamples = useMemo(
        () => existingSamples.length + ranges.reduce((acc, r) => acc + r.allSeqs.length - r.skippedSeqs.length, 0),
        [ranges, existingSamples],
    );

    return (
        <Box>
            {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}

            {!container.container_number && (
                <TextField
                    label="Номер тары"
                    size="small"
                    fullWidth
                    required
                    value={containerNumber}
                    onChange={(e) => setContainerNumber(e.target.value)}
                    helperText="Присваивается один раз. Например: T-001"
                    sx={{ mb: 2 }}
                />
            )}

            {/* ── Блок «Добавить новые пробы» — вверху (2f-17c) ── */}
            <Typography variant="subtitle1" sx={{ mb: 1 }}>Добавить новые пробы</Typography>

            <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", mb: 1 }}>
                <TextField
                    label="Диапазон проб"
                    size="small"
                    fullWidth
                    value={input}
                    onChange={(e) => { setInput(e.target.value); setInputError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddRange(); } }}
                    error={Boolean(inputError)}
                    helperText={inputError ?? "Например: TAA-A34076001-031 или TST124001-005"}
                />
                <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddRange} sx={{ whiteSpace: "nowrap", height: 40 }}>
                    Добавить
                </Button>
            </Stack>

            {ranges.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Новые диапазоны не добавлены.</Typography>
            ) : (
                <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1, mb: 2 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Ввод</TableCell>
                                <TableCell>Префикс</TableCell>
                                <TableCell>Скважина</TableCell>
                                <TableCell align="right">Итоговый диапазон</TableCell>
                                <TableCell align="right">Проб</TableCell>
                                <TableCell width={100} />
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {ranges.map((r) => {
                                const valid = r.allSeqs.filter(s => !r.skippedSeqs.includes(s));
                                return (
                                    <TableRow key={r.id}>
                                        <TableCell><Typography variant="body2" sx={{ fontFamily: "monospace" }}>{r.rawInput}</Typography></TableCell>
                                        <TableCell>{r.prefix}</TableCell>
                                        <TableCell>{r.wellName ?? <Chip label="текущий" size="small" variant="outlined" />}</TableCell>
                                        <TableCell align="right"><Typography variant="body2">{summarizeRange(r)}</Typography></TableCell>
                                        <TableCell align="right"><Chip size="small" label={valid.length} color={valid.length > 0 ? "primary" : "error"} /></TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title="Редактировать">
                                                    <IconButton size="small" onClick={() => setEditingRange(r)}><EditIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                                <Tooltip title="Удалить">
                                                    <IconButton size="small" color="error" onClick={() => handleRemoveRange(r.id)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Divider sx={{ my: 2 }} />

            {/* ── Существующие пробы — ниже ── */}
            {samplesQuery.isLoading && <Typography>Загрузка проб...</Typography>}

            {existingSamples.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>Пробы в таре ({existingSamples.length})</Typography>
                    <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell>Номер пробы</TableCell>
                                    <TableCell>Статус</TableCell>
                                    <TableCell width={100} />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {existingSamples.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell sx={{ fontFamily: "monospace" }}>{s.sample_number}</TableCell>
                                        <TableCell>
                                            <Chip size="small" label={SAMPLE_STATUS_LABELS[s.status] ?? s.status} color={STATUS_COLORS[s.status] ?? "default"} />
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={0.5}>
                                                <Tooltip title="Редактировать">
                                                    <IconButton size="small" onClick={() => setEditingSampleId(s.id)}>
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Удалить">
                                                    <IconButton size="small" color="error" onClick={() => handleDeleteExisting(s.id)}>
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Stack>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* ── Итого + кнопки ── */}
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1 }}>
                <Typography variant="body2" color="text.secondary">Итого проб: <b>{totalSamples}</b></Typography>
                <Stack direction="row" spacing={1}>
                    <Button onClick={handleClose} disabled={fillMutation.isPending}>Отмена</Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        variant="contained"
                        disabled={fillMutation.isPending || (totalSamples === 0 && deletedIds.length === 0)}
                    >
                        {fillMutation.isPending ? "Сохраняем..." : "Сохранить"}
                    </Button>
                </Stack>
            </Box>

            {editingRange !== null && (
                <RangeEditDialog
                    open={true}
                    initialRaw={editingRange.rawInput}
                    initialSkipped={editingRange.skippedSeqs.join(" ")}
                    initialSelected={editingRange.selectedSeqs.join(" ")}
                    onClose={() => setEditingRange(null)}
                    onSave={handleSaveRangeEdit}
                />
            )}

            {editingSampleId !== null && (
                <SampleEditDialog
                    open={true}
                    sampleId={editingSampleId}
                    onClose={() => setEditingSampleId(null)}
                />
            )}
        </Box>
    );
}