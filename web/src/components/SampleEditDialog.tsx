/**
 * Диалог редактирования пробы + действия (пачка 2f-2b).
 *
 * Редактируем: `sample_number`, `research_type`, `site`, `status`.
 * Read-only: `container`, `current_work_order`, `current_location`.
 *
 * Действия:
 * - «Утилизировать» → под-диалог с причиной → `POST /samples/{id}/dispose/`.
 * - «Вернуть из утилизации» → `POST /samples/{id}/restore/`.
 * - «Удалить» → `DELETE /samples/{id}/` (hard, с confirm).
 */
import { useEffect, useState } from "react";
import {
    Alert,
    Button,
    CircularProgress,
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
    SAMPLE_STATUS_LABELS,
    useDeleteSample,
    useDisposeSample,
    useResearchTypes,
    useRestoreSample,
    useSample,
    useSites,
    useUpdateSample,
    type SampleStatus,
} from "../api";

interface SampleEditDialogProps {
    open: boolean;
    sampleId: number | null;
    onClose: () => void;
}

interface FormState {
    sampleNumber: string;
    researchTypeId: number | "";
    siteId: number | null;
    status: SampleStatus;
}

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

const ALL_STATUSES: SampleStatus[] = Object.keys(
    SAMPLE_STATUS_LABELS,
) as SampleStatus[];

