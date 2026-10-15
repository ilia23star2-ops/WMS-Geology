/**
 * Разбор вопросов `NEEDS_CONFIRMATION` для рейса.
 *
 * Роут: `/receiving/:id/questions`, где `id` — shipment_id.
 *
 * Для каждого неразобранного вопроса — карточка с формой
 * распределения тар по датам. Сохранение — по одному вопросу.
 *
 * Логика распределения:
 * - поле `target_date` обязательно, может быть 0;
 * - сумма всех полей должна равняться `question.containers_count`;
 * - при ровно 2 датах — автозаполнение остатка;
 * - при 3+ — всё вручную, показываем «Осталось: X», save блокируется.
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
    Divider,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate, useParams } from "react-router-dom";

import {
    useImportSessionByReceipt,
    useReceipts,
    useResolveQuestions,
    useShipment,
    type ImportError,
    type ImportQuestion,
    type ResolveDistributionItem,
    type ResolveQuestionItem,
} from "../api";

/**
 * Type-guard: является ли запись `parse_errors` вопросом
 * `NEEDS_CONFIRMATION`.
 */
function isQuestion(e: ImportError): e is ImportError & ImportQuestion {
    return e.code === "NEEDS_CONFIRMATION";
}

/** Форматирует ISO-дату (`YYYY-MM-DD`) в `DD.MM.YYYY`. */
function formatDateRu(iso: string): string {
    try {
        return new Date(iso).toLocaleDateString("ru-RU");
    } catch {
        return iso;
    }
}

// ============================================================
// Форма одного вопроса
// ============================================================
interface QuestionFormProps {
    question: ImportQuestion;
    questionIndex: number;
    importSessionId: number;
    onSaved: () => void;
}

function QuestionForm({
    question,
    questionIndex,
    importSessionId,
    onSaved,
}: QuestionFormProps) {
    const target = question.target_date ?? "";

    /**
     * Список дат для распределения: target + raw_dates, без дублей.
     * Порядок: target первым.
     */
    const allDates = useMemo(() => {
        const list: string[] = [];
        if (target) list.push(target);
        for (const d of question.raw_dates) {
            if (!list.includes(d)) list.push(d);
        }
        return list;
    }, [target, question.raw_dates]);

    /**
     * Начальные значения:
     * - `no_dates` — всё на target;
     * - остальные — 0.
     */
    const initialDistribution = useMemo<Record<string, number>>(() => {
        const init: Record<string, number> = {};
        for (const d of allDates) init[d] = 0;
        if (question.reason === "no_dates" && target) {
            init[target] = question.containers_count;
        }
        return init;
    }, [allDates, question.reason, question.containers_count, target]);

    const [distribution, setDistribution] = useState(initialDistribution);
    const [serverError, setServerError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const resolveMutation = useResolveQuestions(importSessionId);

    const total = question.containers_count;
    const assigned = allDates.reduce(
        (acc, d) => acc + (distribution[d] ?? 0),
        0,
    );
    const remaining = total - assigned;

    /**
     * Автозаполнение остатка — только при ровно 2 датах.
     * Пользователь изменил `date` → вторая дата получает остаток.
     */
    function handleFieldChange(date: string, rawValue: string) {
        setServerError(null);
        setSuccessMessage(null);

        const value = Math.max(0, Number(rawValue) || 0);
        setDistribution((prev) => {
            const next = { ...prev, [date]: value };
            if (allDates.length === 2) {
                const other = allDates.find((d) => d !== date)!;
                const rest = total - value;
                next[other] = rest >= 0 ? rest : 0;
            }
            return next;
        });
    }

    const canSave =
        assigned === total
        && (target === "" || allDates.includes(target));

    async function handleSave() {
        setServerError(null);
        setSuccessMessage(null);

        const items: ResolveDistributionItem[] = allDates.map((d) => ({
            date: d,
            containers_count: distribution[d] ?? 0,
        }));
        const resolution: ResolveQuestionItem = {
            question_index: questionIndex,
            distribution: items,
        };

        try {
            const result = await resolveMutation.mutateAsync({
                resolutions: [resolution],
            });
            setSuccessMessage(
                `Сохранено. Создано тар: ${result.created_containers_count}.`,
            );
            onSaved();
        } catch {
            setServerError(
                "Не удалось сохранить. Проверьте данные и попробуйте ещё раз.",
            );
        }
    }

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
                        Вопрос #{questionIndex}
                    </Typography>
                    <Chip
                        size="small"
                        label={question.reason}
                        color="warning"
                        variant="outlined"
                    />
                </Stack>

                <Stack spacing={0.5} sx={{ mb: 2 }}>
                    <Typography variant="body2">
                        Лист: <b>{question.sheet}</b>
                    </Typography>
                    <Typography variant="body2">
                        Н/З: <b>{question.work_order}</b>
                    </Typography>
                    <Typography variant="body2">
                        Тип исследования: <b>{question.research_type}</b>
                    </Typography>
                    <Typography variant="body2">
                        Тип тары: <b>{question.container_type}</b>
                    </Typography>
                    <Typography variant="body2">
                        Всего тар: <b>{question.containers_count}</b>
                    </Typography>
                    {target && (
                        <Typography variant="body2">
                            Дата рейса (target):{" "}
                            <b>{formatDateRu(target)}</b>
                        </Typography>
                    )}
                    {question.raw_dates.length > 0 && (
                        <Typography variant="body2">
                            Даты в файле:{" "}
                            {question.raw_dates
                                .map(formatDateRu)
                                .join(", ")}
                        </Typography>
                    )}
                </Stack>

                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Распределение тар по датам
                </Typography>

                <Stack spacing={1} sx={{ mb: 2 }}>
                    {allDates.map((d) => (
                        <Stack
                            key={d}
                            direction="row"
                            spacing={2}
                            sx={{ alignItems: "center" }}
                        >
                            <TextField
                                label={formatDateRu(d)}
                                type="number"
                                size="small"
                                value={distribution[d] ?? 0}
                                onChange={(e) =>
                                    handleFieldChange(d, e.target.value)
                                }
                                sx={{ maxWidth: 200 }}
                            />
                            {d === target && (
                                <Chip
                                    size="small"
                                    label="target"
                                    color="primary"
                                    variant="outlined"
                                />
                            )}
                        </Stack>
                    ))}
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Stack
                    direction="row"
                    spacing={2}
                    sx={{ alignItems: "center", mb: 1, flexWrap: "wrap" }}
                >
                    <Typography variant="body2" color="text.secondary">
                        Назначено: <b>{assigned}</b> из <b>{total}</b>
                    </Typography>
                    {remaining !== 0 && (
                        <Typography variant="body2" color="warning.main">
                            Осталось распределить: <b>{remaining}</b>
                        </Typography>
                    )}
                    {assigned === total && (
                        <Chip
                            size="small"
                            icon={<CheckCircleIcon />}
                            label="ОК"
                            color="success"
                        />
                    )}
                </Stack>

                {serverError && (
                    <Alert severity="error" sx={{ mb: 1 }}>
                        {serverError}
                    </Alert>
                )}
                {successMessage && (
                    <Alert severity="success" sx={{ mb: 1 }}>
                        {successMessage}
                    </Alert>
                )}

                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => void handleSave()}
                    disabled={!canSave || resolveMutation.isPending}
                >
                    {resolveMutation.isPending ? "Сохраняем..." : "Сохранить"}
                </Button>
            </CardContent>
        </Card>
    );
}

