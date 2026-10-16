/**
 * Экран сверки приёмки (`/receiving/:id/check`).
 *
 * Верхний блок — неразобранные конфликты (`multi_date_match`).
 * Нижний блок — сверка тары: чекбокс «Приехала» + номер тары.
 *
 * «Сохранить сверку» — промежуточное сохранение.
 * «Завершить приёмку» — сначала сохраняет, потом завершает.
 * «Акт приёмки» (`3f-2`) — PDF в новой вкладке, только для
 * `CONFIRMED`-партии.
 * «Отменить партию» (`2f-5a-2`) — статус станет «Отменена».
 *
 * Ошибки от backend показываются в строках (под полем номера)
 * и общим Alert'ом.
 */
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    CircularProgress,
    Divider,
    FormHelperText,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import SaveIcon from "@mui/icons-material/Save";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { useNavigate, useParams } from "react-router-dom";

import {
    RECEIPT_ITEM_STATUS_LABELS,
    RECEIPT_STATUS_LABELS,
    fetchReceiptActBlob,
    useCancelReceipt,
    useCheckReceipt,
    useCompleteReceipt,
    useReceiptConflicts,
    useReceiptItems,
    useReceipts,
    useResolveConflicts,
    type ReceiptConflict,
    type ReceiptItem,
} from "../api";

interface MarkState {
    matched: boolean;
    containerNumber: string;
}

/**
 * Ошибка от backend (`{errors: [{item_id?, error}]}`).
 */
interface BackendErrorItem {
    item_id?: number;
    error?: string;
}

function extractErrors(err: unknown): {
    perItem: Record<number, string>;
    common: string[];
} {
    const perItem: Record<number, string> = {};
    const common: string[] = [];

    const anyErr = err as {
        response?: {
            data?: {
                errors?: BackendErrorItem[];
                error?: string;
                detail?: string;
            };
        };
    };

    const data = anyErr?.response?.data;
    const errors = data?.errors;
    if (Array.isArray(errors)) {
        for (const e of errors) {
            if (typeof e?.item_id === "number" && e.error) {
                perItem[e.item_id] = e.error;
            } else if (e?.error) {
                common.push(e.error);
            }
        }
        return { perItem, common };
    }

    if (typeof data?.error === "string") {
        common.push(data.error);
    } else if (typeof data?.detail === "string") {
        common.push(data.detail);
    } else {
        common.push("Не удалось выполнить. Проверьте данные.");
    }
    return { perItem, common };
}

/**
 * Извлекает текст ошибки из ответа, где тело — `Blob` (`3f-2`).
 */
async function extractBlobError(err: unknown): Promise<string | null> {
    const anyErr = err as { response?: { data?: unknown } };
    const data = anyErr?.response?.data;

    if (data instanceof Blob) {
        try {
            const text = await data.text();
            const json = JSON.parse(text) as { error?: string };
            return json.error ?? null;
        } catch {
            return null;
        }
    }

    if (data && typeof data === "object" && "error" in data) {
        return String((data as { error: unknown }).error);
    }
    return null;
}

function formatDateRu(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
        return new Date(iso).toLocaleDateString("ru-RU");
    } catch {
        return iso;
    }
}

// ============================================================
// Конфликт (одна карточка)
// ============================================================
interface ConflictCardProps {
    conflict: ReceiptConflict;
    onApply: (questionIndex: number, containersCount: number) => void;
    isPending: boolean;
    serverError: string | null;
}

