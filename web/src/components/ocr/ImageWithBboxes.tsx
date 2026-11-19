/**
 * Фото задачи OCR с overlay зон и слов (вынесено из OcrReviewPage в 6e-2-web-fix5).
 * Клик по зоне/слову — подсветка поля; клик по слове-пробе — переход к строке списка.
 * fix8: активная проба обводится голубым поверх статуса.
 * 6e-2-web-2: двойной клик по слову — инлайн-правка текста прямо над боксом
 *   (Enter — применить, Esc — отмена); исправленные слова помечены ✎.
 */
import { useRef, useState, type MutableRefObject } from "react";
import { Box, Card, CardContent, Chip, TextField, Typography } from "@mui/material";

import {
    OCR_ZONE_LABELS,
    resolveImageUrl,
    type OcrTask,
    type OcrZone,
    type OcrZoneType,
} from "../../api/ocr";
import { matchesSampleNumber, type SampleWordLink } from "../../utils/ocrSampleAudit";

/** Цвета зон — совпадают с мобильной разметкой. */
export const ZONE_COLORS: Record<string, string> = {
    work_order_coded: "#1E88E5",
    work_order_incoming: "#00897B",
    container_number: "#FB8C00",
    research_type: "#8E24AA",
    sample: "#43A047",
    well: "#6D4C41",
    site: "#3949AB",
};

/** Статусы проб: жёлтый и малиновый разведены далеко друг от друга. */
export const STATUS_COLORS: Record<SampleWordStatus, string> = {
    covered: "#2E7D32",
    anomaly: "#F9A825",
    missing: "#D81B60",
};

export const STATUS_LABELS: Record<SampleWordStatus, string> = {
    covered: "есть в списке",
    anomaly: "выбивается из группы",
    missing: "нет в списке",
};

/** fix8: контрастная обводка выбранной пробы (не совпадает ни с одним статусом). */
export const ACTIVE_SAMPLE_COLOR = "#00E5FF";

/** 6e-2-web-2: цвет правки токена. */
const EDIT_COLOR = "#00838F";

type SampleWordStatus = "covered" | "anomaly" | "missing";

interface EditorState {
    index: number;
    text: string;
    left: number;
    top: number;
    width: number;
}

