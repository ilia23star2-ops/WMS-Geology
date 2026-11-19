/**
 * Список пакетов OCR (серверных), светлый стиль web.
 * c-3.x-migration-5c; 6e-3-web-rework: загрузка живёт в «Сессии оцифровки».
 * 6e-3-backend-3: колонка «Имя» с inline-переименованием (PATCH /batches/{id}/).
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    Chip,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import GridOnIcon from "@mui/icons-material/GridOn";
import EditIcon from "@mui/icons-material/Edit";
import {
    DataGrid,
    type GridColDef,
    type GridPaginationModel,
} from "@mui/x-data-grid";

import {
    OCR_BATCH_STATUS_LABELS,
    useOcrBatches,
    useRenameOcrBatch,
    type OcrBatch,
    type OcrBatchStatus,
} from "../api/ocr";
import { displayBatchName } from "../utils/batchName";

const BATCH_STATUS_COLORS: Record<
    OcrBatchStatus,
    "default" | "info" | "success" | "warning" | "error"
> = {
    DRAFT: "default",
    SENT: "info",
    UPLOADING: "info",
    PROCESSING: "info",
    REVIEW: "warning",
    COMPLETED: "success",
    FAILED: "error",
};

export default function OcrBatchesPage() {
    const navigate = useNavigate();
    const { data, isLoading } = useOcrBatches();
    const rename = useRenameOcrBatch();
    const [statusFilter, setStatusFilter] = useState<OcrBatchStatus | "">("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editingName, setEditingName] = useState("");
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: 25,
    });

    const rows = useMemo(() => {
        const all = data?.results ?? [];
        return statusFilter ? all.filter((b) => b.status === statusFilter) : all;
    }, [data, statusFilter]);

    const commitRename = (id: number) => {
        rename.mutate({ id, name: editingName.trim() });
        setEditingId(null);
    };

    const columns: GridColDef<OcrBatch>[] = [
        { field: "id", headerName: "#", width: 80, renderCell: (p) => `#${p.value}` },
        {
            field: "name",
            headerName: "Имя",
            width: 260,
            sortable: false,
            renderCell: (p) =>
                editingId === p.row.id ? (
                    <TextField
                        size="small"
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(p.row.id);
                            if (e.key === "Escape") setEditingId(null);
                        }}
                        onBlur={() => commitRename(p.row.id)}
                        sx={{ width: "100%" }}
                    />
                ) : (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, width: "100%" }}>
                        <Typography sx={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {displayBatchName(p.row.name, p.row.id)}
                        </Typography>
                        <Tooltip title="Переименовать">
                            <IconButton
                                size="small"
                                onClick={() => {
                                    setEditingId(p.row.id);
                                    setEditingName(p.row.name ?? "");
                                }}
                            >
                                <EditIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                ),
        },
        { field: "user", headerName: "Пользователь", width: 160, valueGetter: (_v, row) => `id=${row.user}` },
        {
            field: "status",
            headerName: "Статус",
            width: 180,
            renderCell: (p) => (
                <Chip label={OCR_BATCH_STATUS_LABELS[p.row.status]} color={BATCH_STATUS_COLORS[p.row.status]} size="small" />
            ),
        },
        { field: "tasks_count", headerName: "Задач", width: 100, valueGetter: (_v, row) => row.tasks?.length ?? 0 },
        { field: "created_at", headerName: "Создан", width: 180, valueGetter: (v) => (v ? new Date(v).toLocaleString("ru-RU") : "—") },
        {
            field: "actions",
            headerName: "",
            width: 140,
            sortable: false,
            renderCell: (p) => (
                <Button size="small" onClick={() => navigate(`/ocr/batches/${p.row.id}`)}>
                    Открыть
                </Button>
            ),
        },
    ];

    return (
        <Box sx={{ p: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2, gap: 1, flexWrap: "wrap" }}>
                <Typography variant="h5">Пакеты OCR</Typography>
                <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                    <Button variant="contained" startIcon={<GridOnIcon />} onClick={() => navigate("/ocr/session")}>
                        Сессия оцифровки
                    </Button>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Статус</InputLabel>
                        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as OcrBatchStatus | "")} label="Статус">
                            <MenuItem value="">Все</MenuItem>
                            {(Object.entries(OCR_BATCH_STATUS_LABELS) as [OcrBatchStatus, string][]).map(([k, l]) => (
                                <MenuItem key={k} value={k}>{l}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
            </Box>
            <Box sx={{ height: "calc(100vh - 200px)", width: "100%" }}>
                <DataGrid
                    rows={rows}
                    columns={columns}
                    loading={isLoading}
                    rowHeight={48}
                    paginationModel={paginationModel}
                    onPaginationModelChange={setPaginationModel}
                    pageSizeOptions={[10, 25, 50]}
                    disableRowSelectionOnClick
                />
            </Box>
        </Box>
    );
}