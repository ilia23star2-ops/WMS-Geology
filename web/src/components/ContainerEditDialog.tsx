/**
 * Диалог редактирования тары (пачка 2f-1).
 *
 * Редактируем всё, что есть в `ContainerSerializer`:
 * `container_number`, `container_type`, `status`, `comment`.
 * Остальные поля (pallet/floor_room/position) — из других экранов.
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
} from "@mui/material";

import {
    CONTAINER_STATUS_LABELS,
    useContainerTypes,
    useUpdateContainer,
    type Container,
    type ContainerStatus,
} from "../api";

interface ContainerEditDialogProps {
    open: boolean;
    container: Container | null;
    onClose: () => void;
    onSuccess?: (container: Container) => void;
}

interface FormState {
    containerNumber: string;
    containerTypeId: number | "";
    status: ContainerStatus;
    comment: string;
}

function formFromContainer(container: Container): FormState {
    return {
        containerNumber: container.container_number ?? "",
        containerTypeId: container.container_type,
        status: container.status,
        comment: container.comment ?? "",
    };
}

export default function ContainerEditDialog({
    open,
    container,
    onClose,
    onSuccess,
}: ContainerEditDialogProps) {
    const containerTypes = useContainerTypes();
    const updateMutation = useUpdateContainer();

    const [form, setForm] = useState<FormState>({
        containerNumber: "",
        containerTypeId: "",
        status: "ACTIVE",
        comment: "",
    });
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open && container) {
            setForm(formFromContainer(container));
            setError(null);
        }
    }, [open, container]);

    const canSave =
        form.containerTypeId !== "" && !updateMutation.isPending;

    async function handleSave() {
        if (!container) return;
        setError(null);
        try {
            const updated = await updateMutation.mutateAsync({
                id: container.id,
                payload: {
                    container_number:
                        form.containerNumber.trim() || null,
                    container_type: form.containerTypeId as number,
                    status: form.status,
                    comment: form.comment,
                },
            });
            onSuccess?.(updated);
            onClose();
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { error?: string; detail?: string } };
            };
            const msg =
                anyErr?.response?.data?.error
                ?? anyErr?.response?.data?.detail
                ?? "Не удалось сохранить тару.";
            setError(msg);
        }
    }

    return (
        <Dialog
            open={open}
            onClose={updateMutation.isPending ? undefined : onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                Редактировать тару
                {container?.id ? ` #${container.id}` : ""}
            </DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Номер тары"
                        size="small"
                        fullWidth
                        value={form.containerNumber}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                containerNumber: e.target.value,
                            }))
                        }
                        helperText="Пусто — тара останется без номера (заготовка)."
                    />

                    <FormControl fullWidth size="small">
                        <InputLabel id="edit-type-label">
                            Тип тары
                        </InputLabel>
                        <Select
                            labelId="edit-type-label"
                            label="Тип тары"
                            value={
                                form.containerTypeId === ""
                                    ? ""
                                    : String(form.containerTypeId)
                            }
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    containerTypeId:
                                        e.target.value === ""
                                            ? ""
                                            : Number(e.target.value),
                                }))
                            }
                        >
                            {(containerTypes.data ?? []).map((t) => (
                                <MenuItem
                                    key={t.id}
                                    value={String(t.id)}
                                >
                                    {t.name}
                                    {t.laboratory_name
                                        ? ` (${t.laboratory_name})`
                                        : ""}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel id="edit-status-label">
                            Статус
                        </InputLabel>
                        <Select
                            labelId="edit-status-label"
                            label="Статус"
                            value={form.status}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    status: e.target.value as ContainerStatus,
                                }))
                            }
                        >
                            {(
                                Object.keys(
                                    CONTAINER_STATUS_LABELS,
                                ) as ContainerStatus[]
                            ).map((s) => (
                                <MenuItem key={s} value={s}>
                                    {CONTAINER_STATUS_LABELS[s]}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Комментарий"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={form.comment}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                comment: e.target.value,
                            }))
                        }
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button
                    onClick={onClose}
                    disabled={updateMutation.isPending}
                >
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                >
                    {updateMutation.isPending ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}