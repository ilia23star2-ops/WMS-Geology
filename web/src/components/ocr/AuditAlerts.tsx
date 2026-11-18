/**
 * Алерты аудита проб: missing-чипы с подстановкой номера в поле ввода,
 * аномалии и ошибки разбора (вынесено из OcrReviewPage, 6e-2-web-fix5).
 */
import { Alert, Box, Chip } from "@mui/material";

import { STATUS_COLORS } from "./ImageWithBboxes";

export default function AuditAlerts({
    missing,
    anomalyCount,
    parseErrors,
    onMissingClick,
}: {
    missing: string[];
    anomalyCount: number;
    parseErrors: string[];
    onMissingClick: (number: string) => void;
}) {
    return (
        <>
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
                                sx={{
                                    borderColor: STATUS_COLORS.missing,
                                    color: STATUS_COLORS.missing,
                                }}
                            />
                        ))}
                    </Box>
                </Alert>
            )}

            {anomalyCount > 0 && (
                <Alert severity="warning">
                    Проб, выбивающихся из основной группы: {anomalyCount}.
                    Проверь номер — возможна ошибка распознавания.
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
