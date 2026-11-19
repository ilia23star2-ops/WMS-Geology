/**
 * Панель исправленных OCR-токенов (6e-2-web-2-fix3).
 * Показывает «было → стало», вердикт относительно фото и требует подтвердить
 * расхождение. Крестик на чипе возвращает исходный текст OCR.
 */
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";

import type { WordEdit } from "../../utils/ocrTokenEdits";
import { needsConfirmation, type EditVerdict } from "../../utils/ocrEditVerdict";

const SEVERITY_COLOR = {
    info: "#00838F",
    warning: "#EF6C00",
    error: "#C62828",
} as const;

export default function TokenEditsPanel({
    edits,
    verdicts,
    acknowledged,
    onRevert,
    onAcknowledge,
}: {
    edits: WordEdit[];
    verdicts: Map<number, EditVerdict>;
    acknowledged: Set<number>;
    onRevert: (index: number) => void;
    onAcknowledge: (index: number) => void;
}) {
    if (edits.length === 0) return null;

    const pending = edits.filter((e) => {
        const v = verdicts.get(e.index);
        return v && needsConfirmation(v) && !acknowledged.has(e.index);
    });
    const severity = pending.length > 0 ? "error" : "info";

    return (
        <Alert severity={severity}>
            Правки слов на фото: {edits.length}. Фото остаётся источником правды —
            расхождения нужно подтвердить.
            {pending.length > 0 && ` Не подтверждено: ${pending.length}.`}
            <Stack spacing={0.75} sx={{ mt: 1 }}>
                {edits.map((e) => {
                    const v = verdicts.get(e.index);
                    const color = v ? SEVERITY_COLOR[v.severity] : SEVERITY_COLOR.info;
                    const mustConfirm = !!v && needsConfirmation(v);
                    const done = acknowledged.has(e.index);
                    return (
                        <Box
                            key={e.index}
                            sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "center",
                                gap: 0.75,
                            }}
                        >
                            <Chip
                                size="small"
                                variant="outlined"
                                label={e.original + " → " + e.text}
                                onDelete={() => onRevert(e.index)}
                                sx={{
                                    borderColor: color,
                                    color,
                                    fontFamily: "monospace",
                                    fontWeight: mustConfirm && !done ? 700 : 400,
                                }}
                            />
                            <Typography variant="caption" sx={{ color }}>
                                {done && mustConfirm ? "подтверждено вручную" : v?.message}
                            </Typography>
                            {mustConfirm && !done && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="error"
                                    onClick={() => onAcknowledge(e.index)}
                                    sx={{ py: 0, minWidth: 0, textTransform: "none" }}
                                >
                                    Подтвердить
                                </Button>
                            )}
                        </Box>
                    );
                })}
            </Stack>
        </Alert>
    );
}