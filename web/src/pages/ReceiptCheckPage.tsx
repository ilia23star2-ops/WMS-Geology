/**
 * Экран сверки приёмки (`/receiving/:id/check`).
 *
 * Верхний блок — неразобранные конфликты (`multi_date_match`).
 * По каждому: сколько тар пришло на target_date. Кнопка «Применить»
 * превращает ответ в N `ReceiptItem`.
 *
 * Нижний блок — сверка тары: чекбокс «Приехала» + номер тары для
 * каждой строки партии. Одна кнопка «Сохранить сверку» — batch.
 *
 * Кнопка «Завершить приёмку» — активна, когда конфликтов нет
 * и все строки в `MATCHED` / `MISSING`. Backend перепроверяет.
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
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate, useParams } from "react-router-dom";

import {
    RECEIPT_ITEM_STATUS_LABELS,
    RECEIPT_STATUS_LABELS,
    useCheckReceipt,
    useCompleteReceipt,
    useReceiptConflicts,
    useReceiptItems,
    useReceipts,
    useResolveConflicts,
    type ReceiptConflict,
    type ReceiptItem,
} from "../api";

/**
 * Локальный стейт по строке сверки:
 * - `matched` — чекбокс;
 * - `containerNumber` — поле номера тары.
 */
interface MarkState {
    matched: boolean;
    containerNumber: string;
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

    const [marks, setMarks] = useState<Record<number, MarkState>>({});
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [conflictErrors, setConflictErrors] = useState<
        Record<number, string>
    >({});

    // Инициализация/обновление marks при изменении items.
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

    // Конфликты.
    const conflictList: ReceiptConflict[] =
        conflicts.data?.conflicts ?? [];
    const hasConflicts = conflictList.length > 0;

    // Все ли строки сверены.
    const allChecked =
        receiptItems.length > 0
        && receiptItems.every(
            (it) => it.status === "MATCHED" || it.status === "MISSING",
        );

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
        } catch {
            setConflictErrors((prev) => ({
                ...prev,
                [questionIndex]:
                    "Не удалось применить. Проверьте данные.",
            }));
        }
    }

    async function handleSave() {
        setError(null);
        setMessage(null);

        const payload = receiptItems.map((it) => {
            const m = marks[it.id];
            return {
                item_id: it.id,
                matched: m?.matched ?? false,
                container_number:
                    (m?.containerNumber ?? "").trim() || null,
            };
        });

        try {
            const res = await checkMutation.mutateAsync({ items: payload });
            setMessage(
                `Сохранено. Совпадает: ${res.matched_count}, `
                + `отсутствует: ${res.missing_count}.`,
            );
            void items.refetch();
        } catch {
            setError("Не удалось сохранить сверку. Проверьте номера тар.");
        }
    }

    async function handleComplete() {
        setError(null);
        setMessage(null);
        try {
            const res = await completeMutation.mutateAsync();
            setMessage(
                `Приёмка завершена. Статус: ${res.status}. `
                + `Рейс: ${res.shipment_status ?? "—"}.`,
            );
            setTimeout(() => navigate(`/receiving/${shipmentId}`), 800);
        } catch {
            setError(
                "Не удалось завершить приёмку. "
                + "Проверьте конфликты и сверку.",
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
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
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
                                return (
                                    <TableRow key={it.id}>
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
                                            {it.expected_site_code}
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
                                                placeholder="T-001"
                                                disabled={!m.matched}
                                                sx={{
                                                    minWidth: 140,
                                                    "& .MuiInputBase-input": {
                                                        fontSize: "0.85rem",
                                                    },
                                                }}
                                            />
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
                sx={{ alignItems: "center", mt: 2 }}
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

                <Tooltip
                    title={
                        hasConflicts
                            ? "Сначала разберите конфликты"
                            : !allChecked
                                ? "Не все тары сверены"
                                : ""
                    }
                >
                    <span>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<DoneAllIcon />}
                            onClick={() => void handleComplete()}
                            disabled={
                                completeMutation.isPending
                                || hasConflicts
                                || !allChecked
                            }
                        >
                            {completeMutation.isPending
                                ? "Завершаем..."
                                : "Завершить приёмку"}
                        </Button>
                    </span>
                </Tooltip>

                {!allChecked && receiptItems.length > 0 && (
                    <Typography variant="body2" color="text.secondary">
                        Не сверено:{" "}
                        {
                            receiptItems.filter(
                                (it) => it.status === "EXPECTED",
                            ).length
                        }
                    </Typography>
                )}
            </Stack>
        </Box>
    );
}