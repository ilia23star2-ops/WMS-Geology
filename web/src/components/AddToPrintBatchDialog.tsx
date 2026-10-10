/**
 * Диалог добавления тар в партию печати (из реестра тары).
 *
 * Два режима:
 * - Создать новую партию (выбор типа: этикетки / QR-сетка).
 * - Добавить в существующий черновик.
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Typography,
} from "@mui/material";

import {
    PRINT_TYPE_LABELS,
    useAddContainers,
    useCreatePrintBatch,
    usePrintBatches,
    type PrintType,
} from "../api";

type Mode = "new" | "existing";

interface AddToPrintBatchDialogProps {
    open: boolean;
    containerIds: number[];
    onClose: () => void;
    onSuccess: (batchId: number) => void;
}

export default function AddToPrintBatchDialog({
    open,
    containerIds,
    onClose,
    onSuccess,
}: AddToPrintBatchDialogProps) {
    const [mode, setMode] = useState<Mode>("new");
    const [newType, setNewType] = useState<PrintType>("LABELS");
    const [existingBatchId, setExistingBatchId] = useState<number | "">("");
    const [error, setError] = useState<string | null>(null);

    const drafts = usePrintBatches({ page: 1, status: "DRAFT" });
    const draftList = useMemo(
        () => (drafts.data?.results ?? []).filter((b) => b.status === "DRAFT"),
        [drafts.data],
    );

    const createMutation = useCreatePrintBatch();
    // Хук add-containers привязан к конкретной партии. Меняем batchId,
    // пересоздаём два хука — один для новой, второй для существующей.
    // Проще: два независимых хука и вызываем нужный.
    const addToNew = useAddContainers(0);
    const addToExisting = useAddContainers(
        typeof existingBatchId === "number" ? existingBatchId : 0,
    );

    const isSubmitting = createMutation.isPending || addToNew.isPending || addToExisting.isPending;

    function handleClose() {
        if (isSubmitting) return;
        setError(null);
        setMode("new");
        setNewType("LABELS");
        setExistingBatchId("");
        onClose();
    }

    async function handleConfirm() {
        setError(null);
        try {
            if (mode === "new") {
                const batch = await createMutation.mutateAsync(newType);
                await addToNew.mutateAsync(containerIds);
                onSuccess(batch.id);
                handleClose();
            } else {
                if (typeof existingBatchId !== "number") {
                    setError("Выберите партию.");
                    return;
                }
                await addToExisting.mutateAsync(containerIds);
                onSuccess(existingBatchId);
                handleClose();
            }
        } catch {
            setError("Не удалось добавить тары. Возможно, они уже в партии.");
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>В партию печати</DialogTitle>
            <DialogContent>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                    Выбрано тар: <b>{containerIds.length}</b>.
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <FormControl>
                    <FormLabel>Куда добавить</FormLabel>
                    <RadioGroup
                        value={mode}
                        onChange={(e) => setMode(e.target.value as Mode)}
                    >
                        <FormControlLabel
                            value="new"
                            control={<Radio />}
                            label="Создать новую партию"
                        />
                        <FormControlLabel
                            value="existing"
                            control={<Radio />}
                            label="Добавить в существующий черновик"
                            disabled={draftList.length === 0}
                        />
                    </RadioGroup>
                </FormControl>

                {mode === "new" && (
                    <Stack sx={{ mt: 2 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            Что печатать:
                        </Typography>
                        <FormControl>
                            <RadioGroup
                                value={newType}
                                onChange={(e) => setNewType(e.target.value as PrintType)}
                            >
                                <FormControlLabel
                                    value="LABELS"
                                    control={<Radio />}
                                    label={PRINT_TYPE_LABELS.LABELS}
                                />
                                <FormControlLabel
                                    value="QR_ONLY"
                                    control={<Radio />}
                                    label={PRINT_TYPE_LABELS.QR_ONLY}
                                />
                            </RadioGroup>
                        </FormControl>
                    </Stack>
                )}

                {mode === "existing" && (
                    <Stack sx={{ mt: 2 }}>
                        <Typography variant="body1" sx={{ mb: 1 }}>
                            Партия:
                        </Typography>
                        <Select
                            value={existingBatchId}
                            onChange={(e) => setExistingBatchId(Number(e.target.value))}
                            size="small"
                            fullWidth
                        >
                            {draftList.map((b) => (
                                <MenuItem key={b.id} value={b.id}>
                                    {b.batch_number} — {PRINT_TYPE_LABELS[b.print_type]} (тар:{" "}
                                    {b.total_items})
                                </MenuItem>
                            ))}
                        </Select>
                    </Stack>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isSubmitting}>
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleConfirm()}
                    variant="contained"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Добавляем..." : "Добавить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}