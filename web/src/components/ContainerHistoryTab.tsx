/**
 * Вкладка «История» в ContainerPreviewDialog (2f-14b).
 *
 * Таблица событий (2f-14a): дата, кто, действие, diff old → new
 * по ключам snapshot. Формат snapshot: см. backend
 * `_container_snapshot` (status, container_number, container_type_id,
 * pallet_id, floor_room_id, sample_count).
 */
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import AddCircleIcon from "@mui/icons-material/AddCircle";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PlaceIcon from "@mui/icons-material/Place";
import AddBoxIcon from "@mui/icons-material/AddBox";
import { ReactElement } from "react";

import {
    CONTAINER_STATUS_LABELS,
    useContainerHistory,
    type ContainerHistoryEntry,
    type ContainerStatus,
} from "../api";

interface ContainerHistoryTabProps {
    containerId: number | null;
}

// Человеческие метки для ключей snapshot.
const KEY_LABELS: Record<string, string> = {
    status: "Статус",
    container_number: "Номер",
    container_type_id: "Тип тары",
    pallet_id: "Поддон",
    floor_room_id: "Комната (пол)",
    sample_count: "Проб в таре",
    created_samples: "Создано проб",
    cell_id: "Ячейка",
};

// Иконки и цвета для действий.
const ACTION_VISUALS: Record<
    string,
    { icon: ReactElement; color: "success" | "info" | "error" | "warning" | "default" }
> = {
    CREATE: { icon: <AddCircleIcon fontSize="small" color="success" />, color: "success" },
    UPDATE: { icon: <EditIcon fontSize="small" color="info" />, color: "info" },
    DELETE: { icon: <DeleteIcon fontSize="small" color="error" />, color: "error" },
    FILL_SAMPLES: { icon: <Inventory2Icon fontSize="small" color="warning" />, color: "warning" },
    PLACE: { icon: <PlaceIcon fontSize="small" color="primary" />, color: "info" },
    CREATE_IN_CELL: { icon: <AddBoxIcon fontSize="small" color="success" />, color: "success" },
};

function formatDate(value: string): string {
    try {
        return new Date(value).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "medium",
        });
    } catch {
        return value;
    }
}

// Значение поля: null → "—"; статус → русская метка.
function formatValue(key: string, value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (key === "status" && typeof value === "string") {
        return CONTAINER_STATUS_LABELS[value as ContainerStatus] ?? value;
    }
    return String(value);
}

interface DiffRow {
    key: string;
    label: string;
    from: string;
    to: string;
}

// Diff по ключам old_value / new_value. Только изменённые поля.
function buildDiff(log: ContainerHistoryEntry): DiffRow[] {
    const oldVal = (log.old_value ?? {}) as Record<string, unknown>;
    const newVal = (log.new_value ?? {}) as Record<string, unknown>;
    const keys = new Set([...Object.keys(oldVal), ...Object.keys(newVal)]);
    const result: DiffRow[] = [];
    for (const key of keys) {
        const from = formatValue(key, oldVal[key]);
        const to = formatValue(key, newVal[key]);
        if (from === to) continue;
        result.push({
            key,
            label: KEY_LABELS[key] ?? key,
            from,
            to,
        });
    }
    return result;
}

export default function ContainerHistoryTab({ containerId }: ContainerHistoryTabProps) {
    const { data, isLoading, isError } = useContainerHistory(containerId);

    if (containerId === null) {
        return (
            <Box sx={{ p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                    Тара не загружена.
                </Typography>
            </Box>
        );
    }

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    if (isError) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="error">Не удалось загрузить историю.</Alert>
            </Box>
        );
    }

    const logs = data ?? [];

    if (logs.length === 0) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="info">Записей пока нет.</Alert>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ whiteSpace: "nowrap", width: 160 }}>Когда</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", width: 140 }}>Кто</TableCell>
                            <TableCell sx={{ whiteSpace: "nowrap", width: 200 }}>Действие</TableCell>
                            <TableCell>Изменения</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {logs.map((log: ContainerHistoryEntry) => {
                            const visual = ACTION_VISUALS[log.action];
                            const diff = buildDiff(log);
                            return (
                                <TableRow key={log.id} hover>
                                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12, whiteSpace: "nowrap" }}>
                                        {formatDate(log.created_at)}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: 13 }}>
                                        {log.username ?? <i>система</i>}
                                    </TableCell>
                                    <TableCell>
                                        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                                            {visual?.icon}
                                            <Chip
                                                size="small"
                                                label={log.action_display}
                                                color={visual?.color ?? "default"}
                                                variant="outlined"
                                                sx={{ height: 22, fontSize: 11 }}
                                            />
                                        </Stack>
                                    </TableCell>
                                    <TableCell>
                                        {diff.length === 0 ? (
                                            <Typography variant="caption" color="text.secondary">
                                                без изменений полей
                                            </Typography>
                                        ) : (
                                            <Stack spacing={0.25}>
                                                {diff.map((d) => (
                                                    <Typography
                                                        key={d.key}
                                                        variant="body2"
                                                        sx={{ fontSize: 12, fontFamily: "monospace" }}
                                                    >
                                                        <span style={{ color: "#666" }}>{d.label}:</span>{" "}
                                                        <span style={{ color: "#c62828" }}>{d.from}</span>
                                                        {" → "}
                                                        <span style={{ color: "#2e7d32" }}>{d.to}</span>
                                                    </Typography>
                                                ))}
                                            </Stack>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}