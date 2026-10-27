/**
 * Диалог создания / редактирования Наряд-заказа (2f-8b).
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
    WORK_ORDER_STATUS_LABELS,
    WORK_ORDER_TYPE_LABELS,
    useCreateWorkOrder,
    useSites,
    useUpdateWorkOrder,
    type WorkOrder,
    type WorkOrderStatus,
    type WorkOrderType,
} from "../api";

interface WorkOrderDialogProps {
    open: boolean;
    workOrder: WorkOrder | null;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

interface FormState {
    orderNumber: string;
    orderType: WorkOrderType;
    status: WorkOrderStatus;
    siteId: string;
    description: string;
}

const ALL_TYPES: WorkOrderType[] = ["INCOMING", "CODED"];
const ALL_STATUSES: WorkOrderStatus[] = ["ACTIVE", "COMPLETED", "CANCELLED"];

function formFrom(wo: WorkOrder | null): FormState {
    if (!wo) {
        return {
            orderNumber: "",
            orderType: "CODED",
            status: "ACTIVE",
            siteId: "",
            description: "",
        };
    }
    return {
        orderNumber: wo.order_number,
        orderType: wo.order_type,
        status: wo.status,
        siteId: wo.site !== null ? String(wo.site) : "",
        description: wo.description ?? "",
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

export default function WorkOrderDialog({
    open,
    workOrder,
    onClose,
    onSuccess,
}: WorkOrderDialogProps) {
    const [form, setForm] = useState<FormState>(formFrom(null));
    const [error, setError] = useState<string | null>(null);

    const createMutation = useCreateWorkOrder();
    const updateMutation = useUpdateWorkOrder();
    const sites = useSites();

    const isEdit = workOrder !== null;
    const busy = createMutation.isPending || updateMutation.isPending;

    useEffect(() => {
        if (open) {
            setForm(formFrom(workOrder));
            setError(null);
        }
    }, [open, workOrder]);

    const canSave = form.orderNumber.trim().length > 0 && !busy;

    async function handleSave() {
        setError(null);
        const payload = {
            order_number: form.orderNumber.trim(),
            order_type: form.orderType,
            status: form.status,
            site: form.siteId === "" ? null : Number(form.siteId),
            description: form.description,
        };

        try {
            if (isEdit && workOrder) {
                await updateMutation.mutateAsync({ id: workOrder.id, payload });
                onSuccess(`Н/З «${payload.order_number}» сохранён.`);
            } else {
                await createMutation.mutateAsync(payload);
                onSuccess(`Н/З «${payload.order_number}» создан.`);
            }
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось сохранить Н/З.");
        }
    }

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{isEdit ? "Редактировать Н/З" : "Создать Н/З"}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Номер Н/З"
                        size="small"
                        fullWidth
                        required
                        value={form.orderNumber}
                        onChange={(e) => setForm(prev => ({ ...prev, orderNumber: e.target.value }))}
                    />

                    <FormControl fullWidth size="small">
                        <InputLabel>Тип Н/З</InputLabel>
                        <Select
                            label="Тип Н/З"
                            value={form.orderType}
                            onChange={(e) => setForm(prev => ({ ...prev, orderType: e.target.value as WorkOrderType }))}
                        >
                            {ALL_TYPES.map(t => (
                                <MenuItem key={t} value={t}>{WORK_ORDER_TYPE_LABELS[t]}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel>Статус</InputLabel>
                        <Select
                            label="Статус"
                            value={form.status}
                            onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value as WorkOrderStatus }))}
                        >
                            {ALL_STATUSES.map(s => (
                                <MenuItem key={s} value={s}>{WORK_ORDER_STATUS_LABELS[s]}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel>Участок</InputLabel>
                        <Select
                            label="Участок"
                            value={form.siteId}
                            onChange={(e) => setForm(prev => ({ ...prev, siteId: e.target.value }))}
                        >
                            <MenuItem value="">— не указан —</MenuItem>
                            {(sites.data ?? []).map(s => (
                                <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Описание"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={form.description}
                        onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                    />
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Отмена</Button>
                <Button onClick={() => void handleSave()} variant="contained" disabled={!canSave}>
                    {busy ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}