/**
 * Диалог редактирования тары (пачки 2f-1 + 2f-5c-3).
 *
 * Редактируем всё, что есть в `ContainerSerializer` (кроме QR и
 * локации):
 * - `container_number` — номер тары;
 * - `container_type` — тип тары;
 * - `status` — статус;
 * - `comment` — комментарий;
 * - `draft_site` — участок (draft);
 * - `draft_research_type` — ТИ (draft);
 * - `draft_work_order_coded` — текущий Н/З (draft);
 * - `draft_work_order_incoming` — входящий Н/З (draft).
 *
 * Не редактируем: `qr_code` (генерируется backend),
 * `pallet`/`floor_room` (отдельный сценарий «Разместить»).
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
    CONTAINER_STATUS_LABELS,
    useContainerTypes,
    useResearchTypes,
    useSites,
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
    draftSiteId: number | "";
    draftResearchTypeId: number | "";
    draftWorkOrderCoded: string;
    draftWorkOrderIncoming: string;
}

const ALL_STATUSES: ContainerStatus[] = Object.keys(
    CONTAINER_STATUS_LABELS,
) as ContainerStatus[];

function formFromContainer(container: Container): FormState {
    return {
        containerNumber: container.container_number ?? "",
        containerTypeId: container.container_type,
        status: container.status,
        comment: container.comment ?? "",
        draftSiteId: container.draft_site ?? "",
        draftResearchTypeId: container.draft_research_type ?? "",
        draftWorkOrderCoded: container.draft_work_order_coded ?? "",
        draftWorkOrderIncoming: container.draft_work_order_incoming ?? "",
    };
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

export default function ContainerEditDialog({
    open,
    container,
    onClose,
    onSuccess,
}: ContainerEditDialogProps) {
    const containerTypes = useContainerTypes();
    const researchTypes = useResearchTypes();
    const sites = useSites();
    const updateMutation = useUpdateContainer();

    const [form, setForm] = useState<FormState>({
        containerNumber: "",
        containerTypeId: "",
        status: "ACTIVE",
        comment: "",
        draftSiteId: "",
        draftResearchTypeId: "",
        draftWorkOrderCoded: "",
        draftWorkOrderIncoming: "",
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
                    draft_site:
                        form.draftSiteId === ""
                            ? null
                            : (form.draftSiteId as number),
                    draft_research_type:
                        form.draftResearchTypeId === ""
                            ? null
                            : (form.draftResearchTypeId as number),
                    draft_work_order_coded: form.draftWorkOrderCoded,
                    draft_work_order_incoming: form.draftWorkOrderIncoming,
                },
            });
            onSuccess?.(updated);
            onClose();
        } catch (err) {
            setError(
                extractError(err) ?? "Не удалось сохранить тару.",
            );
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
                    {/* ── Основные поля ──────────────────────── */}
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
                        helperText="Пусто — тара останется без номера."
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
                            {ALL_STATUSES.map((s) => (
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

                    {/* ── Draft-поля (пачка 2f-5c-3) ─────────── */}
                    <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 1 }}
                    >
                        Draft-поля (контекст группы Н/З × ТИ)
                    </Typography>

                    <FormControl fullWidth size="small">
                        <InputLabel id="edit-draft-site-label">
                            Участок
                        </InputLabel>
                        <Select
                            labelId="edit-draft-site-label"
                            label="Участок"
                            value={
                                form.draftSiteId === ""
                                    ? ""
                                    : String(form.draftSiteId)
                            }
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    draftSiteId:
                                        e.target.value === ""
                                            ? ""
                                            : Number(e.target.value),
                                }))
                            }
                        >
                            <MenuItem value="">—</MenuItem>
                            {(sites.data ?? []).map((s) => (
                                <MenuItem
                                    key={s.id}
                                    value={String(s.id)}
                                >
                                    {s.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel id="edit-draft-rt-label">
                            Тип исследования
                        </InputLabel>
                        <Select
                            labelId="edit-draft-rt-label"
                            label="Тип исследования"
                            value={
                                form.draftResearchTypeId === ""
                                    ? ""
                                    : String(form.draftResearchTypeId)
                            }
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    draftResearchTypeId:
                                        e.target.value === ""
                                            ? ""
                                            : Number(e.target.value),
                                }))
                            }
                        >
                            <MenuItem value="">—</MenuItem>
                            {(researchTypes.data ?? []).map((rt) => (
                                <MenuItem
                                    key={rt.id}
                                    value={String(rt.id)}
                                >
                                    {rt.code} — {rt.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Н/З (текущий)"
                        size="small"
                        fullWidth
                        value={form.draftWorkOrderCoded}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                draftWorkOrderCoded: e.target.value,
                            }))
                        }
                        placeholder="TST0001…"
                    />

                    <TextField
                        label="Н/З (входящий)"
                        size="small"
                        fullWidth
                        value={form.draftWorkOrderIncoming}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                draftWorkOrderIncoming: e.target.value,
                            }))
                        }
                        placeholder="02-Тест001…"
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