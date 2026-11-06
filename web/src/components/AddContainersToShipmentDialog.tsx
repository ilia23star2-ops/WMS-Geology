/**
 * Диалог выбора тар для добавления в рейс (OUTBOUND).
 *
 * Загружает список тар (ACTIVE), исключает уже добавленные,
 * даёт выбрать чекбоксами, поиск по номеру/Н/З, фильтры.
 *
 * c-2.x-shipments-2.
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
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
    DataGrid,
    type GridColDef,
    type GridRowId,
    type GridRowSelectionModel,
} from "@mui/x-data-grid";

import {
    CONTAINER_STATUS_LABELS,
    useContainers,
    useResearchTypes,
    type Container,
    type ContainerStatus,
} from "../api";
import { useAddShipmentContainers } from "../api/shipments";

interface AddContainersToShipmentDialogProps {
    open: boolean;
    shipmentId: number;
    excludedContainerIds: number[];
    onClose: () => void;
    onSuccess: (message: string) => void;
}

function emptySelection(): GridRowSelectionModel {
    return { type: "include", ids: new Set<GridRowId>() };
}

export default function AddContainersToShipmentDialog({
    open,
    shipmentId,
    excludedContainerIds,
    onClose,
    onSuccess,
}: AddContainersToShipmentDialogProps) {
    const [search, setSearch] = useState("");
    const [workOrderFilter, setWorkOrderFilter] = useState("");
    const [researchTypeFilter, setResearchTypeFilter] = useState<string>("");
    const [selection, setSelection] =
        useState<GridRowSelectionModel>(emptySelection());
    const [error, setError] = useState<string | null>(null);

    const { data, isLoading } = useContainers({
        page: 1,
        filters: { status: "ACTIVE" as ContainerStatus },
    });
    const researchTypes = useResearchTypes();
    const addMutation = useAddShipmentContainers(shipmentId);

    const excluded = useMemo(
        () => new Set(excludedContainerIds),
        [excludedContainerIds],
    );

    const rows = useMemo(() => {
        const all = data?.results ?? [];
        const filtered = all.filter((c) => !excluded.has(c.id));
        const q = search.trim().toLowerCase();
        const wo = workOrderFilter.trim().toLowerCase();
        const rtName =
            researchTypes.data?.find(
                (rt) => String(rt.id) === researchTypeFilter,
            )?.name ?? "";
        return filtered.filter((c) => {
            if (q) {
                const inNumber = (c.container_number ?? "")
                    .toLowerCase()
                    .includes(q);
                const inId = String(c.id).includes(q);
                if (!inNumber && !inId) return false;
            }
            if (wo) {
                const inWo = (c.draft_work_order_coded ?? "")
                    .toLowerCase()
                    .includes(wo);
                if (!inWo) return false;
            }
            if (researchTypeFilter) {
                if ((c.draft_research_type_name ?? "") !== rtName) {
                    return false;
                }
            }
            return true;
        });
    }, [
        data,
        excluded,
        search,
        workOrderFilter,
        researchTypeFilter,
        researchTypes.data,
    ]);

    const selectedIds = useMemo(
        () => Array.from(selection.ids).map((id) => Number(id)),
        [selection],
    );

    function handleClose() {
        if (addMutation.isPending) return;
        setSearch("");
        setWorkOrderFilter("");
        setResearchTypeFilter("");
        setSelection(emptySelection());
        setError(null);
        onClose();
    }

    async function handleConfirm() {
        if (selectedIds.length === 0) {
            setError("Выберите хотя бы одну тару.");
            return;
        }
        try {
            const result = await addMutation.mutateAsync(selectedIds);
            onSuccess(`Добавлено тар: ${result.added_count}.`);
            handleClose();
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { error?: string } };
            };
            setError(
                anyErr?.response?.data?.error
                ?? "Не удалось добавить тары.",
            );
        }
    }

    const columns: GridColDef<Container>[] = [
        { field: "id", headerName: "ID", width: 70 },
        {
            field: "container_number",
            headerName: "Номер",
            flex: 1,
            minWidth: 130,
            renderCell: (params) => {
                if (params.value) return params.value;
                return (
                    <Chip
                        label="Заготовка"
                        color="warning"
                        size="small"
                        variant="outlined"
                    />
                );
            },
        },
        {
            field: "draft_work_order_coded",
            headerName: "Н/З",
            flex: 1,
            minWidth: 130,
            valueGetter: (value) => value || "—",
        },
        {
            field: "draft_research_type_name",
            headerName: "ТИ",
            width: 120,
            valueGetter: (value) => value || "—",
        },
        {
            field: "status",
            headerName: "Статус",
            width: 150,
            renderCell: (params) => {
                const status = params.value as ContainerStatus;
                return (
                    <Chip
                        label={CONTAINER_STATUS_LABELS[status] ?? status}
                        size="small"
                        color={status === "ACTIVE" ? "success" : "default"}
                    />
                );
            },
        },
    ];

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
            <DialogTitle>Добавить тары в рейс</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={2} sx={{ mb: 2, mt: 0 }}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            label="Поиск по номеру или ID"
                            size="small"
                            fullWidth
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <TextField
                            label="Н/З"
                            size="small"
                            fullWidth
                            value={workOrderFilter}
                            onChange={(e) => setWorkOrderFilter(e.target.value)}
                            placeholder="TST0001…"
                        />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="rt-filter-label">ТИ</InputLabel>
                            <Select
                                labelId="rt-filter-label"
                                label="ТИ"
                                value={researchTypeFilter}
                                onChange={(e) =>
                                    setResearchTypeFilter(String(e.target.value))
                                }
                            >
                                <MenuItem value="">Все</MenuItem>
                                {(researchTypes.data ?? []).map((rt) => (
                                    <MenuItem key={rt.id} value={String(rt.id)}>
                                        {rt.code} — {rt.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>

                <Box sx={{ height: 420, width: "100%" }}>
                    <DataGrid<Container>
                        rows={rows}
                        columns={columns}
                        loading={isLoading}
                        checkboxSelection
                        rowSelectionModel={selection}
                        onRowSelectionModelChange={setSelection}
                        disableRowSelectionOnClick
                        disableColumnFilter
                        disableColumnSelector
                        disableDensitySelector
                        getRowId={(row) => row.id}
                        pageSizeOptions={[25, 50]}
                        initialState={{
                            pagination: { paginationModel: { pageSize: 25 } },
                        }}
                    />
                </Box>

                <Box
                    sx={{
                        mt: 1,
                        typography: "body2",
                        color: "text.secondary",
                    }}
                >
                    Найдено тар: {rows.length}. Выбрано: {selectedIds.length}.
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={addMutation.isPending}>
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleConfirm()}
                    variant="contained"
                    disabled={addMutation.isPending || selectedIds.length === 0}
                >
                    {addMutation.isPending
                        ? "Добавляем..."
                        : `Добавить (${selectedIds.length})`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
