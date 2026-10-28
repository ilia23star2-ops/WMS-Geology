/**
 * Страница разбора задач на актуализацию (3.x-offline-sync-d-2).
 *
 * По умолчанию — только PENDING. Чекбокс «Показать все» — все статусы.
 * Кнопка «Разобрать» в строке → диалог с diff server_value / mobile_value
 * и 3 действиями: принять с устройства / оставить на сервере / отклонить.
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    Pagination,
    Radio,
    RadioGroup,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
    ACTUALIZATION_RESOLUTION_LABELS,
    ACTUALIZATION_TASK_TYPE_LABELS,
    useActualizationTasks,
    useResolveActualizationTask,
    type ActualizationResolution,
    type ActualizationTask,
    type ResolveAction,
} from "../api";

const PAGE_SIZE = 50;

// ------------------------------------------------------------
// Локализация
// ------------------------------------------------------------
const FIELD_LABELS: Record<string, string> = {
    status: "Статус",
    container_number: "Номер тары",
    container_type_id: "Тип тары (ID)",
    container_type: "Тип тары",
    pallet_id: "Поддон (ID)",
    floor_room_id: "Комната (ID)",
    sample_count: "Проб в таре",
    created_samples: "Создано проб",
    cell_id: "Ячейка (ID)",
    matched: "Совпадает",
    note: "Комментарий",
    updated_at: "Изменено",
    expected_updated_at: "Ожидалось обновление",
    pick_list_item_id: "Проба (выборка)",
    receipt_id: "Партия приёмки",
    device_id: "Устройство",
    operation_id: "Операция",
};

// Упрощённые названия сущностей — как их видит человек.
const ENTITY_TYPE_LABELS: Record<string, string> = {
    Container: "Тара",
    Sample: "Проба",
    ReceiptItem: "Тара (приёмка)",   // в приёмке ReceiptItem — это тара
    PickListItem: "Проба (выборка)", // в выборке PickListItem — это проба
    Receipt: "Партия приёмки",
    PickList: "Список выборки",
};

const STATUS_LABELS: Record<string, string> = {
    // Container
    PENDING_FILLING: "Ожидает заполнения",
    PENDING_PLACEMENT: "Ожидает размещения",
    ACTIVE: "Активна",
    IN_TRANSIT: "В пути",
    ISSUED: "Выдана",
    // Sample
    IN_STORAGE: "На хранении",
    CONSUMED: "Израсходована",
    DISPOSED: "Утилизирована",
    SELECTED: "Выбрана",
    // ReceiptItem
    EXPECTED: "Ожидается",
    MATCHED: "Совпадает",
    DISCREPANCY: "Расхождение",
    MISSING: "Отсутствует",
    EXTRA: "Лишняя",
    PENDING_DECRYPTION: "Ожидает расшифровки",
    // PickListItem
    PENDING: "Ожидает",
    PICKED: "Извлечена",
    NOT_FOUND: "Не найдена",
    SENT: "Отправлена",
    // Shipment
    DRAFT: "Черновик",
    ASSEMBLED: "Собран",
    RECEIVED: "Принят",
    PARTIALLY_RECEIVED: "Принят с расхождениями",
    RETURNED: "Возвращён",
    CANCELLED: "Отменён",
    LOST: "Утерян",
    // Receipt
    IN_PROGRESS: "В работе",
    CONFIRMED: "Подтверждена",
};

function translateField(key: string): string {
    return FIELD_LABELS[key] ?? key;
}

function translateEntity(entityType: string, entityId: number | null): string {
    const base = ENTITY_TYPE_LABELS[entityType] ?? entityType;
    return entityId !== null ? `${base} #${entityId}` : base;
}

function translateValue(key: string, value: unknown): string {
    if (value === null || value === undefined) return "—";
    if (typeof value === "boolean") return value ? "Да" : "Нет";
    if (typeof value === "object") return JSON.stringify(value);
    const str = String(value);
    if (key === "status" || key in FIELD_LABELS) {
        if (str in STATUS_LABELS) return STATUS_LABELS[str];
    }
    if (str in STATUS_LABELS) return STATUS_LABELS[str];
    return str;
}

// ------------------------------------------------------------
// Чипы
// ------------------------------------------------------------
function taskTypeChip(task: ActualizationTask) {
    return (
        <Chip
            size="small"
            label={ACTUALIZATION_TASK_TYPE_LABELS[task.task_type] ?? task.task_type_display}
            color="warning"
            variant="outlined"
        />
    );
}

function resolutionChip(task: ActualizationTask) {
    const colors: Record<ActualizationResolution, "default" | "success" | "info" | "warning"> = {
        PENDING: "warning",
        ACCEPT_MOBILE: "success",
        KEEP_SERVER: "info",
        REJECTED: "default",
    };
    return (
        <Chip
            size="small"
            label={ACTUALIZATION_RESOLUTION_LABELS[task.resolution] ?? task.resolution_display}
            color={colors[task.resolution] ?? "default"}
        />
    );
}

function formatDate(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
        });
    } catch {
        return value;
    }
}

// ------------------------------------------------------------
// Diff
// ------------------------------------------------------------
interface DiffRow {
    key: string;
    label: string;
    from: string;
    to: string;
}

function buildDiff(task: ActualizationTask): DiffRow[] {
    const server = (task.server_value ?? {}) as Record<string, unknown>;
    const mobile = (task.mobile_value ?? {}) as Record<string, unknown>;
    const keys = new Set([...Object.keys(server), ...Object.keys(mobile)]);
    const result: DiffRow[] = [];
    for (const key of keys) {
        const from = translateValue(key, server[key]);
        const to = translateValue(key, mobile[key]);
        if (from === to) continue;
        result.push({
            key,
            label: translateField(key),
            from,
            to,
        });
    }
    return result;
}

// ------------------------------------------------------------
// Компонент
// ------------------------------------------------------------
export default function ActualizationPage() {
    const [page, setPage] = useState(1);
    const [showAll, setShowAll] = useState(false);

    const params = useMemo(
        () => ({
            page,
            resolution: showAll ? undefined : ("PENDING" as ActualizationResolution),
        }),
        [page, showAll],
    );

    const tasksQuery = useActualizationTasks(params);
    const resolveMutation = useResolveActualizationTask();

    const [selected, setSelected] = useState<ActualizationTask | null>(null);
    const [action, setAction] = useState<ResolveAction>("accept_mobile");
    const [note, setNote] = useState("");
    const [resolveError, setResolveError] = useState<string | null>(null);

    const tasks = tasksQuery.data?.results ?? [];
    const total = tasksQuery.data?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    function openResolve(task: ActualizationTask) {
        setSelected(task);
        setAction("accept_mobile");
        setNote("");
        setResolveError(null);
    }

    function closeResolve() {
        if (resolveMutation.isPending) return;
        setSelected(null);
        setResolveError(null);
    }

    async function handleResolve() {
        if (!selected) return;
        setResolveError(null);
        try {
            await resolveMutation.mutateAsync({
                id: selected.id,
                payload: { action, note: note.trim() },
            });
            setSelected(null);
        } catch (err) {
            const anyErr = err as { response?: { data?: { error?: string; detail?: string } } };
            const msg =
                anyErr?.response?.data?.error
                ?? anyErr?.response?.data?.detail
                ?? "Не удалось разобрать задачу.";
            setResolveError(msg);
        }
    }

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h2" component="h1">
                    Задачи на актуализацию
                </Typography>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                    <FormControlLabel
                        control={
                            <input
                                type="checkbox"
                                checked={showAll}
                                onChange={(e) => {
                                    setShowAll(e.target.checked);
                                    setPage(1);
                                }}
                            />
                        }
                        label="Показать все (включая разобранные)"
                    />
                    <Button
                        startIcon={<RefreshIcon />}
                        onClick={() => void tasksQuery.refetch()}
                        disabled={tasksQuery.isFetching}
                    >
                        Обновить
                    </Button>
                </Stack>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
                Задачи создаются автоматически при офлайн-импорте, когда данные
                устройства расходятся с сервером. Разберите каждую: принять данные
                с устройства, оставить данные сервера или отклонить (закрыть без
                изменений).
            </Alert>

            <Card>
                <CardContent sx={{ p: 0 }}>
                    {tasksQuery.isLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : tasks.length === 0 ? (
                        <Box sx={{ p: 4, textAlign: "center" }}>
                            <CheckCircleIcon color="success" sx={{ fontSize: 48, mb: 1 }} />
                            <Typography variant="body1">
                                {showAll
                                    ? "Задач нет."
                                    : "Неразобранных задач нет — всё в порядке."}
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ width: 160, whiteSpace: "nowrap" }}>
                                            Создана
                                        </TableCell>
                                        <TableCell sx={{ width: 240 }}>Что расходится</TableCell>
                                        <TableCell sx={{ width: 220 }}>Объект</TableCell>
                                        <TableCell sx={{ width: 180 }}>Статус</TableCell>
                                        <TableCell sx={{ width: 200 }}>Разобрал</TableCell>
                                        <TableCell align="right" sx={{ width: 140 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tasks.map((task) => (
                                        <TableRow key={task.id} hover>
                                            <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                                {formatDate(task.created_at)}
                                            </TableCell>
                                            <TableCell>{taskTypeChip(task)}</TableCell>
                                            <TableCell sx={{ fontSize: 13 }}>
                                                {translateEntity(task.entity_type, task.entity_id)}
                                            </TableCell>
                                            <TableCell>{resolutionChip(task)}</TableCell>
                                            <TableCell sx={{ fontSize: 13 }}>
                                                {task.resolved_by_username ?? "—"}
                                                {task.resolved_at && (
                                                    <Typography variant="caption" color="text.secondary" component="div">
                                                        {formatDate(task.resolved_at)}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                {task.resolution === "PENDING" && (
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        startIcon={<WarningAmberIcon />}
                                                        onClick={() => openResolve(task)}
                                                    >
                                                        Разобрать
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {totalPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_e, p) => setPage(p)}
                        color="primary"
                    />
                </Box>
            )}

            {/* Диалог разбора */}
            <Dialog open={selected !== null} onClose={closeResolve} maxWidth="md" fullWidth>
                <DialogTitle>
                    Разбор задачи #{selected?.id}
                </DialogTitle>
                <DialogContent dividers>
                    {selected && (
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Что расходится
                                </Typography>
                                <Typography variant="body1">
                                    {taskTypeChip(selected)}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Объект
                                </Typography>
                                <Typography variant="body1">
                                    {translateEntity(selected.entity_type, selected.entity_id)}
                                </Typography>
                            </Box>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Что именно расходится
                                </Typography>
                                {(() => {
                                    const diff = buildDiff(selected);
                                    if (diff.length === 0) {
                                        return (
                                            <Typography variant="body2" color="text.secondary">
                                                Различий в полях нет (возможно, объект удалён
                                                или изменён полностью).
                                            </Typography>
                                        );
                                    }
                                    return (
                                        <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ width: 220 }}>Поле</TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                size="small"
                                                                label="Сервер"
                                                                variant="outlined"
                                                                sx={{ fontSize: 11 }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                size="small"
                                                                label="С устройства"
                                                                variant="outlined"
                                                                color="success"
                                                                sx={{ fontSize: 11 }}
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {diff.map((d) => (
                                                        <TableRow key={d.key}>
                                                            <TableCell sx={{ fontSize: 13 }}>
                                                                {d.label}
                                                            </TableCell>
                                                            <TableCell sx={{ fontFamily: "monospace", fontSize: 12, color: "#c62828" }}>
                                                                {d.from}
                                                            </TableCell>
                                                            <TableCell sx={{ fontFamily: "monospace", fontSize: 12, color: "#2e7d32" }}>
                                                                {d.to}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    );
                                })()}
                            </Box>

                            <Divider />

                            <Box>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                    Что сделать
                                </Typography>
                                <RadioGroup
                                    value={action}
                                    onChange={(e) => setAction(e.target.value as ResolveAction)}
                                >
                                    <FormControlLabel
                                        value="accept_mobile"
                                        control={<Radio />}
                                        label="Принять данные с устройства (что видел кладовщик)"
                                    />
                                    <FormControlLabel
                                        value="keep_server"
                                        control={<Radio />}
                                        label="Оставить данные сервера (отклонить данные с устройства)"
                                    />
                                    <FormControlLabel
                                        value="reject"
                                        control={<Radio />}
                                        label="Отклонить задачу (ложное срабатывание — закрыть без изменений)"
                                    />
                                </RadioGroup>
                            </Box>

                            <TextField
                                label="Комментарий (опционально)"
                                size="small"
                                fullWidth
                                multiline
                                minRows={2}
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                slotProps={{ htmlInput: { maxLength: 2000 } }}
                            />

                            {resolveError && <Alert severity="error">{resolveError}</Alert>}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={closeResolve} disabled={resolveMutation.isPending}>
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleResolve()}
                        disabled={resolveMutation.isPending}
                    >
                        {resolveMutation.isPending ? "Сохраняем..." : "Разобрать"}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}