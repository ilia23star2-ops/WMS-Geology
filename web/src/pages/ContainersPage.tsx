/**
 * Реестр тары: DataGrid + фильтры + пагинация + bulk-действия.
 *
 * - Кнопка «Создать тару» → диалог создания заготовок.
 * - Клик по строке заготовки (container_number = null) → форма
 *   заполнения пробами.
 * - При выборе тар — кнопка «В партию печати (N)».
 * - Edit/Delete — кнопки в колонке действий (пачка 2f-1).
 * - Колонки «Н/З», «ТИ» — draft-контекст (номер тары не уникален
 *   глобально, различаем по группе Н/З × ТИ).
 */
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

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<
    ContainerStatus,
    "success" | "warning" | "info" | "default"
> = {
    ACTIVE: "success",
    PENDING_PLACEMENT: "warning",
    IN_TRANSIT: "info",
    ISSUED: "default",
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
    const [selection, setSelection] =
        useState<GridRowSelectionModel>(emptySelection());
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
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
        { field: "id", headerName: "ID", width: 80 },
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
            minWidth: 140,
            valueGetter: (value) => value || "—",
        },
        {
            field: "draft_research_type_name",
            headerName: "ТИ",
            width: 140,
            valueGetter: (value) => value || "—",
        },
        {
            field: "status",
            headerName: "Статус",
            width: 180,
            renderCell: (params) => {
                const status = params.value as ContainerStatus;
                return (
                    <Chip
                        label={CONTAINER_STATUS_LABELS[status] ?? status}
                        color={STATUS_COLORS[status] ?? "default"}
                        size="small"
                    />
                );
            },
        },
        {
            field: "comment_template_text",
            headerName: "Комментарий",
            flex: 1,
            minWidth: 140,
            valueGetter: (value) => value ?? "—",
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
            width: 130,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => (
                <Stack direction="row" spacing={0.5}>
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
            ),
        },
    ];

    function handleRowClick(row: Container) {
        // Клик по заготовке → открываем форму заполнения.
        if (!row.container_number) {
            setFillContainer(row);
        }
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
                            <IconButton
                                color="primary"
                                onClick={() => setDialogOpen(true)}
                                title="В партию печати"
                            >
                                <PrintIcon />
                            </IconButton>
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
                        `В тару добавлено проб: ${totalSamples}.`,
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