// ============================================================
// Страница
// ============================================================
export default function ShipmentQuestionsPage() {
    const { id } = useParams<{ id: string }>();
    const shipmentId = id ? Number(id) : null;
    const navigate = useNavigate();

    const shipment = useShipment(shipmentId);
    const receipts = useReceipts({
        page: 1,
        filters: { shipment_id: shipmentId ?? undefined },
    });
    const receipt = receipts.data?.results[0] ?? null;

    const importSession = useImportSessionByReceipt(receipt?.id ?? null);
    const session = importSession.data?.results[0] ?? null;

    /**
     * Список неразобранных вопросов вместе с их реальным
     * индексом в `parse_errors`.
     */
    const pendingQuestions = useMemo(() => {
        if (!session?.parse_errors) return [];
        const list: Array<{ question: ImportQuestion; index: number }> = [];
        session.parse_errors.forEach((e, i) => {
            if (isQuestion(e) && !e.resolved) {
                list.push({ question: e, index: i });
            }
        });
        return list;
    }, [session]);

    const totalQuestions = useMemo(() => {
        if (!session?.parse_errors) return 0;
        return session.parse_errors.filter(isQuestion).length;
    }, [session]);

    if (shipment.isLoading || receipts.isLoading || importSession.isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (shipment.isError || !shipment.data) {
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

    const shipmentData = shipment.data;

    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() =>
                    navigate(`/receiving/${shipmentData.id}`)
                }
                sx={{ mb: 2 }}
            >
                К рейсу
            </Button>

            <Typography variant="h2" component="h1" sx={{ mb: 2 }}>
                Разбор вопросов: {shipmentData.shipment_number}
            </Typography>

            {!receipt && (
                <Alert severity="info">
                    У рейса нет связанной партии приёмки.
                </Alert>
            )}

            {receipt && !session && (
                <Alert severity="warning">
                    Не найдена сессия импорта для партии.
                </Alert>
            )}

            {session && pendingQuestions.length === 0 && (
                <Alert severity="success">
                    Все вопросы разобраны.
                </Alert>
            )}

            {session && pendingQuestions.length > 0 && (
                <>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 2 }}
                    >
                        Осталось разобрать: {pendingQuestions.length} из{" "}
                        {totalQuestions}
                    </Typography>

                    {pendingQuestions.map(({ question, index }) => (
                        <QuestionForm
                            key={index}
                            question={question}
                            questionIndex={index}
                            importSessionId={session.id}
                            onSaved={() => {
                                void importSession.refetch();
                            }}
                        />
                    ))}
                </>
            )}
        </Box>
    );
}