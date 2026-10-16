/**
 * Диалог редактирования рейса (пачка 2f-6b).
 *
 * Правятся: `shipment_number`, `direction`, `laboratory`, `site`,
 * `shipment_date`, `driver_name`, `vehicle_number`, `destination`,
 * `note`.
 *
 * НЕ правятся (read-only или меняются через отдельные действия):
 * - `status` — через `POST /shipments/{id}/cancel/`;
 * - `sent_by`, `sent_at`, `cancelled_*` — аудит.
 *
 * Селекты лабораторий/участков тянутся из справочников. Показываем
 * только активные записи + текущее значение, даже если оно
 * деактивировано (иначе не увидим, что было выбрано).
 */
import { useEffect, useMemo, useState } from "react";
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
    SHIPMENT_DIRECTION_LABELS,
    useLaboratories,
    useSites,
    useUpdateShipment,
    type Shipment,
    type ShipmentDirection,
} from "../api";

interface ShipmentEditDialogProps {
    open: boolean;
    shipment: Shipment | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

interface FormState {
    shipmentNumber: string;
    direction: ShipmentDirection;
    laboratoryId: string;
    siteId: string;
    shipmentDate: string;
    driverName: string;
    vehicleNumber: string;
    destination: string;
    note: string;
}

const ALL_DIRECTIONS: ShipmentDirection[] = Object.keys(
    SHIPMENT_DIRECTION_LABELS,
) as ShipmentDirection[];

const EMPTY_FORM: FormState = {
    shipmentNumber: "",
    direction: "OUTBOUND",
    laboratoryId: "",
    siteId: "",
    shipmentDate: "",
    driverName: "",
    vehicleNumber: "",
    destination: "",
    note: "",
};

function formFrom(shipment: Shipment | null): FormState {
    if (!shipment) return EMPTY_FORM;
    return {
        shipmentNumber: shipment.shipment_number ?? "",
        direction: shipment.direction,
        laboratoryId:
            shipment.laboratory !== null ? String(shipment.laboratory) : "",
        siteId: shipment.site !== null ? String(shipment.site) : "",
        shipmentDate: shipment.shipment_date ?? "",
        driverName: shipment.driver_name ?? "",
        vehicleNumber: shipment.vehicle_number ?? "",
        destination: shipment.destination ?? "",
        note: shipment.note ?? "",
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

export default function ShipmentEditDialog({
    open,
    shipment,
    onClose,
    onSuccess,
}: ShipmentEditDialogProps) {
    const updateMutation = useUpdateShipment();

    const laboratories = useLaboratories();
    const sites = useSites();

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm(formFrom(shipment));
            setError(null);
        }
    }, [open, shipment]);

    const busy = updateMutation.isPending;

    /**
     * Активные записи + текущая выбранная (даже если деактивирована).
     */
    const laboratoryOptions = useMemo(() => {
        const list = laboratories.data ?? [];
        const currentId = shipment?.laboratory ?? null;
        return list.filter(
            (l) => l.is_active || l.id === currentId,
        );
    }, [laboratories.data, shipment?.laboratory]);

    const siteOptions = useMemo(() => {
        const list = sites.data ?? [];
        const currentId = shipment?.site ?? null;
        return list.filter((s) => s.is_active || s.id === currentId);
    }, [sites.data, shipment?.site]);

    const canSave =
        shipment !== null
        && form.shipmentNumber.trim().length > 0
        && !busy;

    async function handleSave() {
        if (!shipment) return;
        setError(null);

        const payload = {
            shipment_number: form.shipmentNumber.trim(),
            direction: form.direction,
            laboratory:
                form.laboratoryId === ""
                    ? null
                    : Number(form.laboratoryId),
            site: form.siteId === "" ? null : Number(form.siteId),
            shipment_date:
                form.shipmentDate === "" ? null : form.shipmentDate,
            driver_name: form.driverName,
            vehicle_number: form.vehicleNumber,
            destination: form.destination,
            note: form.note,
        };

        try {
            await updateMutation.mutateAsync({
                id: shipment.id,
                payload,
            });
            onSuccess(`Рейс ${payload.shipment_number} сохранён.`);
            onClose();
        } catch (err) {
            setError(
                extractError(err) ?? "Не удалось сохранить рейс.",
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
                Редактировать рейс
                {shipment && ` ${shipment.shipment_number}`}
            </DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Номер рейса"
                        size="small"
                        fullWidth
                        value={form.shipmentNumber}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                shipmentNumber: e.target.value,
                            }))
                        }
                    />

                    <FormControl fullWidth size="small">
                        <InputLabel id="sh-direction-label">
                            Направление
                        </InputLabel>
                        <Select
                            labelId="sh-direction-label"
                            label="Направление"
                            value={form.direction}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    direction:
                                        e.target.value as ShipmentDirection,
                                }))
                            }
                        >
                            {ALL_DIRECTIONS.map((d) => (
                                <MenuItem key={d} value={d}>
                                    {SHIPMENT_DIRECTION_LABELS[d]}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel id="sh-lab-label">
                            Лаборатория
                        </InputLabel>
                        <Select
                            labelId="sh-lab-label"
                            label="Лаборатория"
                            value={form.laboratoryId}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    laboratoryId: String(e.target.value),
                                }))
                            }
                        >
                            <MenuItem value="">
                                <em>— не указана —</em>
                            </MenuItem>
                            {laboratoryOptions.map((l) => (
                                <MenuItem key={l.id} value={String(l.id)}>
                                    {l.code} — {l.name}
                                    {!l.is_active ? " (отключена)" : ""}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel id="sh-site-label">Участок</InputLabel>
                        <Select
                            labelId="sh-site-label"
                            label="Участок"
                            value={form.siteId}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    siteId: String(e.target.value),
                                }))
                            }
                        >
                            <MenuItem value="">
                                <em>— не указан —</em>
                            </MenuItem>
                            {siteOptions.map((s) => (
                                <MenuItem key={s.id} value={String(s.id)}>
                                    {s.code} — {s.name}
                                    {!s.is_active ? " (отключён)" : ""}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Дата рейса"
                        size="small"
                        type="date"
                        fullWidth
                        value={form.shipmentDate}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                shipmentDate: e.target.value,
                            }))
                        }
                        slotProps={{ inputLabel: { shrink: true } }}
                    />

                    <TextField
                        label="Водитель"
                        size="small"
                        fullWidth
                        value={form.driverName}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                driverName: e.target.value,
                            }))
                        }
                    />

                    <TextField
                        label="Машина"
                        size="small"
                        fullWidth
                        value={form.vehicleNumber}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                vehicleNumber: e.target.value,
                            }))
                        }
                    />

                    <TextField
                        label="Пункт назначения"
                        size="small"
                        fullWidth
                        value={form.destination}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                destination: e.target.value,
                            }))
                        }
                        helperText="Свободный текст. Например: «Склад лаборатории, г. Томск»."
                    />

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
                    disabled={!canSave}
                >
                    {busy ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}