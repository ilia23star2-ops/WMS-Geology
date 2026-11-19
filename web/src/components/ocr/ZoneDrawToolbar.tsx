/**
 * Панель разметки зон (6e-2-web-5, +авто-зоны 5-c): режим, тип зоны,
 * «Авто-зоны», «Применить к полям», «Сохранить на сервер», возврат и очистка.
 * Живёт над фото — управление видно всегда, без прокрутки.
 */
import {
    Alert,
    Box,
    Button,
    Chip,
    MenuItem,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";

import { OCR_ZONE_LABELS, type OcrZoneType } from "../../api/ocr";
import type { ZoneDrawing } from "../../hooks/useZoneDrawing";
import { ZONE_COLORS } from "./ImageWithBboxes";

const TYPE_ORDER: OcrZoneType[] = [
    "sample",
    "container_number",
    "work_order_coded",
    "work_order_incoming",
    "research_type",
    "site",
    "well",
];

export default function ZoneDrawToolbar({ drawing }: { drawing: ZoneDrawing }) {
    const drawingOn = drawing.mode === "draw";
    return (
        <Box
            sx={{
                mb: 1,
                p: 1,
                border: "1px solid",
                borderColor: drawingOn ? "#00838F" : "divider",
                borderRadius: 1,
                bgcolor: drawingOn ? "rgba(0,131,143,0.06)" : undefined,
            }}
        >
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <Switch
                        size="small"
                        checked={drawingOn}
                        onChange={(e) => drawing.setMode(e.target.checked ? "draw" : "view")}
                        slotProps={{ input: { "aria-label": "Режим рисования зон" } }}
                    />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Рисовать зоны
                    </Typography>
                </Stack>

                <TextField
                    select
                    size="small"
                    label="Тип зоны"
                    value={drawing.type}
                    onChange={(e) => drawing.setType(e.target.value as OcrZoneType)}
                    disabled={!drawingOn}
                    sx={{ minWidth: 190 }}
                >
                    {TYPE_ORDER.map((t) => (
                        <MenuItem key={t} value={t}>
                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Box
                                    sx={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: "2px",
                                        bgcolor: ZONE_COLORS[t] ?? "#1E3A5F",
                                    }}
                                />
                                <span>{OCR_ZONE_LABELS[t]}</span>
                            </Stack>
                        </MenuItem>
                    ))}
                </TextField>

                <Tooltip title="Собрать зоны по словам OCR: метки этикетки и колонки проб">
                    <span>
                        <Button
                            size="small"
                            variant="outlined"
                            startIcon={<AutoFixHighIcon />}
                            onClick={drawing.autoDetect}
                            disabled={!drawing.hasWords}
                            sx={{ textTransform: "none", borderColor: "#00838F", color: "#00838F" }}
                        >
                            Авто-зоны
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip title="Заполнить шапку и пробы текстом из зон">
                    <span>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={drawing.apply}
                            disabled={drawing.zones.length === 0}
                            sx={{ textTransform: "none" }}
                        >
                            Применить к полям
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip title="Отправить разметку на сервер (POST /zones/)">
                    <span>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={drawing.save}
                            disabled={!drawing.dirty || drawing.saving}
                            sx={{ textTransform: "none" }}
                        >
                            {drawing.saving ? "Сохраняем…" : "Сохранить зоны"}
                        </Button>
                    </span>
                </Tooltip>

                <Tooltip title="Вернуть разметку, пришедшую с фото">
                    <span>
                        <Button
                            size="small"
                            onClick={drawing.reset}
                            disabled={!drawing.dirty}
                            sx={{ textTransform: "none" }}
                        >
                            Вернуть исходные
                        </Button>
                    </span>
                </Tooltip>

                <Button
                    size="small"
                    color="error"
                    onClick={drawing.clear}
                    disabled={drawing.zones.length === 0}
                    sx={{ textTransform: "none" }}
                >
                    Очистить
                </Button>
            </Stack>

            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                {drawingOn
                    ? "Тяни мышью по фото — рамка станет зоной выбранного типа. Клик по чипу зоны меняет её тип, крестик удаляет."
                    : "«Авто-зоны» соберёт разметку по распознанным словам, режим рисования — вручную, когда OCR промахнулся."}
                {" "}Зон: {drawing.zones.length}
                {drawing.previewCount > 0 && ` · читается значений: ${drawing.previewCount}`}
                {drawing.dirty && " · есть несохранённые изменения"}
                {drawing.savedCount !== null && ` · сохранено: ${drawing.savedCount}`}
            </Typography>

            {drawing.zones.length > 0 && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.75 }}>
                    {drawing.zones.map((z, i) => {
                        const color = ZONE_COLORS[z.type] ?? "#1E3A5F";
                        return (
                            <Chip
                                key={`${z.type}-${i}`}
                                size="small"
                                variant="outlined"
                                label={`${i + 1}. ${OCR_ZONE_LABELS[z.type]}${z.source === "manual" ? " ✎" : ""}`}
                                onDelete={() => drawing.removeZone(i)}
                                onClick={() => drawing.changeType(i, drawing.type)}
                                sx={{ borderColor: color, color, fontWeight: 600 }}
                            />
                        );
                    })}
                </Box>
            )}

            {drawing.notice && (
                <Alert severity="success" sx={{ mt: 1, py: 0 }}>
                    {drawing.notice}
                </Alert>
            )}
            {drawing.error && (
                <Alert severity="error" sx={{ mt: 1, py: 0 }}>
                    {drawing.error}
                </Alert>
            )}
        </Box>
    );
}