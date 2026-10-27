import { useMemo, useState } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControl,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import PrintDisabledIcon from "@mui/icons-material/PrintDisabled";
import EditNoteIcon from "@mui/icons-material/EditNote";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import OutputIcon from "@mui/icons-material/Output";
import PlaceIcon from "@mui/icons-material/Place";
import {
    DataGrid,
    type GridColDef,
    type GridPaginationModel,
    type GridRowId,
    type GridRowSelectionModel,
} from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";

import {
    CONTAINER_STATUS_LABELS,
    deleteContainer,
    downloadLabelPdf,
    useContainers,
    useContainerTypes,
    useResearchTypes,
    type Container,
    type ContainerFilters,
    type ContainerStatus,
} from "../api";
import AddToPrintBatchDialog from "../components/AddToPrintBatchDialog";
import ContainerEditDialog from "../components/ContainerEditDialog";
import CreateContainersDialog from "../components/CreateContainersDialog";
import FillContainerDialog from "../components/FillContainerDialog";
import ContainerPreviewDialog from "../components/ContainerPreviewDialog";
import PlaceContainerDialog from "../components/PlaceContainerDialog";

const PAGE_SIZE = 50;

const STATUS_ICONS: Record<ContainerStatus, React.ReactElement> = {
    PENDING_FILLING: <EditNoteIcon fontSize="small" color="warning" />,
    PENDING_PLACEMENT: <Inventory2Icon fontSize="small" color="warning" />,
    ACTIVE: <CheckCircleIcon fontSize="small" color="success" />,
    IN_TRANSIT: <LocalShippingIcon fontSize="small" color="info" />,
    ISSUED: <OutputIcon fontSize="small" color="disabled" />,
};

function formatDate(value: string): string {
    try {
        return new Date(value).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
        });
    } catch {
        return value;
    }
}

function emptySelection(): GridRowSelectionModel {
    return { type: "include", ids: new Set<GridRowId>() };
}

