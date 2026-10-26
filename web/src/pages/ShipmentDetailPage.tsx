/**
 * Детали рейса (Shipment).
 *
 * Показывает:
 * - шапку рейса (номер, статус, направление, лаборатория, дата,
 *   водитель, машина);
 * - связанный Receipt (один на рейс, `site=NULL`);
 * - список ReceiptItem (по одной строке на тару);
 * - кнопки «Начать сверку», «Отменить партию» (2f-5a-2);
 * - edit/delete строк (2f-5a-2);
 * - (2f-6c) Edit / Delete рейса, «Отменить рейс».
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
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CancelIcon from "@mui/icons-material/Cancel";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import {
    DataGrid,
    type GridColDef,
} from "@mui/x-data-grid";
import { useNavigate, useParams } from "react-router-dom";

import {
    RECEIPT_ITEM_STATUS_LABELS,
    RECEIPT_STATUS_LABELS,
    SHIPMENT_DIRECTION_LABELS,
    SHIPMENT_STATUS_LABELS,
    useCancelReceipt,
    useCancelShipment,
    useDeleteReceiptItem,
    useDeleteShipment,
    useReceiptItems,
    useReceipts,
    useShipment,
    type Receipt,
    type ReceiptItem,
    type ReceiptItemStatus,
    type ShipmentStatus,
} from "../api";
import ReceiptItemEditDialog from "../components/ReceiptItemEditDialog";
import ShipmentEditDialog from "../components/ShipmentEditDialog";

const SHIPMENT_STATUS_COLORS: Record<
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

const ITEM_STATUS_COLORS: Record<
    ReceiptItemStatus,
    "default" | "success" | "warning" | "error"
> = {
    EXPECTED: "default",
    MATCHED: "success",
    DISCREPANCY: "warning",
    MISSING: "error",
    EXTRA: "warning",
    PENDING_DECRYPTION: "default",
};

function formatDate(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleDateString("ru-RU");
    } catch {
        return value;
    }
}

function extractError(err: unknown): string | null {
    const anyErr = err as {
        response?: { data?: { error?: string; detail?: string } };
    };
    return (
        anyErr?.response?.data?.error
        ?? anyErr?.response?.data?.detail
        ?? null
    );
}

// ============================================================
// Список ReceiptItem
// ============================================================
interface ReceiptItemsPanelProps {
    receiptId: number;
    onMessage: (msg: string) => void;
    onError: (msg: string) => void;
}

function ReceiptItemsPanel({
    receiptId,
    onMessage,
    onError,
}: ReceiptItemsPanelProps) {
    const items = useReceiptItems({ page: 1, receiptId });
    const deleteMutation = useDeleteReceiptItem();

    const [editingItem, setEditingItem] = useState<ReceiptItem | null>(null);

    async function handleDelete(item: ReceiptItem) {
        const label = item.container_number
            ?? (item.container ? `заготовка #${item.container}` : `#${item.id}`);
        const ok = window.confirm(
            `Удалить строку (тара ${label})? `
            + "Если в таре есть пробы — они тоже удалятся.",
        );
        if (!ok) return;
        try {
            await deleteMutation.mutateAsync(item.id);
            onMessage(`Строка (тара ${label}) удалена.`);
        } catch (err) {
            onError(
                extractError(err) ?? "Не удалось удалить строку.",
            );
        }
    }

    const columns: GridColDef<ReceiptItem>[] = [
        {
            field: "expected_work_order_number",
            headerName: "Н/З",
            flex: 1,
            minWidth: 130,
        },
        {
            field: "expected_research_type_code",
            headerName: "ТИ",
            width: 80,
        },
        {
            field: "expected_site_code",
            headerName: "Участок",
            width: 110,
        },
        {
            field: "container_number",
            headerName: "Тара",
            flex: 1,
            minWidth: 130,
            renderCell: (params) => {
                if (params.value) return params.value;
                if (params.row.container) {
                    return (
                        <Chip
                            label="Заготовка"
                            size="small"
                            variant="outlined"
                            color="warning"
                        />
                    );
                }
                return "—";
            },
        },
        {
            field: "expected_samples_count",
            headerName: "Проб",
            width: 90,
            type: "number",
            align: "right",
            headerAlign: "right",
            valueGetter: (value) => value ?? 0,
        },
        {
            field: "status",
            headerName: "Статус",
            width: 170,
            renderCell: (params) => {
                const status = params.value as ReceiptItemStatus;
                return (
                    <Chip
                        label={RECEIPT_ITEM_STATUS_LABELS[status] ?? status}
                        color={ITEM_STATUS_COLORS[status] ?? "default"}
                        size="small"
                    />
                );
            },
        },
        {
            field: "actions",
            headerName: "",
            width: 100,
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
                                setEditingItem(params.row);
                            }}
                        >
                            <EditIcon fontSize="small" />
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

    return (
        <Card>
            <CardContent sx={{ pb: 1 }}>
                <Typography variant="h3" sx={{ mb: 1 }}>
                    Тары в партии ({items.data?.count ?? 0})
                </Typography>
            </CardContent>
            <Box sx={{ height: 480, width: "100%" }}>
                <DataGrid
                    rows={items.data?.results ?? []}
                    columns={columns}
                    loading={items.isLoading}
                    getRowId={(row) => row.id}
                    disableRowSelectionOnClick
                    disableColumnFilter
                    disableColumnSelector
                    disableDensitySelector
                    hideFooter
                />
            </Box>
            <ReceiptItemEditDialog
                open={editingItem !== null}
                item={editingItem}
                onClose={() => setEditingItem(null)}
                onSuccess={onMessage}
            />
        </Card>
    );
}

// ============================================================
// Страница
// ============================================================
export default function ShipmentDetailPage() {
    const { id } = useParams<{ id: string }>();
    const shipmentId = id ? Number(id) : null;
    const navigate = useNavigate();

    const shipment = useShipment(shipmentId);
    const receipts = useReceipts({
        page: 1,
        filters: { shipment_id: shipmentId ?? undefined },
    });
    const cancelReceiptMutation = useCancelReceipt();
    const cancelShipmentMutation = useCancelShipment();
    const deleteShipmentMutation = useDeleteShipment();

    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [editOpen, setEditOpen] = useState(false);

    const receipt: Receipt | null = receipts.data?.results[0] ?? null;

    async function handleCancelReceipt() {
        if (!receipt) return;
        const ok = window.confirm(
            `Отменить партию ${receipt.receipt_number}? `
            + "Статус станет «Отменена».",
        );
        if (!ok) return;
        try {
            await cancelReceiptMutation.mutateAsync(receipt.id);
            setMessage(`Партия ${receipt.receipt_number} отменена.`);
        } catch (err) {
            setError(
                extractError(err) ?? "Не удалось отменить партию.",
            );
        }
    }

    async function handleCancelShipment() {
        if (!shipment.data) return;
        const reason = window.prompt(
            `Отменить рейс ${shipment.data.shipment_number}?\n`
            + "Необязательно: укажите причину.",
            "",
        );
        // null — пользователь нажал «Отмена» в prompt.
        if (reason === null) return;
        try {
            await cancelShipmentMutation.mutateAsync({
                id: shipment.data.id,
                reason: reason.trim() || undefined,
            });
            setMessage(`Рейс ${shipment.data.shipment_number} отменён.`);
        } catch (err) {
            setError(
                extractError(err) ?? "Не удалось отменить рейс.",
            );
        }
    }

    async function handleDeleteShipment() {
        if (!shipment.data) return;
        const ok = window.confirm(
            `Удалить рейс ${shipment.data.shipment_number}? `
            + "Связанные партии приёмки останутся, но потеряют связь "
            + "с рейсом. Действие необратимо.",
        );
        if (!ok) return;
        try {
            await deleteShipmentMutation.mutateAsync(shipment.data.id);
            navigate("/receiving");
        } catch (err) {
            setError(
                extractError(err) ?? "Не удалось удалить рейс.",
            );
        }
    }

    if (shipment.isError) {
        return (
            <Box>
                <Typography color="error">
                    Ошибка загрузки рейса.
                </Typography>
                <Button
                    onClick={() => navigate("/receiving")}
                    sx={{ mt: 2 }}
                >
                    Назад
                </Button>
            </Box>
        );
    }

    if (shipment.isLoading || !shipment.data) {
        return <Typography>Загрузка...</Typography>;
    }

    const data = shipment.data;

    const canCancelReceipt =
        receipt !== null
        && receipt.status !== "CONFIRMED"
        && receipt.status !== "CANCELLED"
        && !cancelReceiptMutation.isPending;

    const canCancelShipment =
        data.status !== "RECEIVED"
        && data.status !== "PARTIALLY_RECEIVED"
        && data.status !== "CANCELLED"
        && !cancelShipmentMutation.isPending;

    const busyShipment =
        deleteShipmentMutation.isPending
        || cancelShipmentMutation.isPending;

    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/receiving")}
                sx={{ mb: 2 }}
            >
                К списку рейсов
            </Button>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 2,
                    flexWrap: "wrap",
                    rowGap: 1,
                }}
            >
                <Typography variant="h2" component="h1">
                    Рейс {data.shipment_number}
                </Typography>
                <Chip
                    label={SHIPMENT_STATUS_LABELS[data.status] ?? data.status}
                    color={SHIPMENT_STATUS_COLORS[data.status] ?? "default"}
                />
                <Box sx={{ flexGrow: 1 }} />
                <Tooltip title="Редактировать рейс">
                    <IconButton
                        onClick={() => setEditOpen(true)}
                        disabled={busyShipment}
                    >
                        <EditIcon />
                    </IconButton>
                </Tooltip>
                <Tooltip title="Удалить рейс">
                    <IconButton
                        color="error"
                        onClick={() => void handleDeleteShipment()}
                        disabled={busyShipment}
                    >
                        <DeleteIcon />
                    </IconButton>
                </Tooltip>
            </Box>

            {message && (
                <Alert
                    severity="success"
                    sx={{ mb: 2 }}
                    onClose={() => setMessage(null)}
                >
                    {message}
                </Alert>
            )}
            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Stack spacing={1}>
                        <Typography variant="body1">
                            Направление:{" "}
                            <b>
                                {SHIPMENT_DIRECTION_LABELS[data.direction] ??
                                    data.direction}
                            </b>
                        </Typography>
                        <Typography variant="body1">
                            Лаборатория:{" "}
                            <b>{data.laboratory_name ?? "—"}</b>
                        </Typography>
                        <Typography variant="body1">
                            Участок: <b>{data.site_name ?? "—"}</b>
                        </Typography>
                        <Typography variant="body1">
                            Дата рейса: <b>{formatDate(data.shipment_date)}</b>
                        </Typography>
                        {data.driver_name && (
                            <Typography variant="body1">
                                Водитель: <b>{data.driver_name}</b>
                            </Typography>
                        )}
                        {data.vehicle_number && (
                            <Typography variant="body1">
                                Машина: <b>{data.vehicle_number}</b>
                            </Typography>
                        )}
                        {data.destination && (
                            <Typography variant="body1">
                                Назначение: <b>{data.destination}</b>
                            </Typography>
                        )}
                        {data.cancel_reason && (
                            <Typography
                                variant="body1"
                                color="warning.main"
                            >
                                Причина отмены: {data.cancel_reason}
                            </Typography>
                        )}
                        {data.note && (
                            <Typography
                                variant="body1"
                                color="text.secondary"
                            >
                                Примечание: {data.note}
                            </Typography>
                        )}
                    </Stack>

                    <Stack
                        direction="row"
                        spacing={2}
                        sx={{ mt: 2, flexWrap: "wrap", rowGap: 1 }}
                    >
                        <Tooltip
                            title={
                                canCancelShipment
                                    ? "Статус станет «Отменён»"
                                    : "Принятый, частично принятый или "
                                    + "отменённый рейс отменить нельзя"
                            }
                        >
                            <span>
                                <Button
                                    variant="outlined"
                                    color="warning"
                                    startIcon={<CancelIcon />}
                                    onClick={() => void handleCancelShipment()}
                                    disabled={!canCancelShipment}
                                >
                                    {cancelShipmentMutation.isPending
                                        ? "Отменяем..."
                                        : "Отменить рейс"}
                                </Button>
                            </span>
                        </Tooltip>
                    </Stack>
                </CardContent>
            </Card>

            {receipts.isLoading && <Typography>Загрузка партии...</Typography>}

            {receipt && (
                <>
                    <Card sx={{ mb: 2 }}>
                        <CardContent>
                            <Typography variant="h3" sx={{ mb: 1 }}>
                                Партия приёмки
                            </Typography>
                            <Stack spacing={1}>
                                <Typography variant="body1">
                                    Номер: <b>{receipt.receipt_number}</b>
                                </Typography>
                                <Typography variant="body1">
                                    Ожидаемая дата:{" "}
                                    <b>{formatDate(receipt.expected_date)}</b>
                                </Typography>
                                <Typography variant="body1">
                                    Статус:{" "}
                                    <b>
                                        {RECEIPT_STATUS_LABELS[
                                            receipt.status
                                        ] ?? receipt.status}
                                    </b>
                                </Typography>
                                <Typography variant="body1">
                                    Тар в партии: <b>{receipt.items_count}</b>
                                </Typography>
                            </Stack>
                            <Stack
                                direction="row"
                                spacing={2}
                                sx={{ mt: 2, flexWrap: "wrap", rowGap: 1 }}
                            >
                                <Button
                                    variant="contained"
                                    startIcon={<FactCheckIcon />}
                                    onClick={() =>
                                        navigate(
                                            `/receiving/${data.id}/check`,
                                        )
                                    }
                                >
                                    Начать сверку
                                </Button>
                                <Tooltip
                                    title={
                                        canCancelReceipt
                                            ? "Статус станет «Отменена»"
                                            : "Подтверждённую или отменённую партию отменить нельзя"
                                    }
                                >
                                    <span>
                                        <Button
                                            variant="outlined"
                                            color="warning"
                                            startIcon={<WarningAmberIcon />}
                                            onClick={() =>
                                                void handleCancelReceipt()
                                            }
                                            disabled={!canCancelReceipt}
                                        >
                                            {cancelReceiptMutation.isPending
                                                ? "Отменяем..."
                                                : "Отменить партию"}
                                        </Button>
                                    </span>
                                </Tooltip>
                            </Stack>
                        </CardContent>
                    </Card>

                    <ReceiptItemsPanel
                        receiptId={receipt.id}
                        onMessage={setMessage}
                        onError={setError}
                    />
                </>
            )}

            {!receipts.isLoading && !receipt && (
                <Alert severity="info">
                    У рейса пока нет связанной партии приёмки.
                </Alert>
            )}

            <ShipmentEditDialog
                open={editOpen}
                shipment={data}
                onClose={() => setEditOpen(false)}
                onSuccess={setMessage}
            />
        </Box>
    );
}