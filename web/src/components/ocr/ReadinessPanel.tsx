/**
 * Итоговая готовность (6e-2-web-fix7): компактная строка-статус вместо
 * длинного списка. Детали раскрываются по кнопке и показывают только проблемы.
 * Всё считает checkReadiness на странице — блок презентационный.
 */
import { useState } from "react";
import { Box, Button, Collapse, Stack, Typography } from "@mui/material";

import { readinessSummary, type Readiness } from "../../utils/ocrReadiness";

const TONE_COLOR = {
    success: "#2E7D32",
    warning: "#EF6C00",
    error: "#C62828",
} as const;

const TONE_MARK = {
    success: "✓",
    warning: "⚠",
    error: "✗",
} as const;

export default function ReadinessPanel({ readiness }: { readiness: Readiness }) {
    const [open, setOpen] = useState(false);
    const summary = readinessSummary(readiness);
    const color = TONE_COLOR[summary.tone];
    const problems = [...summary.blockers, ...summary.warnings];

    return (
        <Box
            sx={{
                border: "1px solid",
                borderColor: color,
                borderRadius: 1,
                bgcolor: `${color}12`,
                px: 1.5,
                py: 0.75,
            }}
        >
            <Stack direction="row" spacing={1} alignItems="center">
                <Typography component="span" sx={{ color, fontWeight: 700, lineHeight: 1 }}>
                    {TONE_MARK[summary.tone]}
                </Typography>
                <Typography variant="body2" sx={{ fontWeight: 600, color }}>
                    {summary.text}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                {problems.length > 0 && (
                    <Button
                        size="small"
                        onClick={() => setOpen((v) => !v)}
                        sx={{ minWidth: 0, py: 0, color, textTransform: "none" }}
                    >
                        {open ? "Свернуть" : "Детали"}
                    </Button>
                )}
            </Stack>

            <Collapse in={open} unmountOnExit>
                <Stack spacing={0.25} sx={{ mt: 0.75 }}>
                    {problems.map((it) => (
                        <Typography key={it.key} variant="caption" sx={{ display: "block" }}>
                            <span style={{ color: it.required ? TONE_COLOR.error : TONE_COLOR.warning }}>
                                {it.required ? "✗" : "⚠"} {it.label}
                            </span>
                            <span style={{ opacity: 0.75 }}> — {it.hint}</span>
                        </Typography>
                    ))}
                </Stack>
            </Collapse>
        </Box>
    );
}