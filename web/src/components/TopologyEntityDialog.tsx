/**
 * Диалог создания / редактирования узла топологии (пачка 2f-4a).
 *
 * Один компонент на пять сущностей. Различия:
 * - Room: name, description.
 * - Rack: code, description.
 * - Section: code, qr_code, description.
 * - Tier: code (A–D), level_number, description.
 * - Cell: code, full_address (с автогенерацией), cell_type,
 *   qr_code, is_active.
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
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
} from "@mui/material";

import {
    useCreateCell,
    useCreateRack,
    useCreateRoom,
    useCreateSection,
    useCreateTier,
    useUpdateCell,
    useUpdateRack,
    useUpdateRoom,
    useUpdateSection,
    useUpdateTier,
    type CellType,
    type TierCode,
} from "../api";

export type TopologyKind = "room" | "rack" | "section" | "tier" | "cell";

export interface TopologyInitial {
    id: number;
    name?: string;
    code?: string;
    description?: string;
    qr_code?: string | null;
    level_number?: number | null;
    full_address?: string;
    cell_type?: CellType;
    is_active?: boolean;
}

interface TopologyEntityDialogProps {
    open: boolean;
    kind: TopologyKind;
    /** id родителя — к чему цепляем создаваемый узел. */
    parentId: number | null;
    /** null — создание, объект — редактирование. */
    initial: TopologyInitial | null;
    /** Префикс для автогенерации `full_address` новой ячейки. */
    addressPrefix?: string;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

interface FormState {
    name: string;
    code: string;
    description: string;
    qrCode: string;
    levelNumber: string;
    fullAddress: string;
    cellType: CellType;
    isActive: boolean;
}

const EMPTY: FormState = {
    name: "",
    code: "",
    description: "",
    qrCode: "",
    levelNumber: "",
    fullAddress: "",
    cellType: "STANDARD",
    isActive: true,
};

