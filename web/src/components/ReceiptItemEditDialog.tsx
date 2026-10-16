/**
 * Диалог редактирования строки приёмки (пачка 2f-5a-2).
 *
 * Редактируем: `expected_container_number`, `expected_samples_count`,
 * `status`, `note`.
 * Read-only: номер партии, Н/З, ТИ, участок, тара.
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
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

import {
    RECEIPT_ITEM_STATUS_LABELS,
    useUpdateReceiptItem,
    type ReceiptItem,
    type ReceiptItemStatus,
} from "../api";

interface ReceiptItemEditDialogProps {
    open: boolean;
    item: ReceiptItem | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

interface FormState {
    expectedContainerNumber: string;
    expectedSamplesCount: string;
    status: ReceiptItemStatus;
    note: string;
}

const ALL_STATUSES: ReceiptItemStatus[] = Object.keys(
    RECEIPT_ITEM_STATUS_LABELS,
) as ReceiptItemStatus[];

function extractError(err: unknown): string | null {
    const anyErr = err as {
        response?: { data?: { error?: string; detail?: string } };
    };
    return (
        anyErr?.response?.data?.error
        ?? anyErr?.response?.data?.detail
        ?? null
    );
}

function formFrom(item: ReceiptItem | null): FormState {
    if (!item) {
        return {
            expectedContainerNumber: "",
            expectedSamplesCount: "",
            status: "EXPECTED",
            note: "",
        };
    }
    return {
        expectedContainerNumber: item.expected_container_number ?? "",
        expectedSamplesCount:
            item.expected_samples_count !== null
                && item.expected_samples_count !== undefined
                ? String(item.expected_samples_count)
                : "",
        status: item.status,
        note: item.note ?? "",
    };
}

export default function ReceiptItemEditDialog({
    open,
    item,
    onClose,
    onSuccess,
}: ReceiptItemEditDialogProps) {
    const updateMutation = useUpdateReceiptItem();
    const [form, setForm] = useState<FormState>(formFrom(null));
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm(formFrom(item));
            setError(null);
        }
    }, [open, item]);

    const busy = updateMutation.isPending;

    async function handleSave() {
        if (!item) return;
        setError(null);
        const count = form.expectedSamplesCount.trim();
        try {
            await updateMutation.mutateAsync({
                id: item.id,
                payload: {
                    expected_container_number: form.expectedContainerNumber,
                    expected_samples_count:
                        count === "" ? null : Number(count),
                    status: form.status,
                    note: form.note,
                },
            });
            onSuccess("Строка сохранена.");
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось сохранить строку.");
        }
    }

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>Редактировать строку</DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {item && (
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: "block", mb: 2 }}
                    >
                        Н/З: {item.expected_work_order_number || "—"} ·
                        ТИ: {item.expected_research_type_code || "—"} ·
                        Участок: {item.expected_site_code || "—"} ·
                        Тара: {item.container_number ?? "—"}
                    </Typography>
                )}

                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Ожидаемый номер тары"
                        size="small"
                        fullWidth
                        value={form.expectedContainerNumber}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                expectedContainerNumber: e.target.value,
                            }))
                        }
                    />

                    <TextField
                        label="Ожидаемое количество проб"
                        size="small"
                        type="number"
                        fullWidth
                        value={form.expectedSamplesCount}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                expectedSamplesCount: e.target.value,
                            }))
                        }
                    />

                    <FormControl fullWidth size="small">
                        <InputLabel id="ri-status-label">Статус</InputLabel>
                        <Select
                            labelId="ri-status-label"
                            label="Статус"
                            value={form.status}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    status: e.target.value as ReceiptItemStatus,
                                }))
                            }
                        >
                            {ALL_STATUSES.map((s) => (
                                <MenuItem key={s} value={s}>
                                    {RECEIPT_ITEM_STATUS_LABELS[s]}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Примечание"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={form.note}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                note: e.target.value,
                            }))
                        }
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={busy || !item}
                >
                    {busy ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}