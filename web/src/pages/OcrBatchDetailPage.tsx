/**
 * Детали пакета OCR: список задач + переход на проверку.
 *
 * c-3.x-migration-5c.
 * c-3.x-migration-6e-2-web: кнопка «Тара» — открыть созданную тару.
 * c-3.x-migration-6e-2-web-fix8: «Тара» — иконка с подсказкой, ведёт по
 *   deep-link /containers?open=<id> и сразу открывает карточку тары.
 * MUI 9: без <Stack justifyContent=...> — используем Box display:flex.
 */
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import Inventory2Icon from "@mui/icons-material/Inventory2";

import { displayBatchName } from "../utils/batchName";

import {
    approvedContainerId,
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
                        {displayBatchName(data.name, data.id)} — {OCR_BATCH_STATUS_LABELS[data.status]}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        #{data.id} · Создан: {new Date(data.created_at).toLocaleString("ru-RU")}
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
                        {data.tasks.map((t) => {
                            const containerId = approvedContainerId(t);
                            return (
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
                                        <Box
                                            sx={{
                                                display: "flex",
                                                gap: 1,
                                                justifyContent: "flex-end",
                                                alignItems: "center",
                                            }}
                                        >
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
                                            {containerId !== null && (
                                                <Tooltip title={`Открыть тару #${containerId}`}>
                                                    <IconButton
                                                        size="small"
                                                        color="primary"
                                                        aria-label={`Открыть тару #${containerId}`}
                                                        onClick={() =>
                                                            navigate(`/containers?open=${containerId}`)
                                                        }
                                                    >
                                                        <Inventory2Icon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            )}
        </Box>
    );
}