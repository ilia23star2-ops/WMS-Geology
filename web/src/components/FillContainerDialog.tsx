/**
 * Диалог заполнения тары-заготовки пробами.
 *
 * Сценарий:
 * 1. Открывается кликом по заготовке (container_number = null).
 * 2. Шапка read-only: участок, Н/З, ТИ, тип тары — из draft-полей.
 * 3. Номер тары — обязательное поле (присваивается один раз).
 * 4. Строка ввода проб → parseSampleInput → список добавленных.
 * 5. Сохранение: POST /storage/containers/{id}/fill-samples/.
 *
 * Предпросмотр этикетки и печать — в отдельном заходе (7a-4c-2).
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
    type ParsedSampleRange,
} from "../utils/parseSampleInput";

interface FillContainerDialogProps {
    open: boolean;
    container: Container | null;
    onClose: () => void;
    onSuccess: (totalSamples: number) => void;
}

/**
 * Одна «строка» добавленных проб.
 * Хранит исходный ввод (для отображения) + распарсенный диапазон.
 */
interface AddedRange {
    id: string; // локальный ключ для React
    rawInput: string;
    parsed: ParsedSampleRange;
    numbers: string[];
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

    // Все плоские номера проб, уже добавленные (для проверки дубликатов).
    const existingNumbers = useMemo(() => {
        const set = new Set<string>();
        for (const r of ranges) {
            for (const n of r.numbers) set.add(n);
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
        const numbers = buildSampleNumbers(result.value);

        // Проверка дубликатов (решение — блокировать, вариант Б).
        const dupes = numbers.filter((n) => existingNumbers.has(n));
        if (dupes.length > 0) {
            const preview = dupes.slice(0, 3).join(", ");
            const suffix = dupes.length > 3 ? ` и ещё ${dupes.length - 3}` : "";
            setInputError(`Проба уже добавлена: ${preview}${suffix}`);
            return;
        }

        setRanges((prev) => [
            ...prev,
            {
                id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                rawInput: input.trim(),
                parsed: result.value,
                numbers,
            },
        ]);
        setInput("");
    }

    function handleRemoveRange(id: string) {
        setRanges((prev) => prev.filter((r) => r.id !== id));
    }

    async function handleSubmit() {
        if (!container) return;
        setSubmitError(null);

        const trimmedNumber = containerNumber.trim();
        if (!container.container_number && !trimmedNumber) {
            setSubmitError("Укажите номер тары.");
            return;
        }
        if (ranges.length === 0) {
            setSubmitError("Добавьте хотя бы один диапазон проб.");
            return;
        }

        const sampleGroups: FillSamplesGroup[] = ranges.map((r) => ({
            prefix: r.parsed.prefix,
            middle: r.parsed.middle,
            sequence_from: r.parsed.sequenceFrom,
            sequence_to: r.parsed.sequenceTo,
            sequence_digits: r.parsed.sequenceDigits,
            well_name: r.parsed.wellName,
        }));

        // Н/З и ТИ берём из draft-полей тары.
        const workOrderCoded = container.draft_work_order_coded;
        const researchTypeId = container.draft_research_type;
        const siteId = container.draft_site;

        if (!workOrderCoded) {
            setSubmitError(
                "У заготовки не задан зашифрованный Н/З. Обратитесь к администратору.",
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
            onSuccess(result.total_samples);
            reset();
            onClose();
        } catch {
            setSubmitError(
                "Не удалось заполнить тару. Проверьте данные и попробуйте ещё раз.",
            );
        }
    }

    const totalSamples = useMemo(
        () => ranges.reduce((acc, r) => acc + r.numbers.length, 0),
        [ranges],
    );

    if (!container) return null;

    return (
        <Dialog
            open={open}
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
                                Н/З (тек.)
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
                    value={
                        container.container_number ?? containerNumber
                    }
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
                                        Проб
                                    </TableCell>
                                    <TableCell />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {ranges.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell>
                                            <Typography
                                                variant="body2"
                                                sx={{
                                                    fontFamily: "monospace",
                                                }}
                                            >
                                                {r.rawInput}
                                            </Typography>
                                        </TableCell>
                                        <TableCell>{r.parsed.prefix}</TableCell>
                                        <TableCell>
                                            {r.parsed.wellName ?? (
                                                <Chip
                                                    label="шифр."
                                                    size="small"
                                                    variant="outlined"
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            {String(
                                                r.parsed.sequenceFrom,
                                            ).padStart(
                                                r.parsed.sequenceDigits,
                                                "0",
                                            )}
                                            {" – "}
                                            {String(
                                                r.parsed.sequenceTo,
                                            ).padStart(
                                                r.parsed.sequenceDigits,
                                                "0",
                                            )}
                                        </TableCell>
                                        <TableCell align="right">
                                            {r.numbers.length}
                                        </TableCell>
                                        <TableCell>
                                            <Tooltip title="Удалить">
                                                <IconButton
                                                    size="small"
                                                    onClick={() =>
                                                        handleRemoveRange(
                                                            r.id,
                                                        )
                                                    }
                                                >
                                                    <DeleteIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                <Stack
                    direction="row"
                    sx={{ justifyContent: "flex-end", alignItems: "center" }}
                >
                    <Typography variant="body2" color="text.secondary">
                        Всего проб: <b>{totalSamples}</b>
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
                        fillMutation.isPending || ranges.length === 0
                    }
                >
                    {fillMutation.isPending ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}