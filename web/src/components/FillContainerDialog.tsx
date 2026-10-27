/**
 * Диалог заполнения тары-заготовки пробами.
 *
 * Сценарий:
 * 1. Открывается кликом по заготовке (container_number = null).
 * 2. Шапка read-only: участок, Н/З, ТИ, тип тары — из draft-полей.
 * 3. Номер тары — обязательное поле (присваивается один раз).
 * 4. Ввод проб: единое поле «Диапазон проб» (парсится через parseSampleInput).
 * 5. Кнопка «Редактировать» в строке открывает RangeEditDialog
 *    для выбора/отмены конкретных номеров.
 * 6. Сохранение: POST /storage/containers/{id}/fill-samples/.
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
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

import {
    useContainerTypes,
    useFillSamples,
    useLaboratories,
    useSites,
    type Container,
    type FillSamplesGroup,
} from "../api";
import {
    buildSampleNumbers,
    parseSampleInput,
} from "../utils/parseSampleInput";
import RangeEditDialog from "./RangeEditDialog";

interface FillContainerDialogProps {
    open: boolean;
    container: Container | null;
    onClose: () => void;
    onSuccess: (containerId: number, totalSamples: number) => void;
}

interface AddedRange {
    id: string;
    rawInput: string;
    prefix: string;
    middle: string;
    sequenceDigits: number;
    wellName: string | null;
    allSeqs: number[];
    selectedSeqs: number[];
}

/**
 * Группирует выбранные последовательности в непрерывные поддиапазоны.
 */
function groupSelectedToRanges(range: AddedRange): FillSamplesGroup[] {
    if (range.selectedSeqs.length === 0) return [];

    const seqs = [...range.selectedSeqs].sort((a, b) => a - b);
    const groups: Array<{ from: number; to: number }> = [];

    let start = seqs[0];
    let prev = seqs[0];
    for (let i = 1; i < seqs.length; i++) {
        if (seqs[i] === prev + 1) {
            prev = seqs[i];
        } else {
            groups.push({ from: start, to: prev });
            start = seqs[i];
            prev = seqs[i];
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
    }));
}

/**
 * Краткое описание выбранных номеров для отображения.
 */
