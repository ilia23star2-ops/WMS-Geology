import { useMemo, useState } from "react";
import {
    Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle,
    FormControl, InputLabel, MenuItem, Select, Typography
} from "@mui/material";
import {
    DataGrid, type GridColDef, type GridRowId, type GridRowSelectionModel
} from "@mui/x-data-grid";
import { useContainers, useSamples, type Container, type Sample, type ShipmentContainerItem } from "../api";
import { useRepackSamples } from "../api/shipments";

interface Props {
    open: boolean;
    shipmentId: number;
    containers: ShipmentContainerItem[];
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

function emptySelection(): GridRowSelectionModel {
    return { type: "include", ids: new Set<GridRowId>() };
}

export default function RepackSamplesDialog({ open, shipmentId, containers, onClose, onSuccess }: Props) {
    const [fromId, setFromId] = useState<number | "">("");
    const [toId, setToId] = useState<number | "">("");
    const [selection, setSelection] = useState<GridRowSelectionModel>(emptySelection());
    const [error, setError] = useState<string | null>(null);

    const repackMutation = useRepackSamples(shipmentId);

    // Получаем пробы исходной тары
    const samplesQuery = useSamples({
        page: 1,
        filters: { container_id: fromId === "" ? undefined : fromId },
    });

    // Получаем возможные целевые тары (все активные/ожидающие)
    const activeQuery = useContainers({ page: 1, filters: { status: "ACTIVE" } });
    const pendingQuery = useContainers({ page: 1, filters: { status: "PENDING_FILLING" } });

    const targetContainers = useMemo(() => {
        const map = new Map<number, Container>();
        for (const c of activeQuery.data?.results ?? []) map.set(c.id, c);
        for (const c of pendingQuery.data?.results ?? []) map.set(c.id, c);
        // Исключаем исходную тару
        if (fromId !== "") map.delete(Number(fromId));
        return Array.from(map.values());
    }, [activeQuery.data, pendingQuery.data, fromId]);

    const selectedIds = useMemo(() => Array.from(selection.ids).map(Number), [selection]);

    const handleClose = () => {
        if (repackMutation.isPending) return;
        setFromId("");
        setToId("");
        setSelection(emptySelection());
        setError(null);
        onClose();
    };

    const handleConfirm = async () => {
        if (fromId === "" || toId === "" || selectedIds.length === 0) {
            setError("Выберите исходную тару, целевую тару и хотя бы одну пробу.");
            return;
        }
        try {
            await repackMutation.mutateAsync({
                from_container_id: Number(fromId),
                to_container_id: Number(toId),
                sample_ids: selectedIds,
            });
            onSuccess(`Переложено проб: ${selectedIds.length}.`);
            handleClose();
        } catch (err: any) {
            setError(err?.response?.data?.error ?? "Не удалось переложить пробы.");
        }
    };

    const columns: GridColDef<Sample>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "sample_number", headerName: "Номер пробы", flex: 1, minWidth: 150 },
        { field: "research_type_name", headerName: "ТИ", width: 120 },
        { field: "status", headerName: "Статус", width: 150 },
    ];

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>Переложить пробы</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{error}</Alert>}

                <Box sx={{ display: "flex", gap: 2, mb: 3, mt: 1 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Откуда (исходная тара)</InputLabel>
                        <Select value={fromId} label="Откуда (исходная тара)" onChange={(e) => { setFromId(Number(e.target.value)); setSelection(emptySelection()); }}>
                            {containers.map((c) => (
                                <MenuItem key={c.container} value={c.container}>
                                    {c.container_number || `Заготовка #${c.container}`} ({c.draft_work_order_coded})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                        <InputLabel>Куда (транспортная тара)</InputLabel>
                        <Select value={toId} label="Куда (транспортная тара)" onChange={(e) => setToId(Number(e.target.value))}>
                            {targetContainers.map((c) => (
                                <MenuItem key={c.id} value={c.id}>
                                    {c.container_number || `Заготовка #${c.id}`} ({c.draft_work_order_coded || "без Н/З"})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {fromId !== "" && (
                    <Box sx={{ height: 300, width: "100%" }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Пробы в исходной таре:</Typography>
                        <DataGrid
                            rows={samplesQuery.data?.results ?? []}
                            columns={columns}
                            loading={samplesQuery.isLoading}
                            checkboxSelection
                            rowSelectionModel={selection}
                            onRowSelectionModelChange={setSelection}
                            disableRowSelectionOnClick
                            getRowId={(row) => row.id}
                        />
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={repackMutation.isPending}>Отмена</Button>
                <Button onClick={handleConfirm} variant="contained" disabled={repackMutation.isPending || selectedIds.length === 0}>
                    {repackMutation.isPending ? "Перекладываем..." : `Переложить (${selectedIds.length})`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}