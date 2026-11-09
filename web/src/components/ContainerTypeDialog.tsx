/**
 * Диалог создания/редактирования типа тары (c-2.x-lifecycle-1-ui).
 *
 * Поля: name, laboratory, size_class, max_on_standard_pallet,
 * is_core, is_disposable, description.
 */
import { useEffect, useState } from "react";
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from "@mui/material";

import {
    useCreateContainerType,
    useLaboratories,
    useUpdateContainerType,
    type ContainerType,
} from "../api";

interface ContainerTypeDialogProps {
    open: boolean;
    initial: ContainerType | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

interface FormState {
    name: string;
    laboratoryId: string;
    sizeClass: string;
    maxOnStandardPallet: number;
    isCore: boolean;
    isDisposable: boolean;
    description: string;
}

const EMPTY: FormState = {
    name: "",
    laboratoryId: "",
    sizeClass: "",
    maxOnStandardPallet: 10,
    isCore: false,
    isDisposable: false,
    description: "",
};

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

export default function ContainerTypeDialog({
    open,
    initial,
    onClose,
    onSuccess,
}: ContainerTypeDialogProps) {
    const laboratories = useLaboratories();
    const createMutation = useCreateContainerType();
    const updateMutation = useUpdateContainerType();

    const [form, setForm] = useState<FormState>(EMPTY);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setError(null);
        if (initial) {
            setForm({
                name: initial.name,
                laboratoryId:
                    initial.laboratory === null
                        ? ""
                        : String(initial.laboratory),
                sizeClass: initial.size_class ?? "",
                maxOnStandardPallet: initial.max_on_standard_pallet,
                isCore: initial.is_core,
                isDisposable: initial.is_disposable,
                description: initial.description ?? "",
            });
        } else {
            setForm(EMPTY);
        }
    }, [open, initial]);

    const busy = createMutation.isPending || updateMutation.isPending;
    const canSave = form.name.trim().length > 0 && !busy;

    async function handleSave() {
        setError(null);
        const payload = {
            name: form.name.trim(),
            laboratory:
                form.laboratoryId === ""
                    ? null
                    : Number(form.laboratoryId),
            size_class: form.sizeClass.trim(),
            max_on_standard_pallet: form.maxOnStandardPallet,
            is_core: form.isCore,
            is_disposable: form.isDisposable,
            description: form.description,
        };

        try {
            if (initial) {
                await updateMutation.mutateAsync({
                    id: initial.id,
                    payload,
                });
                onSuccess(`Тип тары «${payload.name}» обновлён.`);
            } else {
                await createMutation.mutateAsync(payload);
                onSuccess(`Тип тары «${payload.name}» создан.`);
            }
            onClose();
        } catch (err) {
            setError(
                extractError(err) ?? "Не удалось сохранить тип тары.",
            );
        }
    }

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                {initial ? "Редактировать тип тары" : "Новый тип тары"}
            </DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
                        {error}
                    </Alert>
                )}
                <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Название *"
                            size="small"
                            fullWidth
                            required
                            value={form.name}
                            onChange={(e) =>
                                setForm((p) => ({ ...p, name: e.target.value }))
                            }
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="ct-lab-label">
                                Лаборатория
                            </InputLabel>
                            <Select
                                labelId="ct-lab-label"
                                label="Лаборатория"
                                value={form.laboratoryId}
                                onChange={(e) =>
                                    setForm((p) => ({
                                        ...p,
                                        laboratoryId: String(e.target.value),
                                    }))
                                }
                            >
                                <MenuItem value="">— общая —</MenuItem>
                                {(laboratories.data ?? []).map((l) => (
                                    <MenuItem key={l.id} value={String(l.id)}>
                                        {l.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Класс размера"
                            size="small"
                            fullWidth
                            value={form.sizeClass}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    sizeClass: e.target.value,
                                }))
                            }
                            placeholder="S / M / L / XL"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Макс. на стандартном поддоне"
                            type="number"
                            size="small"
                            fullWidth
                            value={form.maxOnStandardPallet}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    maxOnStandardPallet:
                                        Number(e.target.value) || 0,
                                }))
                            }
                            slotProps={{ htmlInput: { min: 0 } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <Stack direction="row" spacing={2}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={form.isCore}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                isCore: e.target.checked,
                                            }))
                                        }
                                    />
                                }
                                label="Керновая"
                            />
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={form.isDisposable}
                                        onChange={(e) =>
                                            setForm((p) => ({
                                                ...p,
                                                isDisposable: e.target.checked,
                                            }))
                                        }
                                    />
                                }
                                label="Одноразовая (утилизируется при опустошении)"
                            />
                        </Stack>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Описание"
                            size="small"
                            fullWidth
                            multiline
                            minRows={2}
                            value={form.description}
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    description: e.target.value,
                                }))
                            }
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                >
                    {busy ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