function formFrom(initial: TopologyInitial | null): FormState {
    if (!initial) {
        return { ...EMPTY };
    }
    return {
        name: initial.name ?? "",
        code: initial.code ?? "",
        description: initial.description ?? "",
        qrCode: initial.qr_code ?? "",
        levelNumber:
            initial.level_number !== null && initial.level_number !== undefined
                ? String(initial.level_number)
                : "",
        fullAddress: initial.full_address ?? "",
        cellType: initial.cell_type ?? "STANDARD",
        isActive: initial.is_active ?? true,
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

export default function TopologyEntityDialog({
    open,
    kind,
    parentId,
    initial,
    addressPrefix,
    onClose,
    onSuccess,
}: TopologyEntityDialogProps) {
    const createRoom = useCreateRoom();
    const createRack = useCreateRack();
    const createSection = useCreateSection();
    const createTier = useCreateTier();
    const createCell = useCreateCell();

    const updateRoom = useUpdateRoom();
    const updateRack = useUpdateRack();
    const updateSection = useUpdateSection();
    const updateTier = useUpdateTier();
    const updateCell = useUpdateCell();

    const [form, setForm] = useState<FormState>(EMPTY);
    const [error, setError] = useState<string | null>(null);

    const isEdit = initial !== null;
    const busy =
        createRoom.isPending || createRack.isPending
        || createSection.isPending || createTier.isPending
        || createCell.isPending
        || updateRoom.isPending || updateRack.isPending
        || updateSection.isPending || updateTier.isPending
        || updateCell.isPending;

    useEffect(() => {
        if (open) {
            setForm(formFrom(initial));
            setError(null);
        }
    }, [open, initial]);

    // Автогенерация full_address для новой ячейки, когда меняется
    // код. Редактирование — не трогаем (пользователь сам решает).
    useEffect(() => {
        if (kind !== "cell") return;
        if (initial !== null) return;
        const prefix = addressPrefix ?? "";
        const code = form.code.trim();
        if (!prefix || !code) return;
        setForm((prev) => ({
            ...prev,
            fullAddress: `${prefix} / ${code}`,
        }));
    }, [form.code, kind, initial, addressPrefix]);

    const canSave =
        (kind === "room" ? form.name.trim().length > 0
            : form.code.trim().length > 0)
        && !busy
        && (kind !== "cell" || form.fullAddress.trim().length > 0);

    async function handleSave() {
        setError(null);
        try {
            if (kind === "room") {
                const payload = {
                    name: form.name.trim(),
                    description: form.description,
                };
                if (isEdit && initial) {
                    await updateRoom.mutateAsync({ id: initial.id, payload });
                    onSuccess(`Комната «${payload.name}» сохранена.`);
                } else {
                    await createRoom.mutateAsync(payload);
                    onSuccess(`Комната «${payload.name}» создана.`);
                }
            } else if (kind === "rack") {
                const payload = {
                    room: parentId as number,
                    code: form.code.trim(),
                    description: form.description,
                };
                if (isEdit && initial) {
                    await updateRack.mutateAsync({ id: initial.id, payload });
                    onSuccess(`Стеллаж «${payload.code}» сохранён.`);
                } else {
                    await createRack.mutateAsync(payload);
                    onSuccess(`Стеллаж «${payload.code}» создан.`);
                }
            } else if (kind === "section") {
                const payload = {
                    rack: parentId as number,
                    code: form.code.trim(),
                    qr_code: form.qrCode.trim() || null,
                    description: form.description,
                };
                if (isEdit && initial) {
                    await updateSection.mutateAsync({
                        id: initial.id, payload,
                    });
                    onSuccess(`Секция «${payload.code}» сохранена.`);
                } else {
                    await createSection.mutateAsync(payload);
                    onSuccess(`Секция «${payload.code}» создана.`);
                }
            } else if (kind === "tier") {
                const level = form.levelNumber.trim();
                const payload = {
                    section: parentId as number,
                    code: form.code as TierCode,
                    level_number: level === "" ? null : Number(level),
                    description: form.description,
                };
                if (isEdit && initial) {
                    await updateTier.mutateAsync({ id: initial.id, payload });
                    onSuccess(`Ярус «${payload.code}» сохранён.`);
                } else {
                    await createTier.mutateAsync(payload);
                    onSuccess(`Ярус «${payload.code}» создан.`);
                }
            } else {
                const payload = {
                    tier: parentId as number,
                    code: form.code.trim(),
                    full_address: form.fullAddress.trim(),
                    cell_type: form.cellType,
                    qr_code: form.qrCode.trim() || null,
                    is_active: form.isActive,
                };
                if (isEdit && initial) {
                    await updateCell.mutateAsync({ id: initial.id, payload });
                    onSuccess(`Ячейка «${payload.code}» сохранена.`);
                } else {
                    await createCell.mutateAsync(payload);
                    onSuccess(`Ячейка «${payload.code}» создана.`);
                }
            }
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось сохранить.");
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
                {isEdit ? "Редактировать" : "Создать"}{" "}
                {kind === "room" ? "комнату"
                    : kind === "rack" ? "стеллаж"
                        : kind === "section" ? "секцию"
                            : kind === "tier" ? "ярус"
                                : "ячейку"}
            </DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={2} sx={{ mt: 1 }}>
                    {kind === "room" ? (
                        <TextField
                            label="Название"
                            size="small"
                            fullWidth
                            value={form.name}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    name: e.target.value,
                                }))
                            }
                        />
                    ) : kind === "tier" ? (
                        <FormControl fullWidth size="small">
                            <InputLabel id="tier-code-label">Код</InputLabel>
                            <Select
                                labelId="tier-code-label"
                                label="Код"
                                value={form.code}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        code: e.target.value,
                                    }))
                                }
                            >
                                <MenuItem value="A">A (нижний)</MenuItem>
                                <MenuItem value="B">B</MenuItem>
                                <MenuItem value="C">C</MenuItem>
                                <MenuItem value="D">D (верхний)</MenuItem>
                            </Select>
                        </FormControl>
                    ) : (
                        <TextField
                            label={kind === "cell" ? "Номер ячейки" : "Код"}
                            size="small"
                            fullWidth
                            value={form.code}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    code: e.target.value,
                                }))
                            }
                            helperText={
                                kind === "cell" ? "1, 2 или 3." : undefined
                            }
                        />
                    )}

                    {kind === "tier" && (
                        <TextField
                            label="Уровень (число)"
                            size="small"
                            type="number"
                            fullWidth
                            value={form.levelNumber}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    levelNumber: e.target.value,
                                }))
                            }
                            helperText="1, 2, 3, 4 (снизу вверх)."
                        />
                    )}

                    {(kind === "section" || kind === "cell") && (
                        <TextField
                            label="QR-код (опционально)"
                            size="small"
                            fullWidth
                            value={form.qrCode}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    qrCode: e.target.value,
                                }))
                            }
                            helperText="Например, WMSG:SECTION:12."
                        />
                    )}

                    {kind === "cell" && (
                        <>
                            <TextField
                                label="Полный адрес"
                                size="small"
                                fullWidth
                                value={form.fullAddress}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        fullAddress: e.target.value,
                                    }))
                                }
                                helperText={
                                    isEdit
                                        ? undefined
                                        : "Автогенерация из пути. Можно поправить."
                                }
                            />

                            <FormControl fullWidth size="small">
                                <InputLabel id="cell-type-label">
                                    Тип ячейки
                                </InputLabel>
                                <Select
                                    labelId="cell-type-label"
                                    label="Тип ячейки"
                                    value={form.cellType}
                                    onChange={(e) =>
                                        setForm((prev) => ({
                                            ...prev,
                                            cellType: e.target.value as CellType,
                                        }))
                                    }
                                >
                                    <MenuItem value="STANDARD">Обычная</MenuItem>
                                    <MenuItem value="CORE">Керновая</MenuItem>
                                </Select>
                            </FormControl>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={form.isActive}
                                        onChange={(e) =>
                                            setForm((prev) => ({
                                                ...prev,
                                                isActive: e.target.checked,
                                            }))
                                        }
                                    />
                                }
                                label="Активна"
                            />
                        </>
                    )}

                    {kind !== "cell" && (
                        <TextField
                            label="Описание"
                            size="small"
                            fullWidth
                            multiline
                            minRows={2}
                            value={form.description}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    description: e.target.value,
                                }))
                            }
                        />
                    )}
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