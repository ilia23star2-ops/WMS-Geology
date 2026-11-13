/**
 * Список пакетов OCR.
 *
 * c-3.x-migration-5c. Открывается из sidebar «Оцифровка».
 * Client-side пагинация и фильтр по статусу.
 *
 * MUI 9: без <Stack justifyContent=...> — используем Box display:flex.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Box,
    Button,
    Chip,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Typography,
} from "@mui/material";
import {
    DataGrid,
    type GridColDef,
    type GridPaginationModel,
} from "@mui/x-data-grid";

import {
    OCR_BATCH_STATUS_LABELS,
    useOcrBatches,
    type OcrBatch,
    type OcrBatchStatus,
} from "../api/ocr";

const BATCH_STATUS_COLORS: Record<
    OcrBatchStatus,
    "default" | "info" | "success" | "warning" | "error"
> = {
    DRAFT: "default",
    UPLOADING: "info",
    PROCESSING: "info",
    REVIEW: "warning",
    COMPLETED: "success",
    FAILED: "error",
};

export default function OcrBatchesPage() {
    const navigate = useNavigate();
    const { data, isLoading } = useOcrBatches();
    const [statusFilter, setStatusFilter] = useState<OcrBatchStatus | "">("");
    const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
        page: 0,
        pageSize: 25,
    });

    const rows = useMemo(() => {
        const all = data?.results ?? [];
        return statusFilter
            ? all.filter((b) => b.status === statusFilter)
            : all;
    }, [data, statusFilter]);

    const columns: GridColDef<OcrBatch>[] = [
        {
            field: "id",
            headerName: "#",
            width: 80,
            renderCell: (p) => `#${p.value}`,
        },
        {
            field: "user",
            headerName: "Пользователь",
            width: 160,
            valueGetter: (_v, row) => `id=${row.user}`,
        },
        {
            field: "status",
            headerName: "Статус",
            width: 180,
            renderCell: (p) => (
                <Chip
                    label={OCR_BATCH_STATUS_LABELS[p.row.status]}
                    color={BATCH_STATUS_COLORS[p.row.status]}
                    size="small"
                />
            ),
        },
        {
            field: "tasks_count",
            headerName: "Задач",
            width: 100,
            valueGetter: (_v, row) => row.tasks?.length ?? 0,
        },
        {
            field: "created_at",
            headerName: "Создан",
            width: 180,
            valueGetter: (v) => (v ? new Date(v).toLocaleString("ru-RU") : "—"),
        },
        {
            field: "actions",
            headerName: "",
            width: 140,
            sortable: false,
            renderCell: (p) => (
                <Button
                    size="small"
                    onClick={() => navigate(`/ocr/batches/${p.row.id}`)}
                >
                    Открыть
                </Button>
            ),
        },
    ];

    return (
        <Box sx={{ p: 2 }}>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                }}
            >
                <Typography variant="h5">Пакеты OCR</Typography>
                <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Статус</InputLabel>
                    <Select
                        value={statusFilter}
                        onChange={(e) =>
                            setStatusFilter(e.target.value as OcrBatchStatus | "")
                        }
                        label="Статус"
                    >
                        <MenuItem value="">Все</MenuItem>
                        {(
                            Object.entries(OCR_BATCH_STATUS_LABELS) as [
                                OcrBatchStatus,
                                string,
                            ][]
                        ).map(([key, label]) => (
                            <MenuItem key={key} value={key}>
                                {label}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
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