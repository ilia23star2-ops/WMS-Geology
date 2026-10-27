/**
 * Диалог добавления тар в партию печати.
 *
 * Режимы:
 * - Новая партия: создаёт через `POST /labels/print-batches/` + добавляет тары.
 * - Существующая (DRAFT): выбирает из доступных черновиков + добавляет тары.
 *
 * 2f-17c-fix: после успешного добавления инвалидируем кэши
 * `containers` / `container` / `container-history` — иначе иконка
 * принтера в реестре не обновляется (print_batch_status stale).
 */
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormHelperText,
    FormLabel,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

import {
    apiClient,
    useCreatePrintBatch,
    usePrintBatches,
    type PrintType,
} from "../api";

interface AddToPrintBatchDialogProps {
    open: boolean;
    containerIds: number[];
    onClose: () => void;
    onSuccess: (batchId: number) => void;
}

type Mode = "new" | "existing";

export default function AddToPrintBatchDialog({
    open,
    containerIds,
    onClose,
    onSuccess,
}: AddToPrintBatchDialogProps) {
    const queryClient = useQueryClient();
    const [mode, setMode] = useState<Mode>("new");
    const [type, setType] = useState<PrintType>("LABELS");
    const [existingBatchId, setExistingBatchId] = useState<number | "">("");
    const [error, setError] = useState<string | null>(null);

    const createMutation = useCreatePrintBatch();
    const draftBatches = usePrintBatches({ page: 1, status: "DRAFT" });

    const draftList = useMemo(() => draftBatches.data?.results ?? [], [draftBatches.data]);

    useEffect(() => {
        if (!open) {
            setError(null);
            setType("LABELS");
            setMode("new");
            setExistingBatchId("");
        }
    }, [open]);

    function invalidateAfterAdd(batchId: number) {
        // Список тары — иконки печати
        void queryClient.invalidateQueries({ queryKey: ["containers"] });
        // Одиночные тары — если открыт ContainerDetailDialog
        void queryClient.invalidateQueries({ queryKey: ["container"] });
        // История — новое событие может появиться (FILL/PLACE не пишутся при add, но на всякий)
        void queryClient.invalidateQueries({ queryKey: ["container-history"] });
        // Партии печати — список DRAFT и текущая деталь
        void queryClient.invalidateQueries({ queryKey: ["print-batches"] });
        void queryClient.invalidateQueries({ queryKey: ["print-batch", batchId] });
    }

    async function handleSubmit(force = false) {
        setError(null);

        if (mode === "existing" && existingBatchId === "") {
            setError("Выберите существующую партию.");
            return;
        }

        try {
            let batchId: number;
            if (mode === "new") {
                const batch = await createMutation.mutateAsync(type);
                batchId = batch.id;
            } else {
                batchId = Number(existingBatchId);
            }

            await apiClient.post(
                `/labels/print-batches/${batchId}/add-containers/`,
                { container_ids: containerIds, force },
            );

            invalidateAfterAdd(batchId);
            onSuccess(batchId);
            onClose();
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { error?: string; printed_container_ids?: number[] } };
            };
            const printed = anyErr?.response?.data?.printed_container_ids;

            if (printed && printed.length > 0 && !force) {
                const ok = window.confirm(
                    `У некоторых выбранных тар (${printed.length}) этикетки уже печатались. Вы уверены, что хотите перепечатать их?`
                );
                if (ok) {
                    await handleSubmit(true);
                    return;
                }
            }
            setError(
                anyErr?.response?.data?.error ?? "Не удалось добавить тары в партию."
            );
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Добавить в партию печати</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <FormControl sx={{ mb: 2 }}>
                    <FormLabel>Куда добавить</FormLabel>
                    <RadioGroup
                        value={mode}
                        onChange={(e) => setMode(e.target.value as Mode)}
                    >
                        <FormControlLabel value="new" control={<Radio />} label="Новая партия" />
                        <FormControlLabel
                            value="existing"
                            control={<Radio />}
                            label="Существующая (DRAFT)"
                        />
                    </RadioGroup>
                </FormControl>

                {mode === "new" && (
                    <FormControl>
                        <FormLabel>Что печатать</FormLabel>
                        <RadioGroup
                            value={type}
                            onChange={(e) => setType(e.target.value as PrintType)}
                        >
                            <FormControlLabel
                                value="LABELS"
                                control={<Radio />}
                                label="Этикетки (адаптивный размер)"
                            />
                            <FormControlLabel
                                value="QR_ONLY"
                                control={<Radio />}
                                label="Только QR (сетка 8×11)"
                            />
                        </RadioGroup>
                    </FormControl>
                )}

                {mode === "existing" && (
                    <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                        <InputLabel>Партия</InputLabel>
                        <Select
                            label="Партия"
                            value={existingBatchId}
                            onChange={(e) => setExistingBatchId(e.target.value as number)}
                            disabled={draftBatches.isLoading}
                        >
                            {draftList.length === 0 && (
                                <MenuItem value="" disabled>
                                    Нет доступных черновиков
                                </MenuItem>
                            )}
                            {draftList.map((b) => (
                                <MenuItem key={b.id} value={b.id}>
                                    {b.batch_number} — {b.name || b.print_type_display} ({b.total_items} тар)
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>
                            Доступны только партии в статусе «Черновик».
                        </FormHelperText>
                    </FormControl>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={createMutation.isPending}>
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleSubmit(false)}
                    variant="contained"
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending
                        ? "Сохраняем..."
                        : mode === "new"
                            ? "Создать и добавить"
                            : "Добавить в партию"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}