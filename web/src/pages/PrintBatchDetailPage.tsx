/**
 * Детали партии печати.
 *
 * В зависимости от статуса — набор действий:
 * - DRAFT: добавить/убрать тары, «Перевести в готов», «Отменить».
 * - READY: скачать PDF, «Отметить как напечатанный», «Отменить».
 * - PRINTED: скачать PDF повторно.
 * - CANCELLED: только просмотр.
 */
import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DownloadIcon from "@mui/icons-material/Download";
import DoneIcon from "@mui/icons-material/Done";
import CancelIcon from "@mui/icons-material/Cancel";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useNavigate, useParams } from "react-router-dom";

import AddContainersDialog from "../components/AddContainersDialog";
import {
    PRINT_BATCH_STATUS_LABELS,
    PRINT_TYPE_LABELS,
    downloadBatchPdf,
    useAddContainers,
    useCancelBatch,
    useMarkPrinted,
    useMarkReady,
    usePrintBatch,
    useRemoveContainer,
    type PrintBatchItem,
    type PrintBatchStatus,
} from "../api";

const STATUS_COLORS: Record<
    PrintBatchStatus,
    "default" | "warning" | "success" | "error"
> = {
    DRAFT: "default",
    READY: "warning",
    PRINTED: "success",
    CANCELLED: "error",
};

export default function PrintBatchDetailPage() {
    const { id } = useParams<{ id: string }>();
    const batchId = id ? Number(id) : undefined;
    const navigate = useNavigate();

    const { data, isLoading, isError } = usePrintBatch(batchId);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const addMutation = useAddContainers(batchId ?? 0);
    const removeMutation = useRemoveContainer(batchId ?? 0);
    const markReadyMutation = useMarkReady(batchId ?? 0);
    const cancelMutation = useCancelBatch(batchId ?? 0);
    const markPrintedMutation = useMarkPrinted(batchId ?? 0);

    async function handleDownload() {
        if (batchId === undefined) return;
        try {
            await downloadBatchPdf(batchId);
            // PDF-скачивание переводит READY → PRINTED, обновляем кэш.
            if (data?.status === "READY") {
                // Простое решение — обновить страницу через invalidation.
                // markPrintedMutation используется только для ручной пометки.
            }
        } catch {
            setError("Не удалось скачать PDF.");
        }
    }

    async function handleMarkReady() {
        try {
            await markReadyMutation.mutateAsync();
        } catch {
            setError("Не удалось перевести партию в готовность.");
        }
    }

    async function handleCancel() {
        try {
            await cancelMutation.mutateAsync();
        } catch {
            setError("Не удалось отменить партию.");
        }
    }

    async function handleMarkPrinted() {
        try {
            await markPrintedMutation.mutateAsync();
        } catch {
            setError("Не удалось отметить партию как напечатанную.");
        }
    }

    async function handleRemove(containerId: number) {
        try {
            await removeMutation.mutateAsync(containerId);
        } catch {
            setError("Не удалось убрать тару.");
        }
    }

    if (isError) {
        return (
            <Box>
                <Typography color="error">Ошибка загрузки партии.</Typography>
                <Button onClick={() => navigate("/print")} sx={{ mt: 2 }}>
                    Назад
                </Button>
            </Box>
        );
    }

    if (isLoading || !data) {
        return <Typography>Загрузка...</Typography>;
    }

    const isDraft = data.status === "DRAFT";
    const isReady = data.status === "READY";
    const isPrinted = data.status === "PRINTED";
    const isCancelled = data.status === "CANCELLED";

    const itemColumns: GridColDef<PrintBatchItem>[] = [
        {
            field: "position",
            headerName: "№",
            width: 70,
        },
        {
            field: "container_number",
            headerName: "Тара",
            flex: 1,
            minWidth: 140,
        },
        ...(isDraft
            ? [
                {
                    field: "actions",
                    headerName: "",
                    width: 70,
                    sortable: false,
                    filterable: false,
                    disableColumnMenu: true,
                    renderCell: (params: { row: PrintBatchItem }) => (
                        <Tooltip title="Убрать из партии">
                            <IconButton
                                size="small"
                                onClick={() => void handleRemove(params.row.container)}
                                disabled={removeMutation.isPending}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    ),
                } as GridColDef<PrintBatchItem>,
            ]
            : []),
    ];

    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/print")}
                sx={{ mb: 2 }}
            >
                К списку партий
            </Button>

            <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 2 }}>
                <Typography variant="h2" component="h1">
                    {data.batch_number}
                </Typography>
                <Chip
                    label={PRINT_BATCH_STATUS_LABELS[data.status] ?? data.status}
                    color={STATUS_COLORS[data.status] ?? "default"}
                />
            </Box>

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography variant="body1">
                            Тип печати: <b>{PRINT_TYPE_LABELS[data.print_type]}</b>
                        </Typography>
                        <Typography variant="body1">
                            Тар в партии: <b>{data.total_items}</b>. Листов A4:{" "}
                            <b>{data.total_pages || "—"}</b>.
                        </Typography>
                        {data.created_by_username && (
                            <Typography variant="body1" color="text.secondary">
                                Создана: {data.created_by_username}
                            </Typography>
                        )}
                        {data.printed_at && data.printed_by_username && (
                            <Typography variant="body1" color="text.secondary">
                                Напечатана: {data.printed_by_username} (
                                {new Date(data.printed_at).toLocaleString("ru-RU")})
                            </Typography>
                        )}
                    </Stack>
                </CardContent>
            </Card>

            {isDraft && (
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setDialogOpen(true)}
                    >
                        Добавить тары
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<DoneIcon />}
                        disabled={data.total_items === 0 || markReadyMutation.isPending}
                        onClick={() => void handleMarkReady()}
                    >
                        Перевести в «Готов к печати»
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CancelIcon />}
                        disabled={cancelMutation.isPending}
                        onClick={() => void handleCancel()}
                    >
                        Отменить
                    </Button>
                </Stack>
            )}

            {isReady && (
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <Button
                        variant="contained"
                        startIcon={<DownloadIcon />}
                        onClick={() => void handleDownload()}
                    >
                        Скачать PDF
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<DoneIcon />}
                        disabled={markPrintedMutation.isPending}
                        onClick={() => void handleMarkPrinted()}
                    >
                        Отметить как напечатанный
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<CancelIcon />}
                        disabled={cancelMutation.isPending}
                        onClick={() => void handleCancel()}
                    >
                        Отменить
                    </Button>
                </Stack>
            )}

            {isPrinted && (
                <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => void handleDownload()}
                    >
                        Скачать PDF повторно
                    </Button>
                </Stack>
            )}

            {isCancelled && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Партия отменена.
                </Alert>
            )}

            <Card>
                <Box sx={{ height: 400, width: "100%" }}>
                    <DataGrid
                        rows={data.items}
                        columns={itemColumns}
                        getRowId={(row) => row.id}
                        disableRowSelectionOnClick
                        disableColumnFilter
                        disableColumnSelector
                        disableDensitySelector
                        hideFooter
                    />
                </Box>
            </Card>

            {batchId !== undefined && (
                <AddContainersDialog
                    open={dialogOpen}
                    excludedContainerIds={data.items.map((it) => it.container)}
                    onClose={() => setDialogOpen(false)}
                    onConfirm={async (ids) => {
                        await addMutation.mutateAsync(ids);
                    }}
                    isSubmitting={addMutation.isPending}
                />
            )}

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