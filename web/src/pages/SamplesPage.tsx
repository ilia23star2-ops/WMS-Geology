/**
 * Реестр проб: DataGrid + фильтры + пагинация.
 *
 * По умолчанию backend исключает утилизированные. Чекбокс
 * «Показать утилизированные» включает их в выдачу.
 */
import { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Checkbox,
    Chip,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";
import {
    DataGrid,
    type GridColDef,
    type GridPaginationModel,
} from "@mui/x-data-grid";

import {
    SAMPLE_STATUS_LABELS,
    useResearchTypes,
    useSamples,
    useSites,
    type Sample,
    type SampleFilters,
    type SampleStatus,
} from "../api";

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<
    SampleStatus,
    "success" | "warning" | "info" | "default" | "error"
> = {
    IN_STORAGE: "success",
    IN_TRANSIT: "info",
    ISSUED: "default",
    CONSUMED: "warning",
    DISPOSED: "error",
    PENDING_DECRYPTION: "warning",
};

function formatDate(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
        });
    } catch {
        return value;
    }
}

export default function SamplesPage() {
    const [filters, setFilters] = useState<SampleFilters>({});
    const [numberInput, setNumberInput] = useState("");
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: PAGE_SIZE,
    });

    const { data, isLoading, isError } = useSamples({
        page: paginationModel.page + 1,
        filters,
    });

    const researchTypes = useResearchTypes();
    const sites = useSites();

    function resetPage() {
        setPaginationModel((m) => ({ ...m, page: 0 }));
    }

    function applyNumberFilter() {
        setFilters((prev) => ({
            ...prev,
            sample_number: numberInput || undefined,
        }));
        resetPage();
    }

    const columns: GridColDef<Sample>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "sample_number", headerName: "Номер", flex: 1, minWidth: 140 },
        {
            field: "research_type_name",
            headerName: "Тип исследования",
            flex: 1,
            minWidth: 130,
        },
        {
            field: "site_name",
            headerName: "Участок",
            flex: 1,
            minWidth: 110,
            valueGetter: (value) => value ?? "—",
        },
        {
            field: "container_number",
            headerName: "Тара",
            flex: 1,
            minWidth: 120,
        },
        {
            field: "current_work_order_number",
            headerName: "Н/З",
            flex: 1,
            minWidth: 120,
            valueGetter: (value) => value ?? "—",
        },
        {
            field: "status",
            headerName: "Статус",
            width: 180,
            renderCell: (params) => {
                const status = params.value as SampleStatus;
                return (
                    <Chip
                        label={SAMPLE_STATUS_LABELS[status] ?? status}
                        color={STATUS_COLORS[status] ?? "default"}
                        size="small"
                    />
                );
            },
        },
        {
            field: "created_at",
            headerName: "Создана",
            width: 160,
            valueFormatter: (value) => formatDate(value as string),
        },
    ];

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>
                Пробы
            </Typography>

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                label="Номер пробы"
                                value={numberInput}
                                onChange={(e) => setNumberInput(e.target.value)}
                                onBlur={applyNumberFilter}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") applyNumberFilter();
                                }}
                                fullWidth
                                size="small"
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="rt-label">Тип исследования</InputLabel>
                                <Select
                                    labelId="rt-label"
                                    label="Тип исследования"
                                    value={
                                        filters.research_type !== undefined
                                            ? String(filters.research_type)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value as string;
                                        setFilters((prev) => ({
                                            ...prev,
                                            research_type:
                                                value === "" ? undefined : Number(value),
                                        }));
                                        resetPage();
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

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="site-label">Участок</InputLabel>
                                <Select
                                    labelId="site-label"
                                    label="Участок"
                                    value={
                                        filters.site !== undefined ? String(filters.site) : ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value as string;
                                        setFilters((prev) => ({
                                            ...prev,
                                            site: value === "" ? undefined : Number(value),
                                        }));
                                        resetPage();
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(sites.data ?? []).map((s) => (
                                        <MenuItem key={s.id} value={String(s.id)}>
                                            {s.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="status-label">Статус</InputLabel>
                                <Select
                                    labelId="status-label"
                                    label="Статус"
                                    value={filters.status ?? ""}
                                    onChange={(e) => {
                                        const value = e.target.value as SampleStatus | "";
                                        setFilters((prev) => ({
                                            ...prev,
                                            status:
                                                value === "" ? undefined : (value as SampleStatus),
                                        }));
                                        resetPage();
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(Object.keys(SAMPLE_STATUS_LABELS) as SampleStatus[]).map(
                                        (s) => (
                                            <MenuItem key={s} value={s}>
                                                {SAMPLE_STATUS_LABELS[s]}
                                            </MenuItem>
                                        ),
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={filters.show_disposed ?? false}
                                        onChange={(e) => {
                                            setFilters((prev) => ({
                                                ...prev,
                                                show_disposed: e.target.checked || undefined,
                                            }));
                                            resetPage();
                                        }}
                                    />
                                }
                                label="Показать утилизированные"
                            />
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
                <Typography color="error" sx={{ mt: 2 }}>
                    Ошибка загрузки проб.
                </Typography>
            )}
        </Box>
    );
}