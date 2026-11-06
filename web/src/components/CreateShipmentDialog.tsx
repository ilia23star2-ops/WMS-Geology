/**
 * Диалог создания рейса (OUTBOUND).
 *
 * «Откуда» / «Куда» — Autocomplete (freeSolo). Если ввести несуществующее
 * имя, оно создаётся в справочнике «Лаборатории» при нажатии «Создать».
 *
 * c-2.x-shipments-1b, c-2.x-shipments-2-fix, c-2.x-shipments-2-fix-2,
 * c-2.x-shipments-2-fix-2b (inputValue вместо value — freeSolo работает).
 */
import { useState } from "react";
import {
    Alert,
    Autocomplete,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Grid,
    TextField,
} from "@mui/material";

import {
    useCreateCatalog,
    useCreateShipment,
    useLaboratories,
    type Laboratory,
    type Shipment,
} from "../api";

interface CreateShipmentDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (shipment: Shipment) => void;
}

function generateLabCode(name: string): string {
    const cleaned = name.toUpperCase().replace(/[^А-ЯЁA-Z0-9]/g, "");
    if (cleaned.length >= 2) return cleaned.slice(0, 50);
    return `ОРГ-${Date.now().toString(36).toUpperCase()}`;
}

export default function CreateShipmentDialog({
    open,
    onClose,
    onSuccess,
}: CreateShipmentDialogProps) {
    const [name, setName] = useState("");
    const [shipmentNumber, setShipmentNumber] = useState("");
    const [shipmentDate, setShipmentDate] = useState("");
    const [originInput, setOriginInput] = useState("");
    const [destInput, setDestInput] = useState("");
    const [note, setNote] = useState("");
    const [error, setError] = useState<string | null>(null);

    const laboratories = useLaboratories();
    const createMutation = useCreateShipment();
    const createLabMutation = useCreateCatalog("laboratories");

    function reset() {
        setName("");
        setShipmentNumber("");
        setShipmentDate("");
        setOriginInput("");
        setDestInput("");
        setNote("");
        setError(null);
    }

    function handleClose() {
        if (createMutation.isPending || createLabMutation.isPending) return;
        reset();
        onClose();
    }

    /**
     * Строка → ID лаборатории.
     * Если в справочнике есть (по имени) — берём её id.
     * Если нет — создаём новую.
     */
    async function resolveLab(value: string): Promise<number | null> {
        const trimmed = value.trim();
        if (!trimmed) return null;

        const existing = (laboratories.data ?? []).find(
            (l) => l.name.trim().toLowerCase() === trimmed.toLowerCase(),
        );
        if (existing) return existing.id;

        const created = (await createLabMutation.mutateAsync({
            code: generateLabCode(trimmed),
            name: trimmed,
            description: "",
            sort_order: 100,
            is_active: true,
            prefixes: [],
        })) as Laboratory;
        return created.id;
    }

    async function handleSubmit() {
        setError(null);
        try {
            const originId = await resolveLab(originInput);
            const destId = await resolveLab(destInput);

            const result = await createMutation.mutateAsync({
                name: name.trim() || undefined,
                direction: "OUTBOUND",
                shipment_number: shipmentNumber.trim() || undefined,
                shipment_date: shipmentDate || null,
                origin_laboratory: originId,
                laboratory: destId,
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
                ?? "Не удалось создать рейс или организацию.",
            );
        }
    }

    const busy = createMutation.isPending || createLabMutation.isPending;

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
                    <Grid size={{ xs: 12, sm: 6 }} />
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Autocomplete<Laboratory, false, false, true>
                            freeSolo
                            options={laboratories.data ?? []}
                            loading={laboratories.isLoading}
                            inputValue={originInput}
                            onInputChange={(_, v) => setOriginInput(v)}
                            getOptionLabel={(opt) =>
                                typeof opt === "string" ? opt : opt.name
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Откуда (организация)"
                                    size="small"
                                    fullWidth
                                    helperText="Введите новое имя, чтобы создать"
                                />
                            )}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <Autocomplete<Laboratory, false, false, true>
                            freeSolo
                            options={laboratories.data ?? []}
                            loading={laboratories.isLoading}
                            inputValue={destInput}
                            onInputChange={(_, v) => setDestInput(v)}
                            getOptionLabel={(opt) =>
                                typeof opt === "string" ? opt : opt.name
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Куда (организация)"
                                    size="small"
                                    fullWidth
                                    helperText="Введите новое имя, чтобы создать"
                                />
                            )}
                        />
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
                <Button onClick={handleClose} disabled={busy}>
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleSubmit()}
                    variant="contained"
                    disabled={busy}
                >
                    {busy ? "Создаём..." : "Создать"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}