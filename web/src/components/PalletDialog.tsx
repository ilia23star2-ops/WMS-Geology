/**
 * Диалог поддона в ячейке (пачка 2f-4b).
 *
 * Один поддон на ячейку (`Pallet.cell` — OneToOne).
 * Если поддона нет — форма создания; если есть — форма правки
 * + кнопка удаления.
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
    Typography,
} from "@mui/material";

import {
    PALLET_STATUS_LABELS,
    PALLET_TYPE_LABELS,
    useCreatePallet,
    useDeletePallet,
    usePalletByCell,
    useUpdatePallet,
    type Cell,
    type PalletStatus,
    type PalletType,
} from "../api";

interface PalletDialogProps {
    open: boolean;
    cell: Cell | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
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

const ALL_PALLET_TYPES: PalletType[] = Object.keys(
    PALLET_TYPE_LABELS,
) as PalletType[];

const ALL_PALLET_STATUSES: PalletStatus[] = Object.keys(
    PALLET_STATUS_LABELS,
) as PalletStatus[];

export default function PalletDialog({
    open,
    cell,
    onClose,
    onSuccess,
}: PalletDialogProps) {
    const { data: pallet, isLoading } = usePalletByCell(
        open ? cell?.id ?? null : null,
    );
    const createMutation = useCreatePallet();
    const updateMutation = useUpdatePallet();
    const deleteMutation = useDeletePallet();

    const [palletType, setPalletType] = useState<PalletType>("STANDARD");
    const [status, setStatus] = useState<PalletStatus>("ACTIVE");
    const [error, setError] = useState<string | null>(null);

    const busy =
        createMutation.isPending
        || updateMutation.isPending
        || deleteMutation.isPending;

    useEffect(() => {
        if (!open) {
            setError(null);
            return;
        }
        if (pallet) {
            setPalletType(pallet.pallet_type);
            setStatus(pallet.status);
        } else {
            setPalletType("STANDARD");
            setStatus("ACTIVE");
        }
    }, [open, pallet]);

    async function handleSave() {
        if (!cell) return;
        setError(null);
        try {
            if (pallet) {
                await updateMutation.mutateAsync({
                    id: pallet.id,
                    payload: { pallet_type: palletType, status },
                });
                onSuccess(`Поддон в ячейке «${cell.code}» сохранён.`);
            } else {
                await createMutation.mutateAsync({
                    cell: cell.id,
                    pallet_type: palletType,
                    status,
                });
                onSuccess(`Поддон создан в ячейке «${cell.code}».`);
            }
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось сохранить поддон.");
        }
    }

    async function handleDelete() {
        if (!pallet || !cell) return;
        const ok = window.confirm(
            `Удалить поддон #${pallet.id} из ячейки «${cell.code}»?`,
        );
        if (!ok) return;
        setError(null);
        try {
            await deleteMutation.mutateAsync(pallet.id);
            onSuccess(`Поддон #${pallet.id} удалён.`);
            onClose();
        } catch (err) {
            setError(extractError(err) ?? "Не удалось удалить поддон.");
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
                {pallet ? `Поддон #${pallet.id}` : "Новый поддон"} в ячейке
            </DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                {isLoading ? (
                    <Stack sx={{ alignItems: "center", py: 4 }}>
                        <CircularProgress size={24} />
                    </Stack>
                ) : (
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            Ячейка: {cell?.full_address ?? "—"}
                        </Typography>

                        <FormControl fullWidth size="small">
                            <InputLabel id="pallet-type-label">
                                Тип поддона
                            </InputLabel>
                            <Select
                                labelId="pallet-type-label"
                                label="Тип поддона"
                                value={palletType}
                                onChange={(e) =>
                                    setPalletType(e.target.value as PalletType)
                                }
                            >
                                {ALL_PALLET_TYPES.map((k) => (
                                    <MenuItem key={k} value={k}>
                                        {PALLET_TYPE_LABELS[k]}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small">
                            <InputLabel id="pallet-status-label">
                                Статус
                            </InputLabel>
                            <Select
                                labelId="pallet-status-label"
                                label="Статус"
                                value={status}
                                onChange={(e) =>
                                    setStatus(e.target.value as PalletStatus)
                                }
                            >
                                {ALL_PALLET_STATUSES.map((k) => (
                                    <MenuItem key={k} value={k}>
                                        {PALLET_STATUS_LABELS[k]}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {pallet && (
                            <Button
                                variant="outlined"
                                color="error"
                                onClick={() => void handleDelete()}
                                disabled={busy}
                            >
                                Удалить поддон
                            </Button>
                        )}
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
                    disabled={busy || isLoading || !cell}
                >
                    {busy ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}