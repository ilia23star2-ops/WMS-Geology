/**
 * Диалог связывания Н/З (INCOMING ↔ CODED).
 *
 * Два режима:
 * - выбрать существующий из списка (с фильтром по номеру);
 * - создать новый с указанным номером и сразу связать.
 */
import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

import {
    WORK_ORDER_TYPE_LABELS,
    useCreateWorkOrder,
    useLinkWorkOrder,
    useWorkOrders,
    type WorkOrder,
} from "../api";

interface LinkWorkOrderDialogProps {
    open: boolean;
    workOrder: WorkOrder | null;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

type Mode = "existing" | "new";

export default function LinkWorkOrderDialog({
    open,
    workOrder,
    onClose,
    onSuccess,
}: LinkWorkOrderDialogProps) {
    const [mode, setMode] = useState<Mode>("existing");
    const [selectedId, setSelectedId] = useState<string>("");
    const [newNumber, setNewNumber] = useState("");
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);

    const linkMutation = useLinkWorkOrder();
    const createMutation = useCreateWorkOrder();

    const oppositeType = workOrder?.order_type === "INCOMING" ? "CODED" : "INCOMING";
    const { data, isLoading } = useWorkOrders({
        page: 1,
        order_type: oppositeType,
        order_number: search.trim() || undefined,
    });

    const busy = linkMutation.isPending || createMutation.isPending;

    useEffect(() => {
        if (open) {
            setMode("existing");
            setSelectedId("");
            setNewNumber("");
            setSearch("");
            setError(null);
        }
    }, [open]);

    async function handleLink() {
        if (!workOrder) return;
        setError(null);

        try {
            let linkedId: number;

            if (mode === "existing") {
                if (!selectedId) {
                    setError("Выберите Н/З из списка.");
                    return;
                }
                linkedId = Number(selectedId);
            } else {
                const num = newNumber.trim();
                if (!num) {
                    setError("Введите номер Н/З.");
                    return;
                }
                const created = await createMutation.mutateAsync({
                    order_number: num,
                    order_type: oppositeType,
                });
                linkedId = created.id;
            }

            await linkMutation.mutateAsync({
                id: workOrder.id,
                linkedId,
            });
            onSuccess("Н/З успешно связаны.");
            onClose();
        } catch (err) {
            const anyErr = err as {
                response?: {
                    data?: {
                        error?: string;
                        detail?: string;
                        linked_order?: string[];
                    };
                };
            };
            const dataObj = anyErr?.response?.data;
            let msg = dataObj?.error ?? dataObj?.detail;
            if (!msg && dataObj?.linked_order) {
                msg = dataObj.linked_order.join(" ");
            }
            setError(msg ?? "Не удалось связать Н/З.");
        }
    }

    if (!open || !workOrder) return null;

    return (
        <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Связать Н/З</DialogTitle>
            <DialogContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Текущий Н/З: <b>{workOrder.order_number}</b> (
                    {WORK_ORDER_TYPE_LABELS[workOrder.order_type]})
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Box sx={{ mb: 2 }}>
                    <FormControl>
                        <FormLabel>Действие</FormLabel>
                        <RadioGroup
                            row
                            value={mode}
                            onChange={(e) => setMode(e.target.value as Mode)}
                        >
                            <FormControlLabel
                                value="existing"
                                control={<Radio />}
                                label="Выбрать существующий"
                            />
                            <FormControlLabel
                                value="new"
                                control={<Radio />}
                                label="Создать новый"
                            />
                        </RadioGroup>
                    </FormControl>
                </Box>

                <Stack spacing={2}>
                    {mode === "existing" && (
                        <>
                            <TextField
                                label="Поиск по номеру"
                                size="small"
                                fullWidth
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Введите номер Н/З…"
                                helperText="Фильтр по части номера."
                            />

                            <FormControl fullWidth size="small">
                                <InputLabel>
                                    Связать с ({WORK_ORDER_TYPE_LABELS[oppositeType]})
                                </InputLabel>
                                <Select
                                    label={`Связать с (${WORK_ORDER_TYPE_LABELS[oppositeType]})`}
                                    value={selectedId}
                                    onChange={(e) => setSelectedId(e.target.value)}
                                    disabled={isLoading}
                                >
                                    {(data?.results ?? []).map((wo) => (
                                        <MenuItem key={wo.id} value={String(wo.id)}>
                                            {wo.order_number}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {!isLoading && (data?.results ?? []).length === 0 && (
                                <Alert severity="info">
                                    По фильтру ничего не найдено. Можно переключиться на
                                    «Создать новый».
                                </Alert>
                            )}
                        </>
                    )}

                    {mode === "new" && (
                        <TextField
                            label={`Новый Н/З (${WORK_ORDER_TYPE_LABELS[oppositeType]})`}
                            size="small"
                            fullWidth
                            required
                            value={newNumber}
                            onChange={(e) => setNewNumber(e.target.value)}
                            placeholder={
                                oppositeType === "INCOMING"
                                    ? "02-Тест001"
                                    : "Sev00544"
                            }
                            helperText="Если такого Н/З ещё нет — он будет создан и связан с текущим."
                        />
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Отмена</Button>
                <Button
                    variant="contained"
                    onClick={() => void handleLink()}
                    disabled={busy}
                >
                    {busy
                        ? "Связываем..."
                        : mode === "new"
                            ? "Создать и связать"
                            : "Связать"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}