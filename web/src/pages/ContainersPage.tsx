/**
 * Реестр тары: DataGrid + фильтры + пагинация.
 *
 * Server-side: backend отдаёт 50 на страницу, `?page=` с 1.
 */
import { useMemo, useState } from "react";
import {
    Box,
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
    Tooltip,
    Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { DataGrid, type GridColDef, type GridPaginationModel } from "@mui/x-data-grid";

import {
    CONTAINER_STATUS_LABELS,
    downloadLabelPdf,
    useContainers,
    useContainerTypes,
    type Container,
    type ContainerFilters,
    type ContainerStatus,
} from "../api";

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

export default function ContainersPage() {
    const [filters, setFilters] = useState<ContainerFilters>({});
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: PAGE_SIZE,
    });
    const [pdfError, setPdfError] = useState<string | null>(null);

    const { data, isLoading, isError } = useContainers({
        page: paginationModel.page + 1,
        filters,
    });
    const containerTypes = useContainerTypes();

    const typesMap = useMemo(() => {
        const map = new Map<number, string>();
        for (const t of containerTypes.data ?? []) {
            map.set(t.id, t.name);
        }
        return map;
    }, [containerTypes.data]);

    const columns: GridColDef<Container>[] = [
        {
            field: "id",
            headerName: "ID",
            width: 80,
        },
        {
            field: "container_number",
            headerName: "Номер",
            flex: 1,
            minWidth: 140,
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
            width: 70,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => (
                <Tooltip title="PDF этикетки">
                    <IconButton
                        size="small"
                        onClick={async (e) => {
                            e.stopPropagation();
                            try {
                                await downloadLabelPdf(params.row.id);
                            } catch {
                                setPdfError(
                                    `Не удалось сформировать PDF для тары ${params.row.container_number}.`,
                                );
                            }
                        }}
                    >
                        <PictureAsPdfIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            ),
        },
    ];

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>
                Тара
            </Typography>

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                                            status: value === "" ? undefined : (value as ContainerStatus),
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

                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
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
                        disableRowSelectionOnClick
                        disableColumnFilter
                        disableColumnSelector
                        disableDensitySelector
                    />
                </Box>
            </Card>

            {isError && (
                <Stack sx={{ mt: 2 }}>
                    <Typography color="error">Ошибка загрузки тары.</Typography>
                </Stack>
            )}

            <Snackbar
                open={pdfError !== null}
                autoHideDuration={6000}
                onClose={() => setPdfError(null)}
                message={pdfError ?? ""}
            />
        </Box>
    );
}