export default function ImageWithBboxes({
    task,
    activeField,
    activeSample,
    showZones,
    sampleNumbers,
    validPrefixes,
    links,
    wordRefs,
    edits,
    onEditWord,
    onBboxClick,
    onSampleClick,
}: {
    task: OcrTask;
    activeField: string | null;
    activeSample: string | null;
    showZones: boolean;
    sampleNumbers: Set<string>;
    validPrefixes: string[];
    links: SampleWordLink[];
    wordRefs: MutableRefObject<Map<number, SVGPolygonElement | null>>;
    edits: Map<number, string>;
    onEditWord: (index: number, text: string) => void;
    onBboxClick: (type: string) => void;
    onSampleClick: (link: SampleWordLink) => void;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
    const [editor, setEditor] = useState<EditorState | null>(null);
    const committedRef = useRef(false);
    const src = resolveImageUrl(task.image);

    const zones: OcrZone[] = task.zones ?? [];
    const ex = task.raw_ocr_data?.extracted;
    const zoneTypes = Array.from(new Set(zones.map((z) => z.type)));
    const linkByIndex = new Map(links.map((l) => [l.index, l]));

    function fieldForWord(text: string): string | null {
        const t = text.trim().toUpperCase();
        if (!t) return null;
        if (matchesSampleNumber(t, sampleNumbers, validPrefixes)) return "sample";
        if (!ex) return null;
        if (ex.work_order_coded && ex.work_order_coded.toUpperCase().includes(t)) return 'work_order_coded';
        if (ex.work_order_incoming && ex.work_order_incoming.toUpperCase().includes(t)) return 'work_order_incoming';
        if (ex.container_number && ex.container_number.toUpperCase().includes(t)) return 'container_number';
        if (ex.site && ex.site.toUpperCase().includes(t)) return 'site';
        if (ex.research_type && ex.research_type.toUpperCase() === t) return 'research_type';
        if (ex.container_type && ex.container_type.toUpperCase() === t) return 'container_type';
        if (ex.samples && ex.samples.some((s) => s.toUpperCase().includes(t))) return 'sample';
        return null;
    }

    function zoneForWord(bbox: number[][]): string | null {
        if (!bbox?.length) return null;
        const cx = bbox.reduce((s, p) => s + p[0], 0) / bbox.length;
        const cy = bbox.reduce((s, p) => s + p[1], 0) / bbox.length;
        for (const z of zones) {
            const xs = z.bbox.map((p) => p[0]);
            const ys = z.bbox.map((p) => p[1]);
            if (
                cx >= Math.min(...xs) && cx <= Math.max(...xs) &&
                cy >= Math.min(...ys) && cy <= Math.max(...ys)
            ) {
                return z.type;
            }
        }
        return null;
    }

    /** Открыть поле правки под боксом слова (координаты в процентах фото). */
    function openEditor(index: number, text: string, bbox: number[][]) {
        if (!dims || !bbox?.length) return;
        const xs = bbox.map((p) => p[0]);
        const ys = bbox.map((p) => p[1]);
        const minX = Math.min(...xs);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        committedRef.current = false;
        setEditor({
            index,
            text,
            left: (minX / dims.w) * 100,
            top: (maxY / dims.h) * 100,
            width: Math.max(((maxX - minX) / dims.w) * 100, 22),
        });
    }

    function applyEditor() {
        if (!editor || committedRef.current) return;
        committedRef.current = true;
        onEditWord(editor.index, editor.text);
        setEditor(null);
    }

    return (
        <Card>
            <CardContent sx={{ position: "relative" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                        ref={imgRef}
                        src={src}
                        alt="OCR"
                        onLoad={() => {
                            const el = imgRef.current;
                            if (el) setDims({ w: el.naturalWidth, h: el.naturalHeight });
                        }}
                        style={{ maxWidth: "100%", display: "block" }}
                    />
                    {dims && (
                        <svg
                            viewBox={`0 0 ${dims.w} ${dims.h}`}
                            preserveAspectRatio="none"
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                pointerEvents: "none",
                                visibility: showZones ? "visible" : "hidden",
                            }}
                        >
                            {zones.map((zone, i) => {
                                const active = activeField === zone.type;
                                const color = ZONE_COLORS[zone.type] ?? "#1E3A5F";
                                return (
                                    <polygon
                                        key={`zone-${i}`}
                                        points={zone.bbox
                                            .map(([x, y]) => `${x},${y}`)
                                            .join(" ")}
                                        fill={active ? "rgba(255, 152, 0, 0.22)" : `${color}18`}
                                        stroke={active ? "rgba(255, 152, 0, 0.95)" : color}
                                        strokeWidth={active ? 3 : 2}
                                        style={{ pointerEvents: "all", cursor: "pointer" }}
                                        onClick={() => onBboxClick(zone.type)}
                                    />
                                );
                            })}
                            {task.raw_ocr_data?.words.map((w, i) => {
                                const text = edits.get(i) ?? w.text;
                                const isEdited = edits.has(i) && edits.get(i) !== w.text;
                                const link = linkByIndex.get(i);
                                const status = link?.status ?? null;
                                const statusColor = status ? STATUS_COLORS[status] : null;
                                const isActiveSample =
                                    link != null && activeSample === link.number;
                                const targetField = link
                                    ? "sample"
                                    : fieldForWord(text) ?? zoneForWord(w.bbox);
                                const isActive =
                                    isActiveSample ||
                                    (targetField !== null && activeField === targetField);
                                const fill = statusColor
                                    ? `${statusColor}${isActiveSample ? "2E" : isActive ? "44" : "24"}`
                                    : isActive
                                        ? "rgba(255,152,0,0.28)"
                                        : "rgba(30,58,95,0.10)";
                                const stroke = isActiveSample
                                    ? ACTIVE_SAMPLE_COLOR
                                    : statusColor ??
                                    (isActive ? "rgba(255,152,0,0.95)" : "rgba(30,58,95,0.45)");
                                const width = isActiveSample ? 4 : isActive ? 3 : statusColor ? 2 : 1;
                                const dash = status === "missing" && !isActiveSample ? "6 3" : undefined;
                                const xs = w.bbox.map((p) => p[0]);
                                const ys = w.bbox.map((p) => p[1]);
                                return (
                                    <g key={`word-${i}`}>
                                        <polygon
                                            ref={(el) => {
                                                wordRefs.current.set(i, el);
                                            }}
                                            points={w.bbox
                                                .map(([x, y]) => `${x},${y}`)
                                                .join(" ")}
                                            fill={fill}
                                            stroke={stroke}
                                            strokeWidth={width}
                                            strokeDasharray={dash}
                                            style={{ pointerEvents: "all", cursor: "pointer" }}
                                            onClick={() => {
                                                if (link) onSampleClick(link);
                                                else if (targetField) onBboxClick(targetField);
                                            }}
                                            onDoubleClick={() => openEditor(i, text, w.bbox)}
                                        >
                                            <title>
                                                {link
                                                    ? `${text} — ${STATUS_LABELS[link.status]}`
                                                    : text}
                                                {isEdited ? " (исправлено)" : ""}
                                                {" · двойной клик — правка"}
                                            </title>
                                        </polygon>
                                        {isEdited && (
                                            <text
                                                x={Math.min(...xs)}
                                                y={Math.min(...ys) - dims.h / 200}
                                                fill={EDIT_COLOR}
                                                fontSize={dims.h / 40}
                                                style={{ pointerEvents: "none" }}
                                            >
                                                ✎
                                            </text>
                                        )}
                                    </g>
                                );
                            })}
                        </svg>
                    )}
                    {editor && (
                        <Box
                            sx={{
                                position: "absolute",
                                left: `${editor.left}%`,
                                top: `${editor.top}%`,
                                width: `${editor.width}%`,
                                minWidth: 170,
                                zIndex: 5,
                                bgcolor: "background.paper",
                                border: "2px solid",
                                borderColor: EDIT_COLOR,
                                borderRadius: 1,
                                p: 0.5,
                                boxShadow: 3,
                            }}
                        >
                            <TextField
                                size="small"
                                fullWidth
                                autoFocus
                                value={editor.text}
                                onChange={(e) =>
                                    setEditor({ ...editor, text: e.target.value })
                                }
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        applyEditor();
                                    } else if (e.key === "Escape") {
                                        committedRef.current = true;
                                        setEditor(null);
                                    }
                                }}
                                onBlur={applyEditor}
                                helperText="Enter — применить · Esc — отмена"
                                slotProps={{
                                    htmlInput: {
                                        sx: { fontFamily: "monospace", fontSize: 13, py: 0.5 },
                                    },
                                }}
                            />
                        </Box>
                    )}
                </div>
                {showZones && zoneTypes.length > 0 && (
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 1 }}>
                        {zoneTypes.map((type) => {
                            const color = ZONE_COLORS[type] ?? "#1E3A5F";
                            const active = activeField === type;
                            return (
                                <Chip
                                    key={type}
                                    size="small"
                                    variant="outlined"
                                    label={OCR_ZONE_LABELS[type as OcrZoneType] ?? type}
                                    onClick={() => onBboxClick(type)}
                                    sx={{
                                        borderColor: color,
                                        color: active ? "#fff" : color,
                                        bgcolor: active ? color : `${color}1A`,
                                        fontWeight: active ? 700 : 400,
                                    }}
                                />
                            );
                        })}
                    </Box>
                )}
                {showZones && (
                    <Typography
                        variant="caption"
                        sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
                    >
                        Пробы:{" "}
                        <b style={{ color: STATUS_COLORS.covered }}>зелёный</b> — есть в списке ·{" "}
                        <b style={{ color: STATUS_COLORS.anomaly }}>жёлтый</b> — выбивается ·{" "}
                        <b style={{ color: STATUS_COLORS.missing }}>малиновый пунктир</b> — нет в списке.
                        Выбранная проба —{" "}
                        <b style={{ color: "#0097A7" }}>голубая рамка</b>.
                        Клик по пробе ведёт к её строке, клик по строке — к боксу.{" "}
                        <b style={{ color: EDIT_COLOR }}>Двойной клик по слову — правка текста</b>{" "}
                        (исправленные помечены ✎).
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}