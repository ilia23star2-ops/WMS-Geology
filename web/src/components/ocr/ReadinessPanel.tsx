/**
 * Готовность к подтверждению + итоговый сигнал (вынесено из OcrReviewPage, 6e-2-web).
 * Чистый презентационный блок: всё считает checkReadiness на странице.
 */
import { Alert, Box, Stack, Typography } from "@mui/material";

import type { Readiness } from "../../utils/ocrReadiness";

export default function ReadinessPanel({ readiness }: { readiness: Readiness }) {
    return (
        <>
            {/* Динамическая готовность к подтверждению */}
            <Box
                sx={{
                    border: "1px solid",
                    borderColor: readiness.ready ? "success.main" : "divider",
                    borderRadius: 1,
                    p: 1.5,
                    bgcolor: readiness.ready ? "rgba(46,125,50,0.06)" : undefined,
                }}
            >
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Готовность к подтверждению
                </Typography>
                <Stack spacing={0.5}>
                    {readiness.items.map((it) => (
                        <Box
                            key={it.key}
                            sx={{ display: "flex", gap: 1, alignItems: "baseline" }}
                        >
                            <Typography
                                component="span"
                                sx={{
                                    fontWeight: 700,
                                    color: it.ok
                                        ? "success.main"
                                        : it.required
                                            ? "error.main"
                                            : "warning.main",
                                }}
                            >
                                {it.ok ? "✓" : it.required ? "✗" : "⚠"}
                            </Typography>
                            <Typography variant="body2">
                                {it.label}{it.required ? " *" : ""}
                            </Typography>
                            {!it.ok && (
                                <Typography variant="caption" color="text.secondary">
                                    — {it.hint}
                                </Typography>
                            )}
                        </Box>
                    ))}
                </Stack>
            </Box>

            {readiness.ready ? (
                <Alert severity="success">
                    Всё заполнено и сходится с фото — можно подтверждать.
                </Alert>
            ) : readiness.blockers > 0 ? (
                <Alert severity="error">
                    Не заполнено обязательных полей: {readiness.blockers}.
                </Alert>
            ) : (
                <Alert severity="warning">
                    Обязательные заполнены, но есть замечания по пробам — проверь перед подтверждением.
                </Alert>
            )}
        </>
    );
}
