/**
 * Алерты аудита проб (6e-2-web-fix5…fix6, 6e-2-web-6/6-c).
 * Дубли — блокер; missing-чипы подставляют номер; аномалии и префиксы —
 * чипы с переходом к мини-зоне на фото; подсказки «похоже на ошибку OCR» —
 * пара номеров с просмотром и исправлением; расхождение количества с фото.
 */
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";

import { STATUS_COLORS } from "./ImageWithBboxes";
import type { SampleHint } from "../../utils/ocrSampleHints";
import type { PrefixIssue } from "../../utils/samplePrefixCheck";
import type { AnomalyChip, CountMismatch } from "../../hooks/useSampleHints";

const DUPLICATE_COLOR = "#C62828";
const NOT_ON_PHOTO_COLOR = "#546E7A";
const HINT_COLOR = "#EF6C00";
const PREFIX_COLOR = "#8E24AA";

export default function AuditAlerts({
    missing,
    anomalies,
    hints,
    prefixIssues,
    countMismatch,
    parseErrors,
    duplicates,
    notOnPhotoNumbers,
    onMissingClick,
    onAnomalyClick,
    onHintView,
    onHintFix,
    onPrefixClick,
}: {
    missing: string[];
    anomalies: AnomalyChip[];
    hints: SampleHint[];
    prefixIssues: PrefixIssue[];
    countMismatch: CountMismatch | null;
    parseErrors: string[];
    duplicates: string[];
    notOnPhotoNumbers: string[];
    onMissingClick: (number: string) => void;
    onAnomalyClick: (rangeId: string) => void;
    onHintView: (rangeId: string) => void;
    onHintFix: (hint: SampleHint) => void;
    onPrefixClick: (rangeId: string) => void;
}) {
    return (
        <>
            {duplicates.length > 0 && (
                <Alert severity="error">
                    Дубли проб в списке ({duplicates.length}): один и тот же номер нельзя
                    добавить в тару дважды. Удали лишнюю строку — подтверждение заблокировано.
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                        {duplicates.map((d) => (
                            <Chip
                                key={d}
                                size="small"
                                variant="outlined"
                                label={d}
                                sx={{ borderColor: DUPLICATE_COLOR, color: DUPLICATE_COLOR, fontWeight: 700 }}
                            />
                        ))}
                    </Box>
                </Alert>
            )}

            {countMismatch && (
                <Alert severity="warning">
                    Количество проб не сходится с фото. {countMismatch.message}
                </Alert>
            )}

            {prefixIssues.length > 0 && (
                <Alert severity="warning">
                    Префикс пробы должен быть только буквами и из справочника.
                    Проблемных номеров: {prefixIssues.length}. Нажми номер — покажу его на фото.
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                        {prefixIssues.map((p) => (
                            <Chip
                                key={p.rangeId + p.number}
                                size="small"
                                variant="outlined"
                                label={`${p.number}${p.prefix ? ` · ${p.prefix}` : " · без префикса"}`}
                                onClick={() => onPrefixClick(p.rangeId)}
                                sx={{
                                    borderColor: PREFIX_COLOR,
                                    color: PREFIX_COLOR,
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                }}
                            />
                        ))}
                    </Box>
                </Alert>
            )}

            {hints.length > 0 && (
                <Alert severity="warning">
                    Похоже на ошибку распознавания ({hints.length}): проба с фото не внесена,
                    но в списке есть почти такой же номер. Нажми пару — покажу её на фото;
                    «Исправить» подставит номер с фото, и лишняя строка исчезнет.
                    <Stack spacing={0.75} sx={{ mt: 1 }}>
                        {hints.map((h) => (
                            <Box
                                key={h.rangeId + h.missing}
                                sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75 }}
                            >
                                <Chip
                                    size="small"
                                    variant="outlined"
                                    label={`${h.candidate} → ${h.missing}`}
                                    onClick={() => onHintView(h.rangeId)}
                                    sx={{
                                        borderColor: HINT_COLOR,
                                        color: HINT_COLOR,
                                        fontFamily: "monospace",
                                        fontWeight: 700,
                                    }}
                                />
                                <Typography variant="caption" color="text.secondary">
                                    {h.kind === "confusable"
                                        ? "путаница символов OCR (T/1, O/0, I/1)"
                                        : "отличие в один символ"}
                                </Typography>
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="warning"
                                    onClick={() => onHintFix(h)}
                                    sx={{ py: 0, minWidth: 0, textTransform: "none" }}
                                >
                                    Исправить
                                </Button>
                            </Box>
                        ))}
                    </Stack>
                </Alert>
            )}

            {missing.length > 0 && (
                <Alert severity="warning">
                    На фото есть пробы, которых нет в списке ({missing.length}).
                    Нажми на номер — он подставится в поле ввода, затем «Добавить».
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                        {missing.map((m) => (
                            <Chip
                                key={m}
                                size="small"
                                variant="outlined"
                                label={m}
                                onClick={() => onMissingClick(m)}
                                sx={{ borderColor: STATUS_COLORS.missing, color: STATUS_COLORS.missing }}
                            />
                        ))}
                    </Box>
                </Alert>
            )}

            {notOnPhotoNumbers.length > 0 && (
                <Alert severity="warning">
                    В списке есть пробы, которых нет на фото ({notOnPhotoNumbers.length}).
                    Проверь номера: возможно, это другая скважина или опечатка.
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                        {notOnPhotoNumbers.map((n) => (
                            <Chip
                                key={n}
                                size="small"
                                variant="outlined"
                                label={n}
                                sx={{
                                    borderColor: NOT_ON_PHOTO_COLOR,
                                    color: NOT_ON_PHOTO_COLOR,
                                    fontStyle: "italic",
                                }}
                            />
                        ))}
                    </Box>
                </Alert>
            )}

            {anomalies.length > 0 && (
                <Alert severity="warning">
                    Проб, выбивающихся из основной группы: {anomalies.length}.
                    Нажми номер — покажу его на фото: часто это ошибка распознавания,
                    и после правки номера проба встаёт на место.
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                        {anomalies.map((a) => (
                            <Chip
                                key={a.rangeId}
                                size="small"
                                variant="outlined"
                                label={`⚠ ${a.number}`}
                                onClick={() => onAnomalyClick(a.rangeId)}
                                sx={{
                                    borderColor: STATUS_COLORS.anomaly,
                                    color: "#8D6E00",
                                    fontFamily: "monospace",
                                    fontWeight: 700,
                                }}
                            />
                        ))}
                    </Box>
                </Alert>
            )}

            {parseErrors.length > 0 && (
                <Alert severity="warning">
                    Не удалось разобрать: {parseErrors.join(", ")}.
                    Введены как есть — проверь номер и скважину.
                </Alert>
            )}
        </>
    );
}