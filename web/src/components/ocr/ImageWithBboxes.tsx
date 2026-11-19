/**
 * Фото задачи OCR с overlay зон и слов (вынесено из OcrReviewPage в 6e-2-web-fix5).
 * Клик по зоне/слову — подсветка поля; клик по слове-пробе — переход к строке списка.
 * fix8: активная проба обводится голубым поверх статуса — зелёный по зелёному
 *   не читался; статус остаётся видимым по заливке.
 */
import { useRef, useState, type MutableRefObject } from "react";
import { Box, Card, CardContent, Chip, Typography } from "@mui/material";

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

type SampleWordStatus = "covered" | "anomaly" | "missing";

export default function ImageWithBboxes({
    task,
    activeField,
    activeSample,
    showZones,
    sampleNumbers,
    validPrefixes,
    links,
    wordRefs,
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
    onBboxClick: (type: string) => void;
    onSampleClick: (link: SampleWordLink) => void;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
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
                                const link = linkByIndex.get(i);
                                const status = link?.status ?? null;
                                const statusColor = status ? STATUS_COLORS[status] : null;
                                const isActiveSample =
                                    link != null && activeSample === link.number;
                                const targetField = link
                                    ? "sample"
                                    : fieldForWord(w.text) ?? zoneForWord(w.bbox);
                                const isActive =
                                    isActiveSample ||
                                    (targetField !== null && activeField === targetField);
                                // fix8: выбранная проба — светлая заливка статуса + голубая рамка.
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
                                return (
                                    <polygon
                                        key={`word-${i}`}
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
                                    >
                                        <title>
                                            {link
                                                ? `${w.text} — ${STATUS_LABELS[link.status]}`
                                                : w.text}
                                        </title>
                                    </polygon>
                                );
                            })}
                        </svg>
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
                        Клик по пробе ведёт к её строке, клик по строке — к боксу.
                    </Typography>
                )}
            </CardContent>
        </Card>
    );
}