/**
 * Диалог создания рейса (OUTBOUND).
 *
 * Автогенерация shipment_number на бэкенде, если поле пустое.
 * c-2.x-shipments-1b.
 */
import { useState } from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from "@mui/material";

import {
    useCreateShipment,
    useLaboratories,
    type Shipment,
} from "../api";

interface CreateShipmentDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (shipment: Shipment) => void;
}

export default function CreateShipmentDialog({
    open,
    onClose,
    onSuccess,
}: CreateShipmentDialogProps) {
    const [name, setName] = useState("");
    const [shipmentNumber, setShipmentNumber] = useState("");
    const [shipmentDate, setShipmentDate] = useState("");
    const [laboratoryId, setLaboratoryId] = useState<string>("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);

    const laboratories = useLaboratories();
    const createMutation = useCreateShipment();

    function reset() {
        setName("");
        setShipmentNumber("");
        setShipmentDate("");
        setLaboratoryId("");
        setNote("");
        setError(null);
    }

    function handleClose() {
        if (createMutation.isPending) return;
        reset();
        onClose();
    }

    async function handleSubmit() {
        setError(null);
        try {
            const result = await createMutation.mutateAsync({
                name: name.trim() || undefined,
                direction: "OUTBOUND",
                shipment_number: shipmentNumber.trim() || undefined,
                shipment_date: shipmentDate || null,
                laboratory:
                    laboratoryId === "" ? null : Number(laboratoryId),
                note: note.trim() || undefined,
            });
            onSuccess(result);
            reset();
            onClose();
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { error?: string; detail?: string } };
            };
            setError(
                anyErr?.response?.data?.error
                ?? anyErr?.response?.data?.detail
                ?? "Не удалось создать рейс.",
            );
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Новый рейс (отправка)</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
                        {error}
                    </Alert>
                )}
                <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Название (опционально)"
                            size="small"
                            fullWidth
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            helperText="Например: Ноябрь 1"
                        />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Номер рейса"
                            size="small"
                            fullWidth
                            value={shipmentNumber}
                            onChange={(e) => setShipmentNumber(e.target.value)}
                            helperText="Оставьте пустым для авто-генерации (ОТ-YYYY-NNN)"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Дата отправки"
                            type="date"
                            size="small"
                            fullWidth
                            value={shipmentDate}
                            onChange={(e) => setShipmentDate(e.target.value)}
                            slotProps={{ inputLabel: { shrink: true } }}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="create-lab-label">
                                Куда (лаборатория)
                            </InputLabel>
                            <Select
                                labelId="create-lab-label"
                                label="Куда (лаборатория)"
                                value={laboratoryId}
                                onChange={(e) =>
                                    setLaboratoryId(String(e.target.value))
                                }
                            >
                                <MenuItem value="">— не указана —</MenuItem>
                                {(laboratories.data ?? []).map((l) => (
                                    <MenuItem key={l.id} value={String(l.id)}>
                                        {l.name} ({l.code})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Примечание"
                            size="small"
                            fullWidth
                            multiline
                            minRows={2}
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={createMutation.isPending}>
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleSubmit()}
                    variant="contained"
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending ? "Создаём..." : "Создать"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}