function ConflictCard({
    conflict,
    onApply,
    isPending,
    serverError,
}: ConflictCardProps) {
    const [count, setCount] = useState<number>(conflict.suggested_count);

    useEffect(() => {
        setCount(conflict.suggested_count);
    }, [conflict.suggested_count, conflict.question_index]);

    const canApply = count >= 0 && count <= conflict.containers_count;

    return (
        <Card sx={{ mb: 2 }}>
            <CardContent>
                <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                        alignItems: "center",
                        flexWrap: "wrap",
                        rowGap: 1,
                        mb: 1,
                    }}
                >
                    <Typography variant="h3">
                        Конфликт #{conflict.question_index}
                    </Typography>
                    <Chip
                        size="small"
                        label="multi_date_match"
                        color="warning"
                        variant="outlined"
                    />
                </Stack>

                <Stack spacing={0.5} sx={{ mb: 2 }}>
                    <Typography variant="body2">
                        Лист: <b>{conflict.sheet}</b>
                    </Typography>
                    <Typography variant="body2">
                        Н/З: <b>{conflict.work_order}</b>
                    </Typography>
                    <Typography variant="body2">
                        Тип исследования: <b>{conflict.research_type}</b>
                    </Typography>
                    <Typography variant="body2">
                        Тип тары: <b>{conflict.container_type}</b>
                    </Typography>
                    <Typography variant="body2">
                        Всего в файле: <b>{conflict.containers_count}</b> тар
                    </Typography>
                    <Typography variant="body2">
                        Дата рейса: <b>{formatDateRu(conflict.target_date)}</b>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Все даты:{" "}
                        {conflict.raw_dates.map(formatDateRu).join(", ")}
                    </Typography>
                    {conflict.suggested_count !== conflict.containers_count && (
                        <Typography variant="body2" color="primary">
                            По истории приехало:{" "}
                            <b>{conflict.suggested_count}</b> из{" "}
                            {conflict.containers_count}
                        </Typography>
                    )}
                </Stack>

                {serverError && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                        {serverError}
                    </Alert>
                )}

                <Stack
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: "center" }}
                >
                    <TextField
                        label="Сколько пришло сегодня?"
                        type="number"
                        size="small"
                        value={count}
                        onChange={(e) =>
                            setCount(Math.max(0, Number(e.target.value) || 0))
                        }
                        slotProps={{
                            htmlInput: {
                                min: 0,
                                max: conflict.containers_count,
                            },
                        }}
                        sx={{ maxWidth: 240 }}
                    />
                    <Button
                        variant="contained"
                        startIcon={<CheckIcon />}
                        onClick={() =>
                            onApply(conflict.question_index, count)
                        }
                        disabled={!canApply || isPending}
                    >
                        {isPending ? "Применяем..." : "Применить"}
                    </Button>
                </Stack>
            </CardContent>
        </Card>
    );
}

