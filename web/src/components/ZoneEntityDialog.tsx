/**
 * Диалог создания/правки сущностей напольных зон (zones-web-crud).
 * Виды: zone, zone-row, floor-place.
 */
import { useEffect, useState } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

import {
    useCreateFloorPlace,
    useCreateZone,
    useCreateZoneRow,
    useUpdateZone,
} from "../api/zones";

export type ZoneEntityKind = "zone" | "zone-row" | "floor-place";

export interface ZoneInitial {
    id: number;
    code: string;
    name?: string;
    orientation?: string;
    description?: string;
}

export interface ZoneDialogState {
    kind: ZoneEntityKind;
    parentId: number;
    initial: ZoneInitial | null;
}

const TITLES: Record<ZoneEntityKind, string> = {
    zone: "Зона",
    "zone-row": "Ряд зоны",
    "floor-place": "Место ряда",
};

interface FormState {
    code: string;
    name: string;
    orientation: string;
    description: string;
}

const EMPTY: FormState = { code: "", name: "", orientation: "horizontal", description: "" };

function formFrom(initial: ZoneInitial | null): FormState {
    if (!initial) return EMPTY;
    return {
        code: initial.code ?? "",
        name: initial.name ?? "",
        orientation: initial.orientation ?? "horizontal",
        description: initial.description ?? "",
    };
}

export default function ZoneEntityDialog({
    open,
    state,
    onClose,
    onSuccess,
}: {
    open: boolean;
    state: ZoneDialogState | null;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}) {
    const createZone = useCreateZone();
    const updateZone = useUpdateZone();
    const createRow = useCreateZoneRow();
    const createPlace = useCreateFloorPlace();
    const [form, setForm] = useState<FormState>(EMPTY);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (open) {
            setForm(formFrom(state?.initial ?? null));
            setError(null);
        }
    }, [open, state]);

    const busy =
        createZone.isPending || updateZone.isPending
        || createRow.isPending || createPlace.isPending;

    async function submit() {
        if (!state) return;
        setError(null);
        try {
            if (state.kind === "zone") {
                const payload = { code: form.code, name: form.name, description: form.description };
                if (state.initial) {
                    await updateZone.mutateAsync({ id: state.initial.id, payload });
                } else {
                    await createZone.mutateAsync({ ...payload, room: state.parentId });
                }
            } else if (state.kind === "zone-row") {
                await createRow.mutateAsync({
                    zone: state.parentId,
                    code: form.code,
                    orientation: form.orientation === "vertical" ? "vertical" : "horizontal",
                });
            } else {
                await createPlace.mutateAsync({ row: state.parentId, code: Number(form.code) });
            }
            onSuccess(`${TITLES[state.kind]} «${form.code}» сохранена.`);
        } catch {
            setError("Не удалось сохранить. Проверьте код (уникален в родителе).");
        }
    }

    if (!state) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>{`${state.initial ? "Правка" : "Создание"}: ${TITLES[state.kind]}`}</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Код"
                        value={form.code}
                        onChange={(e) => setForm({ ...form, code: e.target.value })}
                        fullWidth
                    />
                    {state.kind === "zone" && (
                        <TextField
                            label="Название"
                            value={form.name}
                            onChange={(e) => setForm({ ...form, name: e.target.value })}
                            fullWidth
                        />
                    )}
                    {state.kind === "zone-row" && (
                        <TextField
                            select
                            label="Ориентация"
                            value={form.orientation}
                            onChange={(e) => setForm({ ...form, orientation: e.target.value })}
                            fullWidth
                        >
                            <MenuItem value="horizontal">Горизонтально</MenuItem>
                            <MenuItem value="vertical">Вертикально</MenuItem>
                        </TextField>
                    )}
                    <TextField
                        label="Описание"
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        fullWidth
                        multiline
                        minRows={2}
                    />
                    {error && <Typography color="error">{error}</Typography>}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button
                    variant="contained"
                    onClick={() => void submit()}
                    disabled={busy || form.code === ""}
                >
                    Сохранить
                </Button>
            </DialogActions>
        </Dialog>
    );
}