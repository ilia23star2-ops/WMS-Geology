/**
 * Приёмка рейсов: список Shipment (INBOUND).
 *
 * DataGrid + фильтры (направление, статус) + server-side пагинация.
 * Клик по строке — детали рейса (receiving-2c).
 * Кнопка «Импортировать рейс» — открывает диалог (receiving-2d).
 *
 * После импорта (2f-5b-fix):
 * - APPLIED → сразу на карточку рейса;
 * - PARSED + questions > 0 → сразу на экран сверки (`/check`),
 *   где разбираются конфликты;
 * - PARSED без вопросов (только parser/build ошибки) → остаёмся
 *   на списке со snackbar;
 * - ERROR → остаёмся, snackbar с предупреждением.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    FormControl,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    Typography,
} from "@mui/material";
import {
    DataGrid,
    type GridColDef,
    type GridPaginationModel,
} from "@mui/x-data-grid";
import {
    SHIPMENT_DIRECTION_LABELS,
    SHIPMENT_STATUS_LABELS,
    useShipments,
    type ImportShipmentResponse,
    type Shipment,
    type ShipmentDirection,
    type ShipmentFilters,
    type ShipmentStatus,
} from "../api";
import ImportShipmentDialog from "../components/ImportShipmentDialog";

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<
    ShipmentStatus,
    "success" | "warning" | "info" | "primary" | "error" | "default"
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

export default function ReceivingPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [filters, setFilters] = useState<ShipmentFilters>({
        direction: "INBOUND",
    });
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: PAGE_SIZE,
    });

    const [importDialogOpen, setImportDialogOpen] = useState(false);
    const [snackbar, setSnackbar] = useState<{
        open: boolean;
        message: string;
        severity: "success" | "warning" | "error";
    } | null>(null);

    const { data, isLoading, isError } = useShipments({
        page: paginationModel.page + 1,
        filters,
    });

    const columns: GridColDef<Shipment>[] = useMemo(
        () => [
            {
                field: "shipment_number",
                headerName: "№ рейса",
                flex: 1,
                minWidth: 140,
            },
            {
                field: "direction",
                headerName: "Направление",
                width: 180,
                renderCell: (params) => {
                    const direction = params.value as ShipmentDirection;
                    return (
                        <Chip
                            label={SHIPMENT_DIRECTION_LABELS[direction] ?? direction}
                            size="small"
                            variant="outlined"
                        />
                    );
                },
            },
            {
                field: "laboratory_name",
                headerName: "Лаборатория",
                flex: 1,
                minWidth: 160,
                valueGetter: (value) => value ?? "—",
            },
            {
                field: "shipment_date",
                headerName: "Дата рейса",
                width: 130,
                valueFormatter: (value) => formatDate(value as string | null),
            },
            {
                field: "status",
                headerName: "Статус",
                width: 200,
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
                field: "containers_count",
                headerName: "Тар",
                width: 100,
                type: "number",
                align: "right",
                headerAlign: "right",
            },
        ],
        [],
    );

    function handleImportSuccess(result: ImportShipmentResponse) {
        // Инвалидируем кэш, чтобы список обновился.
        void queryClient.invalidateQueries({ queryKey: ["shipments"] });

        if (result.status === "APPLIED") {
            // Всё создалось без вопросов — сразу на карточку рейса.
            if (result.shipment_id !== null) {
                navigate(`/receiving/${result.shipment_id}`);
            }
            return;
        }

        if (result.status === "PARSED" && result.questions_count > 0) {
            // Есть спорные ячейки — сразу на экран сверки,
            // там карточки конфликтов.
            if (result.shipment_id !== null) {
                navigate(`/receiving/${result.shipment_id}/check`);
            }
            return;
        }

        if (result.status === "PARSED") {
            // PARSED без вопросов — только parser/build ошибки.
            // Остаёмся на списке, показываем предупреждение.
            setSnackbar({
                open: true,
                message: (
                    `Рейс ${result.shipment_number ?? ""} импортирован `
                    + `частично (${result.containers_count} тар). `
                    + `Смотрите ошибки в партии.`
                ),
                severity: "warning",
            });
            return;
        }

        // ERROR или другой случай.
        setSnackbar({
            open: true,
            message: "Импорт завершился с ошибкой. Проверьте файл.",
            severity: "error",
        });
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
                    Приёмка
                </Typography>
                <Button
                    variant="contained"
                    onClick={() => setImportDialogOpen(true)}
                >
                    Импортировать рейс
                </Button>
            </Box>

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="direction-label">
                                    Направление
                                </InputLabel>
                                <Select
                                    labelId="direction-label"
                                    label="Направление"
                                    value={filters.direction ?? ""}
                                    onChange={(e) => {
                                        const value = e.target.value as
                                            | ShipmentDirection
                                            | "";
                                        setFilters((prev) => ({
                                            ...prev,
                                            direction:
                                                value === ""
                                                    ? undefined
                                                    : (value as ShipmentDirection),
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
                                            SHIPMENT_DIRECTION_LABELS,
                                        ) as ShipmentDirection[]
                                    ).map((d) => (
                                        <MenuItem key={d} value={d}>
                                            {SHIPMENT_DIRECTION_LABELS[d]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
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
                            navigate(`/receiving/${params.row.id}`)
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

            <ImportShipmentDialog
                open={importDialogOpen}
                onClose={() => setImportDialogOpen(false)}
                onSuccess={handleImportSuccess}
            />

            {snackbar && (
                <Snackbar
                    open={snackbar.open}
                    autoHideDuration={6000}
                    onClose={() => setSnackbar(null)}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                >
                    <Alert
                        onClose={() => setSnackbar(null)}
                        severity={snackbar.severity}
                        variant="filled"
                        sx={{ width: "100%" }}
                    >
                        {snackbar.message}
                    </Alert>
                </Snackbar>
            )}
        </Box>
    );
}