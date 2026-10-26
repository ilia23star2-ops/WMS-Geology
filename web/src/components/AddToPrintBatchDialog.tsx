/**
 * Диалог создания партии печати и добавления в неё выбранных тар.
 */
import { useEffect, useState } from "react";
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
    Radio,
    RadioGroup,
} from "@mui/material";

import {
    apiClient,
    useCreatePrintBatch,
    type PrintType,
} from "../api";

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
    const [type, setType] = useState<PrintType>("LABELS");
    const [error, setError] = useState<string | null>(null);

    const createMutation = useCreatePrintBatch();

    useEffect(() => {
        if (!open) {
            setError(null);
            setType("LABELS");
        }
    }, [open]);

    async function handleCreateAndAdd(force = false) {
        setError(null);
        try {
            // 1. Создаём партию
            const batch = await createMutation.mutateAsync(type);

            // 2. Добавляем тары
            await apiClient.post(
                `/labels/print-batches/${batch.id}/add-containers/`,
                { container_ids: containerIds, force }
            );

            onSuccess(batch.id);
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
                    await handleCreateAndAdd(true);
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
            <DialogTitle>Новая партия печати</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}
                <FormControl sx={{ mt: 1 }}>
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
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={createMutation.isPending}>
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleCreateAndAdd(false)}
                    variant="contained"
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending ? "Создаём..." : "Создать и добавить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}