// ============================================================
// Страница
// ============================================================
export default function ReceiptCheckPage() {
    const { id } = useParams<{ id: string }>();
    const shipmentId = id ? Number(id) : null;
    const navigate = useNavigate();

    const receipts = useReceipts({
        page: 1,
        filters: { shipment_id: shipmentId ?? undefined },
    });
    const receipt = receipts.data?.results[0] ?? null;
    const receiptId = receipt?.id ?? null;

    const conflicts = useReceiptConflicts(receiptId);
    const items = useReceiptItems({ page: 1, receiptId: receiptId ?? 0 });

    const resolveMutation = useResolveConflicts(receiptId ?? 0);
    const checkMutation = useCheckReceipt(receiptId ?? 0);
    const completeMutation = useCompleteReceipt(receiptId ?? 0);
    const cancelMutation = useCancelReceipt();

    const [marks, setMarks] = useState<Record<number, MarkState>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [commonErrors, setCommonErrors] = useState<string[]>([]);
    const [itemErrors, setItemErrors] = useState<Record<number, string>>({});
    const [conflictErrors, setConflictErrors] = useState<
        Record<number, string>
    >({});
    const [actLoading, setActLoading] = useState(false);

    const receiptItems: ReceiptItem[] = useMemo(
        () => items.data?.results ?? [],
        [items.data],
    );

    useEffect(() => {
        setMarks((prev) => {
            const next: Record<number, MarkState> = { ...prev };
            for (const it of receiptItems) {
                if (!next[it.id]) {
                    next[it.id] = {
                        matched: it.status === "MATCHED",
                        containerNumber:
                            it.expected_container_number
                            || it.container_number
                            || "",
                    };
                }
            }
            return next;
        });
    }, [receiptItems]);

    const conflictList: ReceiptConflict[] =
        conflicts.data?.conflicts ?? [];
    const hasConflicts = conflictList.length > 0;

    // ============================
    // Действия
    // ============================
    async function handleApplyConflict(
        questionIndex: number,
        containersCount: number,
    ) {
        setConflictErrors((prev) => ({ ...prev, [questionIndex]: "" }));
        try {
            await resolveMutation.mutateAsync({
                conflicts: [
                    {
                        question_index: questionIndex,
                        containers_count: containersCount,
                    },
                ],
            });
            setMessage("Конфликт разобран.");
            void conflicts.refetch();
            void items.refetch();
        } catch (err) {
            const { perItem, common } = extractErrors(err);
            const firstCommon = common[0] ?? "Не удалось применить.";
            setConflictErrors((prev) => ({
                ...prev,
                [questionIndex]: firstCommon,
            }));
            void perItem;
        }
    }

    function buildCheckPayload() {
        return receiptItems.map((it) => {
            const m = marks[it.id];
            return {
                item_id: it.id,
                matched: m?.matched ?? false,
                container_number:
                    (m?.containerNumber ?? "").trim() || null,
            };
        });
    }

    async function handleSave() {
        setMessage(null);
        setCommonErrors([]);
        setItemErrors({});
        try {
            const res = await checkMutation.mutateAsync({
                items: buildCheckPayload(),
            });
            setMessage(
                `Сохранено. Совпадает: ${res.matched_count}, `
                + `отсутствует: ${res.missing_count}.`,
            );
            void items.refetch();
        } catch (err) {
            const { perItem, common } = extractErrors(err);
            setItemErrors(perItem);
            setCommonErrors(common);
            if (Object.keys(perItem).length > 0 && common.length === 0) {
                setCommonErrors([
                    "Не удалось сохранить часть строк. "
                    + "Смотрите ошибки в таблице.",
                ]);
            }
        }
    }

    async function handleComplete() {
        setMessage(null);
        setCommonErrors([]);
        setItemErrors({});

        const uncheckedCount = receiptItems.filter(
            (it) => !(marks[it.id]?.matched ?? false),
        ).length;

        if (uncheckedCount > 0) {
            const ok = window.confirm(
                `Не отмечено как «приехала»: ${uncheckedCount} тар. `
                + "Они будут помечены как отсутствующие. Продолжить?",
            );
            if (!ok) return;
        }

        try {
            await checkMutation.mutateAsync({
                items: buildCheckPayload(),
            });
            const res = await completeMutation.mutateAsync();
            setMessage(
                `Приёмка завершена. Статус: ${res.status}. `
                + `Рейс: ${res.shipment_status ?? "—"}.`,
            );
            setTimeout(() => navigate(`/receiving/${shipmentId}`), 800);
        } catch (err) {
            const { perItem, common } = extractErrors(err);
            setItemErrors(perItem);
            setCommonErrors(common);
            if (Object.keys(perItem).length > 0 && common.length === 0) {
                setCommonErrors([
                    "Не удалось завершить: часть строк с ошибками. "
                    + "Смотрите ошибки в таблице.",
                ]);
            }
        }
    }

    async function handleOpenAct() {
        if (!receiptId) return;
        setMessage(null);
        setCommonErrors([]);
        setActLoading(true);
        try {
            const blob = await fetchReceiptActBlob(receiptId);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            const blobErr = await extractBlobError(err);
            setCommonErrors([blobErr ?? "Не удалось открыть акт приёмки."]);
        } finally {
            setActLoading(false);
        }
    }

    async function handleCancelReceipt() {
        if (!receipt) return;
        const ok = window.confirm(
            `Отменить партию ${receipt.receipt_number}? `
            + "Статус станет «Отменена».",
        );
        if (!ok) return;
        setMessage(null);
        setCommonErrors([]);
        try {
            await cancelMutation.mutateAsync(receipt.id);
            setMessage(`Партия ${receipt.receipt_number} отменена.`);
            setTimeout(() => navigate(`/receiving/${shipmentId}`), 800);
        } catch (err) {
            const { common } = extractErrors(err);
            setCommonErrors(
                common.length > 0
                    ? common
                    : ["Не удалось отменить партию."],
            );
        }
    }

    // ============================
    // Рендер
    // ============================
    if (receipts.isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (receipts.isError || !receipt) {
        return (
            <Box>
                <Typography color="error">
                    У рейса нет партии приёмки.
                </Typography>
                <Button
                    onClick={() => navigate("/receiving")}
                    sx={{ mt: 2 }}
                >
                    К списку рейсов
                </Button>
            </Box>
        );
    }

    const completeDisabled =
        completeMutation.isPending
        || checkMutation.isPending
        || hasConflicts
        || receiptItems.length === 0;

    const completeTooltip = hasConflicts
        ? "Сначала разберите конфликты"
        : "";

    const actDisabled =
        receipt.status !== "CONFIRMED" || actLoading;

    const actTooltip =
        receipt.status === "CONFIRMED"
            ? "Открыть PDF «Акт приёмки» в новой вкладке"
            : "Акт доступен только для подтверждённой партии";

    const canCancel =
        receipt.status !== "CONFIRMED"
        && receipt.status !== "CANCELLED"
        && !cancelMutation.isPending;

    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate(`/receiving/${shipmentId}`)}
                sx={{ mb: 2 }}
            >
                К рейсу
            </Button>

            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    mb: 2,
                }}
            >
                <Typography variant="h2" component="h1">
                    Сверка приёмки
                </Typography>
                <Chip
                    label={
                        RECEIPT_STATUS_LABELS[receipt.status]
                        ?? receipt.status
                    }
                    color={
                        receipt.status === "CONFIRMED"
                            ? "success"
                            : "primary"
                    }
                />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Партия {receipt.receipt_number} · ожидаемая дата{" "}
                {formatDateRu(receipt.expected_date)} · строк:{" "}
                {receipt.items_count}
            </Typography>

            {message && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {message}
                </Alert>
            )}

            {commonErrors.length > 0 && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    <Stack spacing={0.5}>
                        {commonErrors.map((msg, i) => (
                            <Typography key={i} variant="body2">
                                {msg}
                            </Typography>
                        ))}
                    </Stack>
                </Alert>
            )}

            {/* ── Конфликты ─────────────────────────────── */}
            {hasConflicts && (
                <>
                    <Typography variant="h3" sx={{ mb: 1 }}>
                        Конфликты ({conflictList.length})
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                    >
                        Уточните, сколько тар пришло в дату рейса.
                    </Typography>

                    {conflictList.map((c) => (
                        <ConflictCard
                            key={c.question_index}
                            conflict={c}
                            onApply={handleApplyConflict}
                            isPending={resolveMutation.isPending}
                            serverError={
                                conflictErrors[c.question_index] || null
                            }
                        />
                    ))}

                    <Divider sx={{ my: 3 }} />
                </>
            )}

            {/* ── Сверка тары ───────────────────────────── */}
            <Typography variant="h3" sx={{ mb: 1 }}>
                Сверка тары ({receiptItems.length})
            </Typography>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2 }}
            >
                Отметьте, какие тары приехали. Номер тары — опционально.
            </Typography>

            {items.isLoading ? (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        py: 4,
                    }}
                >
                    <CircularProgress size={28} />
                </Box>
            ) : receiptItems.length === 0 ? (
                <Alert severity="info">
                    В партии пока нет строк для сверки. Разберите конфликты
                    или загрузите Excel.
                </Alert>
            ) : (
                <TableContainer
                    component={Card}
                    variant="outlined"
                    sx={{ mb: 2 }}
                >
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell padding="checkbox">
                                    Приехала
                                </TableCell>
                                <TableCell>Н/З</TableCell>
                                <TableCell>ТИ</TableCell>
                                <TableCell>Тип тары</TableCell>
                                <TableCell>Номер тары</TableCell>
                                <TableCell>Статус</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {receiptItems.map((it) => {
                                const m = marks[it.id] ?? {
                                    matched: false,
                                    containerNumber: "",
                                };
                                const rowError = itemErrors[it.id];
                                return (
                                    <TableRow
                                        key={it.id}
                                        sx={
                                            rowError
                                                ? { bgcolor: "error.light" }
                                                : undefined
                                        }
                                    >
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                checked={m.matched}
                                                onChange={(e) =>
                                                    setMarks((prev) => ({
                                                        ...prev,
                                                        [it.id]: {
                                                            ...m,
                                                            matched:
                                                                e.target.checked,
                                                        },
                                                    }))
                                                }
                                            />
                                        </TableCell>
                                        <TableCell>
                                            {it.expected_work_order_number}
                                        </TableCell>
                                        <TableCell>
                                            {it.expected_research_type_code}
                                        </TableCell>
                                        <TableCell>
                                            {it.container_type_name ?? "—"}
                                        </TableCell>
                                        <TableCell>
                                            <TextField
                                                size="small"
                                                value={m.containerNumber}
                                                onChange={(e) =>
                                                    setMarks((prev) => ({
                                                        ...prev,
                                                        [it.id]: {
                                                            ...m,
                                                            containerNumber:
                                                                e.target.value,
                                                        },
                                                    }))
                                                }
                                                placeholder="1"
                                                disabled={!m.matched}
                                                error={Boolean(rowError)}
                                                sx={{
                                                    minWidth: 140,
                                                    "& .MuiInputBase-input": {
                                                        fontSize: "0.85rem",
                                                    },
                                                }}
                                            />
                                            {rowError && (
                                                <FormHelperText error>
                                                    {rowError}
                                                </FormHelperText>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                size="small"
                                                label={
                                                    RECEIPT_ITEM_STATUS_LABELS[
                                                    it.status
                                                    ] ?? it.status
                                                }
                                                color={
                                                    it.status === "MATCHED"
                                                        ? "success"
                                                        : it.status === "MISSING"
                                                            ? "error"
                                                            : "default"
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <Stack
                direction="row"
                spacing={2}
                sx={{ alignItems: "center", mt: 2, flexWrap: "wrap", rowGap: 1 }}
            >
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => void handleSave()}
                    disabled={
                        checkMutation.isPending
                        || receiptItems.length === 0
                    }
                >
                    {checkMutation.isPending
                        ? "Сохраняем..."
                        : "Сохранить сверку"}
                </Button>

                <Tooltip title={completeTooltip}>
                    <span>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<DoneAllIcon />}
                            onClick={() => void handleComplete()}
                            disabled={completeDisabled}
                        >
                            {completeMutation.isPending
                                ? "Завершаем..."
                                : "Завершить приёмку"}
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip title={actTooltip}>
                    <span>
                        <Button
                            variant="outlined"
                            startIcon={<PictureAsPdfIcon />}
                            onClick={() => void handleOpenAct()}
                            disabled={actDisabled}
                        >
                            {actLoading ? "Готовим..." : "Акт приёмки"}
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip
                    title={
                        canCancel
                            ? "Статус станет «Отменена»"
                            : "Подтверждённую или отменённую партию отменить нельзя"
                    }
                >
                    <span>
                        <Button
                            variant="outlined"
                            color="warning"
                            startIcon={<WarningAmberIcon />}
                            onClick={() => void handleCancelReceipt()}
                            disabled={!canCancel}
                        >
                            {cancelMutation.isPending
                                ? "Отменяем..."
                                : "Отменить партию"}
                        </Button>
                    </span>
                </Tooltip>
            </Stack>
        </Box>
    );
}