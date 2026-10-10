/**
 * Список партий печати.
 *
 * Кнопка «Создать партию» открывает диалог выбора типа,
 * создаёт черновик, редиректит на страницу партии.
 */
import { useState } from "react";
import {
    Box,
    Button,
    Card,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    Radio,
    RadioGroup,
    Snackbar,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {
    DataGrid,
    type GridColDef,
    type GridPaginationModel,
} from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";

import {
    PRINT_BATCH_STATUS_LABELS,
    PRINT_TYPE_LABELS,
    useCreatePrintBatch,
    usePrintBatches,
    type PrintBatch,
    type PrintBatchStatus,
    type PrintType,
} from "../api";

const PAGE_SIZE = 50;

const STATUS_COLORS: Record<
    PrintBatchStatus,
    "default" | "warning" | "success" | "error"
> = {
    DRAFT: "default",
    READY: "warning",
    PRINTED: "success",
    CANCELLED: "error",
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

export default function PrintBatchesPage() {
    const navigate = useNavigate();
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: PAGE_SIZE,
    });
    const [createOpen, setCreateOpen] = useState(false);
    const [newType, setNewType] = useState<PrintType>("LABELS");
    const [error, setError] = useState<string | null>(null);

    const { data, isLoading, isError } = usePrintBatches({
        page: paginationModel.page + 1,
    });
    const createMutation = useCreatePrintBatch();

    async function handleCreate() {
        try {
            const created = await createMutation.mutateAsync(newType);
            setCreateOpen(false);
            navigate(`/print/${created.id}`);
        } catch {
            setError("Не удалось создать партию.");
        }
    }

    const columns: GridColDef<PrintBatch>[] = [
        {
            field: "batch_number",
            headerName: "Номер",
            flex: 1,
            minWidth: 140,
        },
        {
            field: "print_type",
            headerName: "Тип",
            width: 140,
            valueGetter: (value) => PRINT_TYPE_LABELS[value as PrintType] ?? value,
        },
        {
            field: "status",
            headerName: "Статус",
            width: 170,
            renderCell: (params) => {
                const status = params.value as PrintBatchStatus;
                return (
                    <Chip
                        label={PRINT_BATCH_STATUS_LABELS[status] ?? status}
                        color={STATUS_COLORS[status] ?? "default"}
                        size="small"
                    />
                );
            },
        },
        {
            field: "total_items",
            headerName: "Тар",
            width: 90,
            type: "number",
        },
        {
            field: "total_pages",
            headerName: "Листов",
            width: 100,
            type: "number",
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
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}
            >
                <Typography variant="h2" component="h1">
                    Партии печати
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setCreateOpen(true)}
                >
                    Создать партию
                </Button>
            </Box>

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
                        onRowClick={(params) => navigate(`/print/${params.row.id}`)}
                        sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
                    />
                </Box>
            </Card>

            {isError && (
                <Typography color="error" sx={{ mt: 2 }}>
                    Ошибка загрузки партий.
                </Typography>
            )}

            <Dialog
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle>Новая партия печати</DialogTitle>
                <DialogContent>
                    <FormControl sx={{ mt: 1 }}>
                        <FormLabel>Что печатать</FormLabel>
                        <RadioGroup
                            value={newType}
                            onChange={(e) => setNewType(e.target.value as PrintType)}
                        >
                            <FormControlLabel
                                value="LABELS"
                                control={<Radio />}
                                label="Этикетки (адаптивный размер)"
                            />
                            <FormControlLabel
                                value="QR_ONLY"
                                control={<Radio />}
                                label="Только QR (сетка 8×11)"
                            />
                        </RadioGroup>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Отмена</Button>
                    <Button
                        onClick={() => void handleCreate()}
                        variant="contained"
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? "Создаём..." : "Создать"}
                    </Button>
                </DialogActions>
            </Dialog>

            {error && (
                <Snackbar
                    open
                    autoHideDuration={6000}
                    onClose={() => setError(null)}
                    message={error}
                />
            )}
        </Box>
    );
}