/**
 * Реестр Наряд-заказов (2f-8b).
 */
import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Chip,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import LinkIcon from "@mui/icons-material/Link";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

import {
    WORK_ORDER_STATUS_LABELS,
    WORK_ORDER_TYPE_LABELS,
    useDeleteWorkOrder,
    useWorkOrders,
    type WorkOrder,
    type WorkOrderStatus,
    type WorkOrderType,
} from "../api";
import WorkOrderDialog from "../components/WorkOrderDialog";
import LinkWorkOrderDialog from "../components/LinkWorkOrderDialog";
import WorkOrderContainersDialog from "../components/WorkOrderContainersDialog";

const STATUS_COLORS: Record<WorkOrderStatus, "success" | "default" | "error"> = {
    ACTIVE: "success",
    COMPLETED: "default",
    CANCELLED: "error",
};

const TYPE_COLORS: Record<WorkOrderType, "primary" | "secondary"> = {
    INCOMING: "primary",
    CODED: "secondary",
};

export default function WorkOrdersPage() {
    const [page, setPage] = useState(0);
    const [filterType, setFilterType] = useState<WorkOrderType | "">("");
    const [filterStatus, setFilterStatus] = useState<WorkOrderStatus | "">("");

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingWo, setEditingWo] = useState<WorkOrder | null>(null);

    const [linkDialogOpen, setLinkDialogOpen] = useState(false);
    const [linkingWo, setLinkingWo] = useState<WorkOrder | null>(null);

    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [viewingWo, setViewingWo] = useState<WorkOrder | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);

    const { data, isLoading, isError } = useWorkOrders({
        page: page + 1,
        order_type: filterType || undefined,
        status: filterStatus || undefined,
    });

    const deleteMutation = useDeleteWorkOrder();

    async function handleDelete(wo: WorkOrder) {
        const ok = window.confirm(`Удалить Н/З ${wo.order_number}?`);
        if (!ok) return;
        try {
            await deleteMutation.mutateAsync(wo.id);
            setMessage(`Н/З ${wo.order_number} удалён.`);
        } catch (err) {
            const anyErr = err as { response?: { data?: { error?: string } } };
            setError(anyErr?.response?.data?.error ?? "Не удалось удалить.");
        }
    }

    const columns: GridColDef<WorkOrder>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "order_number", headerName: "Номер Н/З", flex: 1, minWidth: 150 },
        {
            field: "order_type",
            headerName: "Тип",
            width: 160,
            renderCell: (params) => {
                const t = params.value as WorkOrderType;
                return <Chip size="small" label={WORK_ORDER_TYPE_LABELS[t]} color={TYPE_COLORS[t]} variant="outlined" />;
            },
        },
        {
            field: "linked_order_number",
            headerName: "Связан с",
            flex: 1,
            minWidth: 150,
            renderCell: (params) => {
                if (!params.value) return "—";
                return <Chip size="small" label={params.value} variant="outlined" color="default" />;
            },
        },
        {
            field: "site_name",
            headerName: "Участок",
            flex: 1,
            minWidth: 130,
            valueGetter: (value) => value || "—",
        },
        {
            field: "status",
            headerName: "Статус",
            width: 120,
            renderCell: (params) => {
                const s = params.value as WorkOrderStatus;
                return <Chip size="small" label={WORK_ORDER_STATUS_LABELS[s]} color={STATUS_COLORS[s]} />;
            },
        },
        {
            field: "samples_count",
            headerName: "Проб",
            width: 100,
            type: "number",
            align: "right",
            headerAlign: "right",
        },
        {
            field: "actions",
            headerName: "",
            width: 180,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Показать тары">
                        <IconButton
                            size="small"
                            color="info"
                            onClick={() => {
                                setViewingWo(params.row);
                                setViewDialogOpen(true);
                            }}
                        >
                            <VisibilityIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Связать с другим Н/З">
                        <span>
                            <IconButton
                                size="small"
                                color="primary"
                                disabled={!!params.row.linked_order}
                                onClick={() => {
                                    setLinkingWo(params.row);
                                    setLinkDialogOpen(true);
                                }}
                            >
                                <LinkIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <IconButton
                            size="small"
                            onClick={() => {
                                setEditingWo(params.row);
                                setDialogOpen(true);
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() => void handleDelete(params.row)}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            ),
        },
    ];

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h2" component="h1">Наряд-заказы</Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                        setEditingWo(null);
                        setDialogOpen(true);
                    }}
                >
                    Создать Н/З
                </Button>
            </Box>

            <Box sx={{ mb: 2, display: "flex", gap: 2 }}>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Тип</InputLabel>
                    <Select
                        label="Тип"
                        value={filterType}
                        onChange={(e) => {
                            setFilterType(e.target.value as WorkOrderType | "");
                            setPage(0);
                        }}
                    >
                        <MenuItem value="">Все</MenuItem>
                        <MenuItem value="INCOMING">Входящий</MenuItem>
                        <MenuItem value="CODED">Текущий</MenuItem>
                    </Select>
                </FormControl>

                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Статус</InputLabel>
                    <Select
                        label="Статус"
                        value={filterStatus}
                        onChange={(e) => {
                            setFilterStatus(e.target.value as WorkOrderStatus | "");
                            setPage(0);
                        }}
                    >
                        <MenuItem value="">Все</MenuItem>
                        <MenuItem value="ACTIVE">Активен</MenuItem>
                        <MenuItem value="COMPLETED">Завершён</MenuItem>
                        <MenuItem value="CANCELLED">Отменён</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box sx={{ height: 600, width: "100%", bgcolor: "background.paper", borderRadius: 1 }}>
                <DataGrid
                    rows={data?.results ?? []}
                    columns={columns}
                    loading={isLoading}
                    rowCount={data?.count ?? 0}
                    paginationMode="server"
                    paginationModel={{ page, pageSize: 50 }}
                    onPaginationModelChange={(m) => setPage(m.page)}
                    pageSizeOptions={[50]}
                    disableRowSelectionOnClick
                    disableColumnFilter
                    disableColumnSelector
                    disableDensitySelector
                />
            </Box>

            {isError && <Alert severity="error" sx={{ mt: 2 }}>Ошибка загрузки Н/З.</Alert>}

            <WorkOrderDialog
                open={dialogOpen}
                workOrder={editingWo}
                onClose={() => setDialogOpen(false)}
                onSuccess={(msg) => setMessage(msg)}
            />

            <LinkWorkOrderDialog
                open={linkDialogOpen}
                workOrder={linkingWo}
                onClose={() => setLinkDialogOpen(false)}
                onSuccess={(msg) => setMessage(msg)}
            />

            <WorkOrderContainersDialog
                open={viewDialogOpen}
                workOrder={viewingWo}
                onClose={() => setViewDialogOpen(false)}
            />

            <Snackbar open={!!message} autoHideDuration={6000} onClose={() => setMessage(null)} message={message ?? ""} />
            <Snackbar open={!!error} autoHideDuration={8000} onClose={() => setError(null)} message={error ?? ""} />
        </Box>
    );
}