export default function ContainersPage() {
    const navigate = useNavigate();
    const [filters, setFilters] = useState<ContainerFilters>({});
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: PAGE_SIZE,
    });
    const [selection, setSelection] = useState<GridRowSelectionModel>(emptySelection());

    const [pdfError, setPdfError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false); // Print
    const [placeDialogOpen, setPlaceDialogOpen] = useState(false); // Place
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [createMessage, setCreateMessage] = useState<string | null>(null);

    const [fillContainer, setFillContainer] = useState<Container | null>(null);
    const [fillMessage, setFillMessage] = useState<string | null>(null);
    const [previewContainerId, setPreviewContainerId] = useState<number | null>(null);
    const [editContainer, setEditContainer] = useState<Container | null>(null);
    const [editMessage, setEditMessage] = useState<string | null>(null);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const { data, isLoading, isError } = useContainers({
        page: paginationModel.page + 1,
        filters,
    });
    const containerTypes = useContainerTypes();
    const researchTypes = useResearchTypes();

    const typesMap = useMemo(() => {
        const map = new Map<number, string>();
        for (const t of containerTypes.data ?? []) {
            map.set(t.id, t.name);
        }
        return map;
    }, [containerTypes.data]);

    const selectedIds = useMemo(
        () => Array.from(selection.ids).map((id) => Number(id)),
        [selection],
    );

    // Для размещения выбираем только тары со статусом PENDING_FILLING или PENDING_PLACEMENT
    const selectedForPlacement = useMemo(() => {
        const all = data?.results ?? [];
        return all.filter(c => selectedIds.includes(c.id) && (c.status === "PENDING_FILLING" || c.status === "PENDING_PLACEMENT"));
    }, [data, selectedIds]);

    async function handleDelete(row: Container) {
        const label = row.container_number
            ? `№ ${row.container_number}`
            : `#${row.id}`;
        const ok = window.confirm(
            `Удалить тару ${label}? Действие необратимо.`,
        );
        if (!ok) return;
        try {
            await deleteContainer(row.id);
            setEditMessage(`Тара ${label} удалена.`);
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { error?: string; detail?: string } };
            };
            const msg =
                anyErr?.response?.data?.error
                ?? anyErr?.response?.data?.detail
                ?? `Не удалось удалить тару ${label}.`;
            setDeleteError(msg);
        }
    }

    const columns: GridColDef<Container>[] = [
        {
            field: "container_number",
            headerName: "Номер",
            flex: 1,
            minWidth: 120,
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
            field: "container_type",
            headerName: "Тип",
            flex: 1,
            minWidth: 140,
            valueGetter: (_value, row) =>
                typesMap.get(row.container_type) ?? `#${row.container_type}`,
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
            width: 70,
            align: "center",
            headerAlign: "center",
            renderCell: (params) => {
                const status = params.value as ContainerStatus;
                return (
                    <Tooltip title={CONTAINER_STATUS_LABELS[status] ?? status}>
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            {STATUS_ICONS[status] ?? status}
                        </Box>
                    </Tooltip>
                );
            },
        },
        {
            field: "label_printed_at",
            headerName: "Этикетка",
            width: 80,
            align: "center",
            headerAlign: "center",
            renderCell: (params) => {
                if (params.value) {
                    return (
                        <Tooltip title={`Напечатана: ${formatDate(params.value as string)}`}>
                            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                                <PrintIcon fontSize="small" color="success" />
                            </Box>
                        </Tooltip>
                    );
                }
                return (
                    <Tooltip title="Не напечатана">
                        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
                            <PrintDisabledIcon fontSize="small" color="disabled" />
                        </Box>
                    </Tooltip>
                );
            },
        },
        {
            field: "comment_template_text",
            headerName: "Комментарий",
            flex: 1,
            minWidth: 120,
            renderCell: (params) => {
                if (!params.value) return "—";
                return (
                    <Tooltip title={params.value}>
                        <Typography variant="body2" noWrap sx={{ width: "100%" }}>
                            {params.value}
                        </Typography>
                    </Tooltip>
                );
            },
        },
        {
            field: "created_at",
            headerName: "Создана",
            width: 160,
            valueFormatter: (value) => formatDate(value as string),
        },
        {
            field: "actions",
            headerName: "",
            width: 150,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => {
                const isPlaced = params.row.status === "ACTIVE";
                return (
                    <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Разместить">
                            <span>
                                <IconButton
                                    size="small"
                                    color="primary"
                                    disabled={isPlaced}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelection({ type: "include", ids: new Set([params.row.id]) });
                                        setPlaceDialogOpen(true);
                                    }}
                                >
                                    <PlaceIcon fontSize="small" />
                                </IconButton>
                            </span>
                        </Tooltip>
                        <Tooltip title="Редактировать">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setEditContainer(params.row);
                                }}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="PDF этикетки">
                            <IconButton
                                size="small"
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        await downloadLabelPdf(params.row.id);
                                    } catch {
                                        setPdfError(
                                            `Не удалось сформировать PDF для тары ${params.row.container_number ?? `#${params.row.id}`}.`,
                                        );
                                    }
                                }}
                            >
                                <PictureAsPdfIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                        <Tooltip title="Удалить">
                            <IconButton
                                size="small"
                                color="error"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handleDelete(params.row);
                                }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Stack>
                );
            },
        },
    ];

    function handleRowClick(row: Container) {
        setFillContainer(row);
    }

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}
            >
                <Typography variant="h2" component="h1">
                    Тара
                </Typography>
                <Stack
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: "center" }}
                >
                    {selectedIds.length > 0 && (
                        <>
                            <Typography variant="body1" color="text.secondary">
                                Выбрано: {selectedIds.length}
                            </Typography>
                            <Tooltip title="В партию печати">
                                <IconButton
                                    color="primary"
                                    onClick={() => setDialogOpen(true)}
                                >
                                    <PrintIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Разместить выбранные">
                                <span>
                                    <IconButton
                                        color="secondary"
                                        disabled={selectedForPlacement.length === 0}
                                        onClick={() => setPlaceDialogOpen(true)}
                                    >
                                        <PlaceIcon />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </>
                    )}
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setCreateDialogOpen(true)}
                    >
                        Создать тару
                    </Button>
                </Stack>
            </Box>

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="status-label">Статус</InputLabel>
                                <Select
                                    labelId="status-label"
                                    label="Статус"
                                    value={filters.status ?? ""}
                                    onChange={(e) => {
                                        const value = e.target.value as ContainerStatus | "";
                                        setFilters((prev) => ({
                                            ...prev,
                                            status:
                                                value === "" ? undefined : (value as ContainerStatus),
                                        }));
                                        setPaginationModel((m) => ({ ...m, page: 0 }));
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(Object.keys(CONTAINER_STATUS_LABELS) as ContainerStatus[]).map(
                                        (s) => (
                                            <MenuItem key={s} value={s}>
                                                {CONTAINER_STATUS_LABELS[s]}
                                            </MenuItem>
                                        ),
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="type-label">Тип тары</InputLabel>
                                <Select
                                    labelId="type-label"
                                    label="Тип тары"
                                    value={
                                        filters.container_type_id !== undefined
                                            ? String(filters.container_type_id)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value as string;
                                        setFilters((prev) => ({
                                            ...prev,
                                            container_type_id:
                                                value === "" ? undefined : Number(value),
                                        }));
                                        setPaginationModel((m) => ({ ...m, page: 0 }));
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(containerTypes.data ?? []).map((t) => (
                                        <MenuItem key={t.id} value={String(t.id)}>
                                            {t.name}
                                            {t.laboratory_name ? ` (${t.laboratory_name})` : ""}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                label="Н/З (draft)"
                                size="small"
                                fullWidth
                                value={filters.draft_work_order_coded ?? ""}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFilters((prev) => ({
                                        ...prev,
                                        draft_work_order_coded:
                                            value === "" ? undefined : value,
                                    }));
                                    setPaginationModel((m) => ({ ...m, page: 0 }));
                                }}
                                placeholder="TST0001…"
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="draft-rt-label">ТИ (draft)</InputLabel>
                                <Select
                                    labelId="draft-rt-label"
                                    label="ТИ (draft)"
                                    value={
                                        filters.draft_research_type_id !== undefined
                                            ? String(filters.draft_research_type_id)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value as string;
                                        setFilters((prev) => ({
                                            ...prev,
                                            draft_research_type_id:
                                                value === "" ? undefined : Number(value),
                                        }));
                                        setPaginationModel((m) => ({ ...m, page: 0 }));
                                    }}
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
                </CardContent>
            </Card>

            <Card>
                <Box sx={{ height: 600, width: "100%" }}>
                    <DataGrid
                        rows={data?.results ?? []}
                        columns={columns}
                        loading={isLoading}
                        rowCount={data?.count ?? 0}
                        paginationMode="server"
                        paginationModel={paginationModel}
                        onPaginationModelChange={setPaginationModel}
                        pageSizeOptions={[PAGE_SIZE]}
                        checkboxSelection
                        rowSelectionModel={selection}
                        onRowSelectionModelChange={setSelection}
                        disableRowSelectionOnClick
                        disableColumnFilter
                        disableColumnSelector
                        disableDensitySelector
                        initialState={{
                            columns: {
                                columnVisibilityModel: {
                                    created_at: false,
                                },
                            },
                        }}
                        onRowClick={(params) => handleRowClick(params.row)}
                        sx={{
                            "& .MuiDataGrid-row": {
                                cursor: "pointer",
                            },
                        }}
                    />
                </Box>
            </Card>

            {isError && (
                <Stack sx={{ mt: 2 }}>
                    <Typography color="error">Ошибка загрузки тары.</Typography>
                </Stack>
            )}

            <CreateContainersDialog
                open={createDialogOpen}
                onClose={() => setCreateDialogOpen(false)}
                onSuccess={(count) => {
                    setCreateMessage(
                        `Создано тар: ${count}. Заполните их пробами из реестра.`,
                    );
                }}
            />

            <FillContainerDialog
                open={fillContainer !== null}
                container={fillContainer}
                onClose={() => setFillContainer(null)}
                onSuccess={(containerId, totalSamples) => {
                    setFillMessage(
                        `В таре сохранено проб: ${totalSamples}.`,
                    );
                    setFillContainer(null);
                    setPreviewContainerId(containerId);
                }}
            />

            <ContainerPreviewDialog
                open={previewContainerId !== null}
                containerId={previewContainerId}
                onClose={() => setPreviewContainerId(null)}
            />

            <ContainerEditDialog
                open={editContainer !== null}
                container={editContainer}
                onClose={() => setEditContainer(null)}
                onSuccess={(updated) => {
                    setEditMessage(
                        `Тара ${updated.container_number ?? `#${updated.id}`} сохранена.`,
                    );
                    setEditContainer(null);
                }}
            />

            <AddToPrintBatchDialog
                open={dialogOpen}
                containerIds={selectedIds}
                onClose={() => setDialogOpen(false)}
                onSuccess={(batchId) => {
                    setSelection(emptySelection());
                    navigate(`/print/${batchId}`);
                }}
            />

            <PlaceContainerDialog
                open={placeDialogOpen}
                containerIds={selectedForPlacement.map(c => c.id)}
                onClose={() => setPlaceDialogOpen(false)}
                onSuccess={(msg) => {
                    setSelection(emptySelection());
                    setEditMessage(msg);
                }}
            />

            <Snackbar
                open={pdfError !== null}
                autoHideDuration={6000}
                onClose={() => setPdfError(null)}
                message={pdfError ?? ""}
            />

            <Snackbar
                open={createMessage !== null}
                autoHideDuration={6000}
                onClose={() => setCreateMessage(null)}
                message={createMessage ?? ""}
            />

            <Snackbar
                open={fillMessage !== null}
                autoHideDuration={6000}
                onClose={() => setFillMessage(null)}
                message={fillMessage ?? ""}
            />

            <Snackbar
                open={editMessage !== null}
                autoHideDuration={6000}
                onClose={() => setEditMessage(null)}
                message={editMessage ?? ""}
            />

            <Snackbar
                open={deleteError !== null}
                autoHideDuration={8000}
                onClose={() => setDeleteError(null)}
                message={deleteError ?? ""}
            />
        </Box>
    );
}