export default function SampleEditDialog({
    open,
    sampleId,
    onClose,
}: SampleEditDialogProps) {
    const { data: sample, isLoading } = useSample(open ? sampleId : null);
    const researchTypes = useResearchTypes();
    const sites = useSites();

    const updateMutation = useUpdateSample();
    const deleteMutation = useDeleteSample();
    const disposeMutation = useDisposeSample();
    const restoreMutation = useRestoreSample();

    const [form, setForm] = useState<FormState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [disposeOpen, setDisposeOpen] = useState(false);
    const [disposeReason, setDisposeReason] = useState("");

    useEffect(() => {
        if (open && sample) {
            setForm({
                sampleNumber: sample.sample_number,
                researchTypeId: sample.research_type,
                siteId: sample.site,
                status: sample.status,
            });
            setError(null);
        }
        if (!open) {
            setForm(null);
            setDisposeOpen(false);
            setDisposeReason("");
            setError(null);
        }
    }, [open, sample]);

    const busy =
        updateMutation.isPending
        || deleteMutation.isPending
        || disposeMutation.isPending
        || restoreMutation.isPending;

    async function handleSave() {
        if (!sample || !form) return;
        setError(null);
        try {
            await updateMutation.mutateAsync({
                id: sample.id,
                payload: {
                    sample_number: form.sampleNumber.trim(),
                    research_type: form.researchTypeId as number,
                    site: form.siteId,
                    status: form.status,
                },
            });
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось сохранить пробу.");
        }
    }

    async function handleDelete() {
        if (!sample) return;
        const label = sample.sample_number;
        const ok = window.confirm(
            `Удалить пробу ${label}? Действие необратимо.`,
        );
        if (!ok) return;
        setError(null);
        try {
            await deleteMutation.mutateAsync(sample.id);
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось удалить пробу.");
        }
    }

    async function handleRestore() {
        if (!sample) return;
        setError(null);
        try {
            await restoreMutation.mutateAsync(sample.id);
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось вернуть пробу.");
        }
    }

    async function handleDispose() {
        if (!sample) return;
        setError(null);
        try {
            await disposeMutation.mutateAsync({
                id: sample.id,
                reason: disposeReason,
            });
            setDisposeOpen(false);
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось утилизировать пробу.");
        }
    }

    const isDisposed = sample?.status === "DISPOSED";
    const canSave =
        form !== null
        && form.sampleNumber.trim().length > 0
        && form.researchTypeId !== ""
        && !busy;

    return (
        <>
            <Dialog
                open={open}
                onClose={busy ? undefined : onClose}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Проба{" "}
                    {sample?.sample_number
                        ? `«${sample.sample_number}»`
                        : `#${sampleId ?? ""}`}
                </DialogTitle>

                <DialogContent>
                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {isLoading || !sample ? (
                        <Stack
                            sx={{
                                alignItems: "center",
                                py: 4,
                            }}
                        >
                            <CircularProgress size={24} />
                        </Stack>
                    ) : (
                        <Stack spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                Тара: {sample.container_number ?? `#${sample.container}`} ·
                                {" "}Н/З: {sample.current_work_order_number ?? "—"} ·
                                {" "}Место: {sample.current_location ?? "—"}
                            </Typography>

                            <TextField
                                label="Номер пробы"
                                size="small"
                                fullWidth
                                value={form?.sampleNumber ?? ""}
                                onChange={(e) =>
                                    setForm((prev) => prev && ({
                                        ...prev,
                                        sampleNumber: e.target.value,
                                    }))
                                }
                            />

                            <FormControl fullWidth size="small">
                                <InputLabel id="rt-label">
                                    Тип исследования
                                </InputLabel>
                                <Select
                                    labelId="rt-label"
                                    label="Тип исследования"
                                    value={
                                        form?.researchTypeId === ""
                                            ? ""
                                            : String(form?.researchTypeId ?? "")
                                    }
                                    onChange={(e) =>
                                        setForm((prev) => prev && ({
                                            ...prev,
                                            researchTypeId: Number(e.target.value),
                                        }))
                                    }
                                >
                                    {(researchTypes.data ?? []).map((rt) => (
                                        <MenuItem key={rt.id} value={String(rt.id)}>
                                            {rt.code} — {rt.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth size="small">
                                <InputLabel id="site-label">Участок</InputLabel>
                                <Select
                                    labelId="site-label"
                                    label="Участок"
                                    value={
                                        form?.siteId !== null
                                            && form?.siteId !== undefined
                                            ? String(form.siteId)
                                            : ""
                                    }
                                    onChange={(e) =>
                                        setForm((prev) => prev && ({
                                            ...prev,
                                            siteId:
                                                e.target.value === ""
                                                    ? null
                                                    : Number(e.target.value),
                                        }))
                                    }
                                >
                                    <MenuItem value="">—</MenuItem>
                                    {(sites.data ?? []).map((s) => (
                                        <MenuItem key={s.id} value={String(s.id)}>
                                            {s.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth size="small">
                                <InputLabel id="status-label">Статус</InputLabel>
                                <Select
                                    labelId="status-label"
                                    label="Статус"
                                    value={form?.status ?? "IN_STORAGE"}
                                    onChange={(e) =>
                                        setForm((prev) => prev && ({
                                            ...prev,
                                            status: e.target.value as SampleStatus,
                                        }))
                                    }
                                >
                                    {ALL_STATUSES.map((s) => (
                                        <MenuItem key={s} value={s}>
                                            {SAMPLE_STATUS_LABELS[s]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {isDisposed && sample.disposal_reason && (
                                <Typography variant="body2" color="text.secondary">
                                    Причина утилизации: <b>{sample.disposal_reason}</b>
                                </Typography>
                            )}

                            {sample.disposed_at && (
                                <Typography variant="caption" color="text.secondary">
                                    Утилизирована:{" "}
                                    {new Date(sample.disposed_at).toLocaleString("ru-RU")}
                                </Typography>
                            )}

                            {!isDisposed && (
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    onClick={() => setDisposeOpen(true)}
                                    disabled={busy}
                                >
                                    Утилизировать
                                </Button>
                            )}

                            {isDisposed && (
                                <Button
                                    variant="outlined"
                                    color="success"
                                    onClick={() => void handleRestore()}
                                    disabled={busy}
                                >
                                    Вернуть из утилизации
                                </Button>
                            )}

                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => void handleDelete()}
                                disabled={busy}
                            >
                                Удалить пробу
                            </Button>
                        </Stack>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={onClose} disabled={busy}>
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleSave()}
                        disabled={!canSave || isLoading}
                    >
                        {updateMutation.isPending ? "Сохраняем..." : "Сохранить"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Под-диалог причины утилизации */}
            <Dialog
                open={disposeOpen}
                onClose={disposeMutation.isPending ? undefined : () => setDisposeOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Утилизировать пробу?</DialogTitle>
                <DialogContent>
                    <TextField
                        label="Причина утилизации (необязательно)"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={disposeReason}
                        onChange={(e) => setDisposeReason(e.target.value)}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDisposeOpen(false)}
                        disabled={disposeMutation.isPending}
                    >
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        color="warning"
                        onClick={() => void handleDispose()}
                        disabled={disposeMutation.isPending}
                    >
                        {disposeMutation.isPending ? "Утилизируем..." : "Утилизировать"}
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}