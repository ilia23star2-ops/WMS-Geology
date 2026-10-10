/**
 * Диалог выбора тар для добавления в партию печати.
 *
 * Загружает список тар, исключает уже добавленные, даёт
 * выбрать чекбоксами и подтвердить.
 *
 * MUI X v9: GridRowSelectionModel = { type, ids: Set<GridRowId> }.
 */
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
} from "@mui/material";
import {
    DataGrid,
    type GridRowId,
    type GridRowSelectionModel,
} from "@mui/x-data-grid";

import { useContainers, type Container } from "../api";

interface AddContainersDialogProps {
    open: boolean;
    excludedContainerIds: number[];
    onClose: () => void;
    onConfirm: (containerIds: number[]) => Promise<void> | void;
    isSubmitting: boolean;
}

function emptySelection(): GridRowSelectionModel {
    return { type: "include", ids: new Set<GridRowId>() };
}

export default function AddContainersDialog({
    open,
    excludedContainerIds,
    onClose,
    onConfirm,
    isSubmitting,
}: AddContainersDialogProps) {
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [selection, setSelection] =
        useState<GridRowSelectionModel>(emptySelection());
    const [error, setError] = useState<string | null>(null);

    const { data, isLoading } = useContainers({
        page: page + 1,
        filters: {},
    });

    useEffect(() => {
        if (!open) {
            setSelection(emptySelection());
            setSearch("");
            setPage(0);
            setError(null);
        }
    }, [open]);

    const excluded = useMemo(
        () => new Set(excludedContainerIds),
        [excludedContainerIds],
    );

    const rows = useMemo(() => {
        const all = data?.results ?? [];
        const filtered = all.filter((c) => !excluded.has(c.id));
        const q = search.trim().toLowerCase();
        if (!q) return filtered;
        return filtered.filter(
            (c) =>
                c.container_number.toLowerCase().includes(q) ||
                String(c.id).includes(q),
        );
    }, [data, excluded, search]);

    const selectedIds = useMemo(
        () => Array.from(selection.ids).map((id) => Number(id)),
        [selection],
    );

    async function handleConfirm() {
        if (selectedIds.length === 0) {
            setError("Выберите хотя бы одну тару.");
            return;
        }
        try {
            await onConfirm(selectedIds);
            onClose();
        } catch {
            setError("Не удалось добавить тары.");
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Добавить тары в партию</DialogTitle>
            <DialogContent>
                <TextField
                    label="Поиск по номеру"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    size="small"
                    fullWidth
                    sx={{ mb: 2, mt: 1 }}
                />

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <div style={{ height: 400, width: "100%" }}>
                    <DataGrid<Container>
                        rows={rows}
                        columns={[
                            { field: "id", headerName: "ID", width: 70 },
                            {
                                field: "container_number",
                                headerName: "Номер",
                                flex: 1,
                            },
                            {
                                field: "status",
                                headerName: "Статус",
                                width: 160,
                            },
                        ]}
                        loading={isLoading}
                        checkboxSelection
                        rowSelectionModel={selection}
                        onRowSelectionModelChange={setSelection}
                        paginationMode="server"
                        paginationModel={{ page, pageSize: 50 }}
                        onPaginationModelChange={(m) => setPage(m.page)}
                        rowCount={data?.count ?? 0}
                        pageSizeOptions={[50]}
                        disableRowSelectionOnClick
                        disableColumnFilter
                        disableColumnSelector
                        disableDensitySelector
                        getRowId={(row) => row.id}
                    />
                </div>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isSubmitting}>
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleConfirm()}
                    variant="contained"
                    disabled={isSubmitting}
                >
                    {isSubmitting
                        ? "Добавляем..."
                        : `Добавить (${selectedIds.length})`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}