/**
 * Алерты аудита проб: missing-чипы с подстановкой номера в поле ввода,
 * аномалии, ошибки разбора (вынесено из OcrReviewPage, 6e-2-web-fix5).
 * fix6: дубли (ошибка, блокер) и пробы списка, которых нет на фото.
 */
import { Alert, Box, Chip } from "@mui/material";

import { STATUS_COLORS } from "./ImageWithBboxes";

const DUPLICATE_COLOR = "#C62828";
const NOT_ON_PHOTO_COLOR = "#546E7A";

export default function AuditAlerts({
    missing,
    anomalyCount,
    parseErrors,
    duplicates,
    notOnPhotoNumbers,
    onMissingClick,
}: {
    missing: string[];
    anomalyCount: number;
    parseErrors: string[];
    duplicates: string[];
    notOnPhotoNumbers: string[];
    onMissingClick: (number: string) => void;
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
                                sx={{
                                    borderColor: DUPLICATE_COLOR,
                                    color: DUPLICATE_COLOR,
                                    fontWeight: 700,
                                }}
                            />
                        ))}
                    </Box>
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
                                sx={{
                                    borderColor: STATUS_COLORS.missing,
                                    color: STATUS_COLORS.missing,
                                }}
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