function summarizeSelected(range: AddedRange): string {
    if (range.selectedSeqs.length === 0) return "—";

    const sorted = [...range.selectedSeqs].sort((a, b) => a - b);
    const parts: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    const pad = (n: number) => String(n).padStart(range.sequenceDigits, "0");

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

export default function FillContainerDialog({
    open,
    container,
    onClose,
    onSuccess,
}: FillContainerDialogProps) {
    const [containerNumber, setContainerNumber] = useState("");
    const [input, setInput] = useState("");
    const [ranges, setRanges] = useState<AddedRange[]>([]);
    const [inputError, setInputError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [editingRange, setEditingRange] = useState<AddedRange | null>(null);

    const containerTypes = useContainerTypes();
    const laboratories = useLaboratories();
    const sites = useSites();
    const fillMutation = useFillSamples(container?.id ?? 0);

    const containerTypeName = useMemo(() => {
        if (!container) return "—";
        return (
            containerTypes.data?.find((t) => t.id === container.container_type)
                ?.name ?? `#${container.container_type}`
        );
    }, [container, containerTypes.data]);

    const existingNumbers = useMemo(() => {
        const set = new Set<string>();
        for (const r of ranges) {
            for (const seq of r.selectedSeqs) {
                set.add(`${r.prefix}${r.middle}${String(seq).padStart(r.sequenceDigits, "0")}`);
            }
        }
        return set;
    }, [ranges]);

    const labPrefixes = useMemo(
        () => (laboratories.data ?? []).flatMap((l) => l.prefixes ?? []),
        [laboratories.data],
    );
    const sitePatterns = useMemo(
        () => (sites.data ?? []).flatMap((s) => s.match_patterns ?? []),
        [sites.data],
    );

    const hasIncoming = Boolean(container?.draft_work_order_incoming);

    function reset() {
        setContainerNumber("");
        setInput("");
        setRanges([]);
        setInputError(null);
        setSubmitError(null);
        setEditingRange(null);
    }

    function handleClose() {
        if (fillMutation.isPending) return;
        reset();
        onClose();
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

        // Проверка дубликатов
        const dupes = nums.filter((n) => existingNumbers.has(n));
        if (dupes.length > 0) {
            const preview = dupes.slice(0, 3).join(", ");
            const suffix = dupes.length > 3 ? ` и ещё ${dupes.length - 3}` : "";
            setInputError(`Проба уже добавлена: ${preview}${suffix}`);
            return;
        }

        // Генерируем массив всех последовательностей диапазона
        const allSeqs: number[] = [];
        for (let i = result.value.sequenceFrom; i <= result.value.sequenceTo; i++) {
            allSeqs.push(i);
        }

        setRanges((prev) => [
            ...prev,
            {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                rawInput: input.trim(),
                prefix: result.value.prefix,
                middle: result.value.middle,
                sequenceDigits: result.value.sequenceDigits,
                wellName: result.value.wellName,
                allSeqs,
                selectedSeqs: [...allSeqs],
            },
        ]);
        setInput("");
    }

    function handleRemoveRange(id: string) {
        setRanges((prev) => prev.filter((r) => r.id !== id));
    }

    function handleSaveRangeEdit(selectedSeqs: number[]) {
        if (!editingRange) return;
        setRanges((prev) =>
            prev.map((r) =>
                r.id === editingRange.id
                    ? { ...r, selectedSeqs }
                    : r,
            ),
        );
    }

    async function handleSubmit() {
        if (!container) return;
        setSubmitError(null);

        const trimmedNumber = containerNumber.trim();
        if (!container.container_number && !trimmedNumber) {
            setSubmitError("Укажите номер тары.");
            return;
        }

        const sampleGroups: FillSamplesGroup[] = ranges.flatMap(
            groupSelectedToRanges,
        );

        if (sampleGroups.length === 0) {
            setSubmitError("Нет выбранных проб.");
            return;
        }

        const workOrderCoded = container.draft_work_order_coded;
        const researchTypeId = container.draft_research_type;
        const siteId = container.draft_site;

        if (!workOrderCoded) {
            setSubmitError(
                "У заготовки не задан текущий Н/З. Обратитесь к администратору.",
            );
            return;
        }
        if (!researchTypeId) {
            setSubmitError(
                "У заготовки не задан тип исследования. Обратитесь к администратору.",
            );
            return;
        }

        try {
            const result = await fillMutation.mutateAsync({
                container_number: container.container_number
                    ? null
                    : trimmedNumber,
                work_order_coded: workOrderCoded,
                work_order_incoming: container.draft_work_order_incoming,
                research_type_id: researchTypeId,
                site_id: siteId,
                sample_groups: sampleGroups,
            });
            onSuccess(container.id, result.total_samples);
            reset();
            onClose();
        } catch {
            setSubmitError(
                "Не удалось заполнить тару. Проверьте данные и попробуйте ещё раз.",
            );
        }
    }

    const totalSamples = useMemo(
        () => ranges.reduce((acc, r) => acc + r.selectedSeqs.length, 0),
        [ranges],
    );

    const totalAll = useMemo(
        () => ranges.reduce((acc, r) => acc + r.allSeqs.length, 0),
        [ranges],
    );

    if (!container) return null;

    return (
        <>
            <Dialog
                open={open && editingRange === null}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>Заполнить тару пробами</DialogTitle>
                <DialogContent>
                    {submitError && (
                        <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
                            {submitError}
                        </Alert>
                    )}

                    {/* ── Шапка (read-only из draft-полей) ─────────── */}
                    <Box
                        sx={{
                            p: 2,
                            mb: 2,
                            bgcolor: "action.hover",
                            borderRadius: 1,
                        }}
                    >
                        <Typography
                            variant="subtitle2"
                            color="text.secondary"
                            sx={{ mb: 1 }}
                        >
                            Данные заготовки
                        </Typography>
                        <Stack
                            direction="row"
                            spacing={3}
                            sx={{ flexWrap: "wrap", rowGap: 1 }}
                        >
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Участок
                                </Typography>
                                <Typography variant="body2">
                                    {container.draft_site_name ?? "—"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Н/З (текущий)
                                </Typography>
                                <Typography variant="body2">
                                    {container.draft_work_order_coded || "—"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Н/З (вх.)
                                </Typography>
                                <Typography variant="body2">
                                    {container.draft_work_order_incoming || "—"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Тип исследования
                                </Typography>
                                <Typography variant="body2">
                                    {container.draft_research_type_name ?? "—"}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Тип тары
                                </Typography>
                                <Typography variant="body2">
                                    {containerTypeName}
                                </Typography>
                            </Box>
                        </Stack>
                    </Box>

                    {/* ── Номер тары ──────────────────────────────── */}
                    <TextField
                        label="Номер тары"
                        size="small"
                        fullWidth
                        required={!container.container_number}
                        value={container.container_number ?? containerNumber}
                        onChange={(e) => setContainerNumber(e.target.value)}
                        disabled={Boolean(container.container_number)}
                        helperText={
                            container.container_number
                                ? "Номер уже присвоен."
                                : "Присваивается один раз. Например: T-001"
                        }
                        sx={{ mb: 2 }}
                    />

                    <Divider sx={{ my: 2 }} />

                    {/* ── Ввод проб ──────────────────────────────── */}
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>
                        Пробы
                    </Typography>

                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "flex-start", mb: 1 }}
                    >
                        <TextField
                            label="Диапазон проб"
                            size="small"
                            fullWidth
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                setInputError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleAddRange();
                                }
                            }}
                            error={Boolean(inputError)}
                            helperText={
                                inputError ??
                                "Например: TAA-A34076001-031 или TST124001-005"
                            }
                        />
                        <Button
                            variant="outlined"
                            startIcon={<AddIcon />}
                            onClick={handleAddRange}
                            sx={{ whiteSpace: "nowrap", height: 40 }}
                        >
                            Добавить
                        </Button>
                    </Stack>

                    {ranges.length === 0 ? (
                        <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mb: 2 }}
                        >
                            Пока ничего не добавлено.
                        </Typography>
                    ) : (
                        <TableContainer
                            sx={{
                                border: 1,
                                borderColor: "divider",
                                borderRadius: 1,
                                mb: 2,
                            }}
                        >
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Ввод</TableCell>
                                        <TableCell>Префикс</TableCell>
                                        <TableCell>Скважина</TableCell>
                                        <TableCell align="right">
                                            Диапазон
                                        </TableCell>
                                        <TableCell align="right">
                                            Выбрано / Всего
                                        </TableCell>
                                        <TableCell width={100} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {ranges.map((r) => {
                                        const all = r.allSeqs.length;
                                        const chosen = r.selectedSeqs.length;
                                        const allSelected = chosen === all;
                                        return (
                                            <TableRow key={r.id}>
                                                <TableCell>
                                                    <Typography
                                                        variant="body2"
                                                        sx={{ fontFamily: "monospace" }}
                                                    >
                                                        {r.rawInput}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>{r.prefix}</TableCell>
                                                <TableCell>
                                                    {r.wellName ?? (
                                                        <Chip
                                                            label="текущий"
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    )}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {summarizeSelected(r)}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Chip
                                                        size="small"
                                                        label={`${chosen} / ${all}`}
                                                        color={allSelected ? "primary" : "warning"}
                                                        variant={allSelected ? "filled" : "outlined"}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Stack direction="row" spacing={0.5}>
                                                        <Tooltip title="Редактировать (выбрать/пропустить)">
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
                                                                color="error"
                                                                onClick={() => handleRemoveRange(r.id)}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
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

                    <Stack
                        direction="row"
                        sx={{ justifyContent: "flex-end", alignItems: "center" }}
                    >
                        <Typography variant="body2" color="text.secondary">
                            Выбрано проб: <b>{totalSamples}</b>
                            {totalAll !== totalSamples && (
                                <span> из {totalAll} (пропущено: {totalAll - totalSamples})</span>
                            )}
                        </Typography>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={handleClose}
                        disabled={fillMutation.isPending}
                    >
                        Отмена
                    </Button>
                    <Button
                        onClick={() => void handleSubmit()}
                        variant="contained"
                        disabled={
                            fillMutation.isPending || totalSamples === 0
                        }
                    >
                        {fillMutation.isPending ? "Сохраняем..." : "Сохранить"}
                    </Button>
                </DialogActions>
            </Dialog>

            {editingRange !== null && (
                <RangeEditDialog
                    open={true}
                    series={`${editingRange.prefix}${editingRange.middle}`}
                    sequenceDigits={editingRange.sequenceDigits}
                    allSeqs={editingRange.allSeqs}
                    initialSelectedSeqs={editingRange.selectedSeqs}
                    onClose={() => setEditingRange(null)}
                    onSave={(selected) => {
                        handleSaveRangeEdit(selected);
                        setEditingRange(null);
                    }}
                />
            )}
        </>
    );
}