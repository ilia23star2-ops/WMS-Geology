/**
 * Детали пакета OCR: список задач + переход на проверку.
 *
 * c-3.x-migration-5c.
 * MUI 9: без <Stack justifyContent=...> — используем Box display:flex.
 */
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";

import {
    OCR_BATCH_STATUS_LABELS,
    OCR_TASK_STATUS_LABELS,
    resolveImageUrl,
    useOcrBatch,
    type OcrTaskStatus,
} from "../api/ocr";

const TASK_STATUS_COLORS: Record<
    OcrTaskStatus,
    "default" | "info" | "success" | "warning" | "error"
> = {
    PENDING: "default",
    PROCESSING: "info",
    READY: "warning",
    DONE: "success",
    ERROR: "error",
};

export default function OcrBatchDetailPage() {
    const { id } = useParams<{ id: string }>();
    const batchId = id ? parseInt(id, 10) : null;
    const navigate = useNavigate();
    const { data, isLoading, error } = useOcrBatch(
        batchId && Number.isFinite(batchId) ? batchId : null,
    );

    if (isLoading) {
        return (
            <Box sx={{ p: 4, display: "flex", justifyContent: "center" }}>
                <CircularProgress />
            </Box>
        );
    }
    if (error || !data) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                Не удалось загрузить пакет.
            </Alert>
        );
    }

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
                <Box>
                    <Typography variant="h5">
                        Пакет #{data.id} — {OCR_BATCH_STATUS_LABELS[data.status]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Создан: {new Date(data.created_at).toLocaleString("ru-RU")}
                        {data.processed_at &&
                            ` · Обработан: ${new Date(data.processed_at).toLocaleString("ru-RU")}`}
                    </Typography>
                </Box>
                <Button onClick={() => navigate("/ocr/batches")}>← К списку</Button>
            </Box>

            {data.tasks.length === 0 ? (
                <Alert severity="info">В этом пакете нет задач.</Alert>
            ) : (
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>#</TableCell>
                            <TableCell>Статус</TableCell>
                            <TableCell>Фото</TableCell>
                            <TableCell>Создано</TableCell>
                            <TableCell align="right">Действия</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {data.tasks.map((t) => (
                            <TableRow key={t.id}>
                                <TableCell>#{t.id}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={OCR_TASK_STATUS_LABELS[t.status]}
                                        color={TASK_STATUS_COLORS[t.status]}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    {t.image ? (
                                        <img
                                            src={resolveImageUrl(t.image)}
                                            alt=""
                                            style={{
                                                maxHeight: 48,
                                                maxWidth: 80,
                                                borderRadius: 4,
                                            }}
                                        />
                                    ) : (
                                        "—"
                                    )}
                                </TableCell>
                                <TableCell>
                                    {new Date(t.created_at).toLocaleString("ru-RU")}
                                </TableCell>
                                <TableCell align="right">
                                    <Button
                                        size="small"
                                        variant={
                                            t.status === "READY" ? "contained" : "outlined"
                                        }
                                        disabled={t.status !== "READY"}
                                        onClick={() => navigate(`/ocr/review/${t.id}`)}
                                    >
                                        Проверить
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
        </Box>
    );
}