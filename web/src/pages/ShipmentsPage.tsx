/**
 * Список рейсов.
 *
 * c-2.x-shipments-1b: базовая страница.
 * c-2.x-lab-portal-2: вкладки (Все/Исх/Вх), кнопка «Принять», фильтр «Только мои».
 * ТД-34: console.error заменен на console.debug.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
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
    Snackbar,
    Stack,
    Tab,
    Tabs,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
    DataGrid,
    type GridColDef,
    type GridPaginationModel,
} from "@mui/x-data-grid";

import {
    SHIPMENT_STATUS_LABELS,
    useLaboratories,
    useMarkReceived,
    useShipments,
    type Shipment,
    type ShipmentDirection,
    type ShipmentFilters,
    type ShipmentStatus,
} from "../api";
import CreateShipmentDialog from "../components/CreateShipmentDialog";

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<
    ShipmentStatus,
    "default" | "info" | "primary" | "success" | "warning" | "error"
> = {
    DRAFT: "default",
    ASSEMBLED: "info",
    SENT: "primary",
    RECEIVED: "success",
    PARTIALLY_RECEIVED: "warning",
    RETURNED: "warning",
    CANCELLED: "default",
    LOST: "error",
};

function formatDate(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleDateString("ru-RU");
    } catch {
        return value;
    }
}

export default function ShipmentsPage() {
    const navigate = useNavigate();
    const [tab, setTab] = useState<"ALL" | ShipmentDirection>("ALL");
    const [onlyMyLab, setOnlyMyLab] = useState(false);
    const [filters, setFilters] = useState<ShipmentFilters>({});
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: PAGE_SIZE,
    });
    const [createOpen, setCreateOpen] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const { data, isLoading, isError, refetch } = useShipments({
        page: paginationModel.page + 1,
        filters: {
            ...filters,
            direction: tab === "ALL" ? undefined : tab,
            my_lab: onlyMyLab,
        },
    });
    const laboratories = useLaboratories();
    const markReceivedMutation = useMarkReceived();

    const handleMarkReceived = async (id: number) => {
        try {
            await markReceivedMutation.mutateAsync(id);
            setMessage("Рейс успешно принят.");
            void refetch();
        } catch (err) {
            console.debug(err);
            setMessage("Ошибка при приёме рейса.");
        }
    };

    const columns: GridColDef<Shipment>[] = useMemo(
        () => [
            {
                field: "shipment_number",
                headerName: "№ рейса",
                flex: 1,
                minWidth: 140,
            },
            {
                field: "name",
                headerName: "Название",
                flex: 1,
                minWidth: 160,
                valueGetter: (value) => value || "—",
            },
            {
                field: "origin_laboratory_name",
                headerName: "Откуда",
                flex: 1,
                minWidth: 160,
                valueGetter: (value) => value ?? "—",
            },
            {
                field: "laboratory_name",
                headerName: "Куда",
                flex: 1,
                minWidth: 160,
                valueGetter: (value) => value ?? "—",
            },
            {
                field: "shipment_date",
                headerName: "Дата",
                width: 130,
                valueFormatter: (value) => formatDate(value as string | null),
            },
            {
                field: "containers_count",
                headerName: "Тар",
                width: 90,
                type: "number",
                align: "right",
                headerAlign: "right",
            },
            {
                field: "status",
                headerName: "Статус",
                width: 180,
                renderCell: (params) => {
                    const status = params.value as ShipmentStatus;
                    return (
                        <Chip
                            label={SHIPMENT_STATUS_LABELS[status] ?? status}
                            color={STATUS_COLORS[status] ?? "default"}
                            size="small"
                        />
                    );
                },
            },
            {
                field: "actions",
                headerName: "",
                width: 130,
                sortable: false,
                renderCell: (params) => {
                    if (params.row.can_mark_received) {
                        return (
                            <Button
                                size="small"
                                variant="contained"
                                color="success"
                                disabled={markReceivedMutation.isPending}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handleMarkReceived(params.row.id);
                                }}
                            >
                                Принять
                            </Button>
                        );
                    }
                    return null;
                },
            },
        ],
        [markReceivedMutation.isPending],
    );

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
                    Рейсы
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateOpen(true)}
                >
                    Создать рейс
                </Button>
            </Box>

            <Card sx={{ mb: 2 }}>
                <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Tabs
                        value={tab}
                        onChange={(_, newValue) => {
                            setTab(newValue);
                            setPaginationModel((m) => ({ ...m, page: 0 }));
                        }}
                    >
                        <Tab label="Все" value="ALL" />
                        <Tab label="Исходящие" value="OUTBOUND" />
                        <Tab label="Входящие" value="INBOUND" />
                    </Tabs>
                </Box>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="status-label">Статус</InputLabel>
                                <Select
                                    labelId="status-label"
                                    label="Статус"
                                    value={filters.status ?? ""}
                                    onChange={(e) => {
                                        const value = e.target.value as
                                            | ShipmentStatus
                                            | "";
                                        setFilters((prev) => ({
                                            ...prev,
                                            status:
                                                value === ""
                                                    ? undefined
                                                    : (value as ShipmentStatus),
                                        }));
                                        setPaginationModel((m) => ({
                                            ...m,
                                            page: 0,
                                        }));
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(
                                        Object.keys(
                                            SHIPMENT_STATUS_LABELS,
                                        ) as ShipmentStatus[]
                                    ).map((s) => (
                                        <MenuItem key={s} value={s}>
                                            {SHIPMENT_STATUS_LABELS[s]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="lab-label">
                                    Лаборатория
                                </InputLabel>
                                <Select
                                    labelId="lab-label"
                                    label="Лаборатория"
                                    value={
                                        filters.laboratory_id !== undefined
                                            ? String(filters.laboratory_id)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value as string;
                                        setFilters((prev) => ({
                                            ...prev,
                                            laboratory_id:
                                                value === ""
                                                    ? undefined
                                                    : Number(value),
                                        }));
                                        setPaginationModel((m) => ({
                                            ...m,
                                            page: 0,
                                        }));
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(laboratories.data ?? []).map((l) => (
                                        <MenuItem
                                            key={l.id}
                                            value={String(l.id)}
                                        >
                                            {l.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={onlyMyLab}
                                        onChange={(e) => {
                                            setOnlyMyLab(e.target.checked);
                                            setPaginationModel((m) => ({
                                                ...m,
                                                page: 0,
                                            }));
                                        }}
                                    />
                                }
                                label="Только доступные для приёма"
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
                        onRowClick={(params) =>
                            navigate(`/shipments/${params.row.id}`)
                        }
                        disableRowSelectionOnClick
                        disableColumnFilter
                        disableColumnSelector
                        disableDensitySelector
                        sx={{
                            "& .MuiDataGrid-row": { cursor: "pointer" },
                        }}
                    />
                </Box>
            </Card>

            {isError && (
                <Stack sx={{ mt: 2 }}>
                    <Alert severity="error">Ошибка загрузки рейсов.</Alert>
                </Stack>
            )}

            <CreateShipmentDialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onSuccess={(sh) => {
                    setMessage(`Рейс ${sh.shipment_number} создан.`);
                    navigate(`/shipments/${sh.id}`);
                }}
            />

            <Snackbar
                open={message !== null}
                autoHideDuration={6000}
                onClose={() => setMessage(null)}
                message={message ?? ""}
            />
        </Box>
    );
}