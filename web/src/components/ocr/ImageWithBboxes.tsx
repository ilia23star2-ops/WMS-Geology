/**
 * Фото задачи OCR: зоны, слова, зум и рисование разметки.
 * 6e-2-web-fix5…fix8: overlay, статусы проб, контрастная активная проба.
 * 6e-2-web-2: двойной клик по слову — инлайн-правка (Enter/Esc), метка ✎.
 * 6e-2-web-4: зум (колесо к курсору, слайдер, 1:1, вписать), панорама мышью
 *   и стрелками, яркость/контраст/инверсия/ЧБ; захват указателя только после
 *   реального движения — клик по зоне при увеличении не срывается.
 * 6e-2-web-5: режим рисования зон — протяжка рамкой в пикселях оригинала,
 *   автораздвижка пересечений, панель управления над фото.
 */
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type MutableRefObject,
    type PointerEvent as ReactPointerEvent,
} from "react";
import {
    Box,
    Card,
    CardContent,
    Chip,
    IconButton,
    Slider,
    Stack,
    Switch,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import FitScreenIcon from "@mui/icons-material/FitScreen";
import CenterFocusStrongIcon from "@mui/icons-material/CenterFocusStrong";
import AspectRatioIcon from "@mui/icons-material/AspectRatio";
import RestartAltIcon from "@mui/icons-material/RestartAlt";

import {
    OCR_ZONE_LABELS,
    resolveImageUrl,
    type OcrTask,
    type OcrZone,
    type OcrZoneType,
} from "../../api/ocr";
import { matchesSampleNumber, type SampleWordLink } from "../../utils/ocrSampleAudit";
import {
    MAX_SCALE,
    MIN_SCALE,
    WHEEL_STEP,
    actualScale,
    baseSize,
    clamp,
    panDeltaFor,
    scalePercent,
    shouldZoomOnWheel,
} from "../../utils/photoZoom";
import {
    bboxToRect,
    clampRect,
    isZoneBigEnough,
    rectFromPoints,
    rectToBbox,
    viewToPhoto,
    type Pt,
    type Rect,
} from "../../utils/zoneDraw";
import { usePhotoZoom } from "../../hooks/usePhotoZoom";
import type { ZoneDrawing } from "../../hooks/useZoneDrawing";
import ZoneDrawToolbar from "./ZoneDrawToolbar";

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

/** Статусы проб. */
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

export const ACTIVE_SAMPLE_COLOR = "#00E5FF";
const EDIT_COLOR = "#00838F";
const EDITOR_WIDTH = 220;

type SampleWordStatus = "covered" | "anomaly" | "missing";

interface EditorState {
    index: number;
    text: string;
    fx: number;
    fy: number;
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
    activeWordIndex,
    drawing,
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
    activeWordIndex?: number | null;
    drawing?: ZoneDrawing;
    onEditWord: (index: number, text: string) => void;
    onBboxClick: (type: string) => void;
    onSampleClick: (link: SampleWordLink) => void;
}) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
    const [base, setBase] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
    const [hovered, setHovered] = useState(false);
    const [editor, setEditor] = useState<EditorState | null>(null);
    const [brightness, setBrightness] = useState(100);
    const [contrast, setContrast] = useState(100);
    const [inverted, setInverted] = useState(false);
    const [grayscale, setGrayscale] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [drawRect, setDrawRect] = useState<Rect | null>(null);
    const drawStartRef = useRef<Pt | null>(null);
    const committedRef = useRef(false);
    const dragRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
    const movedRef = useRef(false);

    const { scale, pan, zoomAt, zoomBy, reset, setPan, clampPan } = usePhotoZoom(base);
    const src = resolveImageUrl(task.image);

    const drawMode = drawing?.mode === "draw";
    const zones: OcrZone[] = drawing ? drawing.zones : (task.zones ?? []);
    const ex = task.raw_ocr_data?.extracted;
    const zoneTypes = Array.from(new Set(zones.map((z) => z.type)));
    const linkByIndex = new Map(links.map((l) => [l.index, l]));
    const photoDims = dims ?? { w: 0, h: 0 };
    const view = { scale, pan, base, dims: photoDims };

    /** База = ширина вьюпорта × пропорции оригинала. Транформ не участвует. */
    const measure = useCallback(() => {
        const vp = viewportRef.current;
        if (!vp) return;
        const img = imgRef.current;
        const natural = {
            w: img?.naturalWidth || dims?.w || 0,
            h: img?.naturalHeight || dims?.h || 0,
        };
        const next = baseSize(vp.clientWidth, natural);
        if (next.w <= 0) return;
        setBase((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
    }, [dims]);

    useEffect(() => {
        const vp = viewportRef.current;
        if (!vp || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(() => measure());
        ro.observe(vp);
        return () => ro.disconnect();
    }, [measure]);

    useEffect(() => {
        setPan((prev) => clampPan(prev, base, scale));
    }, [base, scale, clampPan, setPan]);

    // Колесо: нативный слушатель (React отдаёт wheel пассивным).
    useEffect(() => {
        const el = viewportRef.current;
        if (!el) return;
        const onWheel = (e: WheelEvent) => {
            if (base.w <= 0) return;
            if (!shouldZoomOnWheel(e.deltaY, scale, e.ctrlKey)) return;
            e.preventDefault();
            const rect = el.getBoundingClientRect();
            const factor = e.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
            zoomAt({ x: e.clientX - rect.left, y: e.clientY - rect.top }, scale * factor);
        };
        el.addEventListener("wheel", onWheel, { passive: false });
        return () => el.removeEventListener("wheel", onWheel);
    }, [base.w, scale, zoomAt]);

    // Клавиши вида при наведении: +, -, 0 и стрелки.
    useEffect(() => {
        if (!hovered || editor) return;
        const onKey = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement | null)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            if (e.key === "+" || e.key === "=") {
                e.preventDefault();
                zoomBy(1);
            } else if (e.key === "-" || e.key === "_") {
                e.preventDefault();
                zoomBy(-1);
            } else if (e.key === "0") {
                e.preventDefault();
                reset();
            } else if (e.key.startsWith("Arrow") && scale > MIN_SCALE) {
                const d = panDeltaFor(e.key, e.shiftKey ? 180 : 60);
                if (d.x === 0 && d.y === 0) return;
                e.preventDefault();
                setPan((prev) => ({ x: prev.x + d.x, y: prev.y + d.y }));
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [hovered, editor, scale, zoomBy, reset, setPan]);

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

    function openEditor(index: number, text: string, bbox: number[][]) {
        if (!dims || !bbox?.length) return;
        const xs = bbox.map((p) => p[0]);
        const ys = bbox.map((p) => p[1]);
        committedRef.current = false;
        setEditor({ index, text, fx: Math.min(...xs) / dims.w, fy: Math.max(...ys) / dims.h });
    }

    function applyEditor() {
        if (!editor || committedRef.current) return;
        committedRef.current = true;
        onEditWord(editor.index, editor.text);
        setEditor(null);
    }

    /** Локальная точка вьюпорта из события указателя. */
    function localPoint(e: ReactPointerEvent<HTMLDivElement>): Pt {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        movedRef.current = false;
        if (e.button !== 0) return;
        if (drawMode && drawing && dims) {
            drawStartRef.current = viewToPhoto(localPoint(e), view);
            setDrawRect({ x: 0, y: 0, w: 0, h: 0 });
            e.currentTarget.setPointerCapture(e.pointerId);
            return;
        }
        if (scale <= MIN_SCALE) return;
        dragRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    };

    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (drawStartRef.current && dims) {
            const cur = viewToPhoto(localPoint(e), view);
            setDrawRect(clampRect(rectFromPoints(drawStartRef.current, cur), dims));
            return;
        }
        const d = dragRef.current;
        if (!d) return;
        const dx = e.clientX - d.x;
        const dy = e.clientY - d.y;
        if (!movedRef.current && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) {
            movedRef.current = true;
            setDragging(true);
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (!movedRef.current) return;
        setPan({ x: d.panX + dx, y: d.panY + dy });
    };

    const endDrag = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (drawStartRef.current) {
            const rect = drawRect;
            drawStartRef.current = null;
            setDrawRect(null);
            if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
            if (rect && dims && drawing && isZoneBigEnough(rect)) {
                drawing.addZone(rectToBbox(clampRect(rect, dims)));
            }
            return;
        }
        if (!dragRef.current) return;
        dragRef.current = null;
        setDragging(false);
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
        }
    };

    const resetView = () => {
        reset();
        setBrightness(100);
        setContrast(100);
        setInverted(false);
        setGrayscale(false);
    };

    const zoomed = scale > MIN_SCALE;
    const center = { x: base.w / 2, y: base.h / 2 };
    const imgFilter =
        `brightness(${brightness}%) contrast(${contrast}%)` +
        (inverted ? " invert(1)" : "") +
        (grayscale ? " grayscale(1)" : "");
    const editorLeft = editor
        ? clamp(editor.fx * base.w * scale + pan.x, 4, Math.max(4, base.w - EDITOR_WIDTH - 4))
        : 0;
    const editorTop = editor
        ? Math.max(4, Math.min(editor.fy * base.h * scale + pan.y + 6, Math.max(4, base.h - 96)))
        : 0;
    const overlayEvents = drawMode ? "none" : "all";
    const overlayCursor = drawMode ? "crosshair" : "pointer";

    return (
        <Card
            sx={{
                scrollbarColor: "#2E7D32 #0E1B2A",
                scrollbarWidth: "thin",
                "& ::-webkit-scrollbar": { width: 10, height: 10 },
                "& ::-webkit-scrollbar-track": { bgcolor: "#0E1B2A" },
                "& ::-webkit-scrollbar-thumb": {
                    bgcolor: "#2E7D32",
                    borderRadius: 8,
                    border: "2px solid #0E1B2A",
                },
                "& ::-webkit-scrollbar-thumb:hover": { bgcolor: "#43A047" },
            }}
        >
            <CardContent sx={{ position: "relative" }}>
                {drawing && <ZoneDrawToolbar drawing={drawing} />}

                <Stack
                    direction="row"
                    spacing={1}
                    sx={{ mb: 1, alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
                >
                    <Tooltip title="Уменьшить (клавиша -)">
                        <span>
                            <IconButton size="small" onClick={() => zoomBy(-1)} disabled={!zoomed}>
                                <RemoveIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Slider
                        size="small"
                        value={scale}
                        min={MIN_SCALE}
                        max={MAX_SCALE}
                        step={0.05}
                        onChange={(_, v) => zoomAt(center, v as number)}
                        aria-label="Масштаб фото"
                        sx={{ width: 130, color: "#2E7D32" }}
                    />
                    <Tooltip title="Увеличить (клавиша +)">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => zoomBy(1)}
                                disabled={scale >= MAX_SCALE}
                            >
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Typography
                        variant="caption"
                        sx={{ minWidth: 46, textAlign: "center", fontFamily: "monospace" }}
                    >
                        {scalePercent(scale)}%
                    </Typography>
                    <Tooltip title="Вписать фото (клавиша 0)">
                        <IconButton size="small" onClick={reset}>
                            <FitScreenIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="1:1 — пиксель фото к пикселю экрана">
                        <span>
                            <IconButton
                                size="small"
                                onClick={() => zoomAt(center, actualScale(dims?.w ?? 0, base.w))}
                                disabled={!dims}
                            >
                                <AspectRatioIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Центр фото, 2×">
                        <span>
                            <IconButton size="small" onClick={() => zoomAt(center, 2)} disabled={base.w <= 0}>
                                <CenterFocusStrongIcon fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title="Сбросить вид и коррекцию">
                        <IconButton size="small" onClick={resetView}>
                            <RestartAltIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Stack
                    direction="row"
                    spacing={1.5}
                    sx={{ mb: 1, alignItems: "center", flexWrap: "wrap", rowGap: 0.5 }}
                >
                    <Typography variant="caption" color="text.secondary">Яркость</Typography>
                    <Slider
                        size="small"
                        value={brightness}
                        min={50}
                        max={180}
                        onChange={(_, v) => setBrightness(v as number)}
                        aria-label="Яркость фото"
                        sx={{ width: 90, color: "#FB8C00" }}
                    />
                    <Typography variant="caption" color="text.secondary">Контраст</Typography>
                    <Slider
                        size="small"
                        value={contrast}
                        min={50}
                        max={220}
                        onChange={(_, v) => setContrast(v as number)}
                        aria-label="Контраст фото"
                        sx={{ width: 90, color: "#1E88E5" }}
                    />
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <Switch
                            size="small"
                            checked={inverted}
                            onChange={(e) => setInverted(e.target.checked)}
                            slotProps={{ input: { "aria-label": "Инверсия фото" } }}
                        />
                        <Typography variant="caption">Инверсия</Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <Switch
                            size="small"
                            checked={grayscale}
                            onChange={(e) => setGrayscale(e.target.checked)}
                            slotProps={{ input: { "aria-label": "Чёрно-белое фото" } }}
                        />
                        <Typography variant="caption">Ч/Б</Typography>
                    </Stack>
                </Stack>

                <Box
                    ref={viewportRef}
                    onMouseEnter={() => setHovered(true)}
                    onMouseLeave={() => setHovered(false)}
                    onPointerDown={onPointerDown}
                    onPointerMove={onPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={endDrag}
                    sx={{
                        position: "relative",
                        overflow: "hidden",
                        width: "100%",
                        height: base.h > 0 ? base.h : undefined,
                        minHeight: base.h > 0 ? undefined : 200,
                        borderRadius: 1,
                        bgcolor: "#0E1B2A",
                        cursor: drawMode ? "crosshair" : zoomed ? (dragging ? "grabbing" : "grab") : "default",
                        touchAction: zoomed || drawMode ? "none" : "pan-y",
                    }}
                >
                    <Box
                        sx={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            width: base.w > 0 ? base.w : "100%",
                            height: base.h > 0 ? base.h : undefined,
                            transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                            transformOrigin: "0 0",
                            willChange: "transform",
                        }}
                    >
                        <img
                            ref={imgRef}
                            src={src}
                            alt="OCR"
                            draggable={false}
                            onLoad={() => {
                                const el = imgRef.current;
                                if (el) setDims({ w: el.naturalWidth, h: el.naturalHeight });
                                measure();
                            }}
                            style={{
                                width: "100%",
                                height: "100%",
                                display: "block",
                                userSelect: "none",
                                filter: imgFilter,
                            }}
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
                                    visibility: showZones || drawMode ? "visible" : "hidden",
                                }}
                            >
                                {zones.map((zone, i) => {
                                    const active = activeField === zone.type;
                                    const color = ZONE_COLORS[zone.type] ?? "#1E3A5F";
                                    const r = bboxToRect(zone.bbox);
                                    return (
                                        <g key={`zone-${i}`}>
                                            <polygon
                                                points={zone.bbox.map(([x, y]) => `${x},${y}`).join(" ")}
                                                fill={active ? "rgba(255, 152, 0, 0.22)" : `${color}18`}
                                                stroke={color}
                                                strokeWidth={(active ? 3 : 2) / scale}
                                                strokeDasharray={zone.source === "manual" ? "10 5" : undefined}
                                                style={{ pointerEvents: overlayEvents, cursor: overlayCursor }}
                                                onClick={() => {
                                                    if (movedRef.current) return;
                                                    onBboxClick(zone.type);
                                                }}
                                            />
                                            {drawMode && (
                                                <text
                                                    x={r.x}
                                                    y={Math.max(r.y - dims.h / 200, dims.h / 60)}
                                                    fill={color}
                                                    fontSize={dims.h / 45 / scale}
                                                    style={{ pointerEvents: "none", fontWeight: 700 }}
                                                >
                                                    {i + 1}. {OCR_ZONE_LABELS[zone.type as OcrZoneType] ?? zone.type}
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                                {task.raw_ocr_data?.words.map((w, i) => {
                                    const text = edits.get(i) ?? w.text;
                                    const isEdited = edits.has(i) && edits.get(i) !== w.text;
                                    const link = linkByIndex.get(i);
                                    const status = link?.status ?? null;
                                    const statusColor = status ? STATUS_COLORS[status] : null;
                                    const isActiveSample = activeWordIndex === i;
                                    const isSelectedInList = link != null && activeSample === link.number;
                                    const targetField = link
                                        ? "sample"
                                        : fieldForWord(text) ?? zoneForWord(w.bbox);
                                    const isActive =
                                        isActiveSample ||
                                        (activeWordIndex === null && targetField !== null && activeField === targetField);
                                    const fill = statusColor
                                        ? `${statusColor}${isActiveSample ? "2E" : isActive ? "44" : "24"}`
                                        : isActive
                                            ? "rgba(255,152,0,0.28)"
                                            : "rgba(30,58,95,0.10)";
                                    const stroke = isActiveSample
                                        ? ACTIVE_SAMPLE_COLOR
                                        : statusColor ??
                                        (isActive ? "rgba(255,152,0,0.95)" : "rgba(30,58,95,0.45)");
                                    const width = (isActiveSample ? 4 : isActive ? 3 : statusColor ? 2 : 1) / scale;
                                    const dash = status === "missing" && !isActiveSample ? "6 3" : undefined;
                                    const xs = w.bbox.map((p) => p[0]);
                                    const ys = w.bbox.map((p) => p[1]);
                                    return (
                                        <g key={`word-${i}`}>
                                            <polygon
                                                ref={(el) => {
                                                    wordRefs.current.set(i, el);
                                                }}
                                                points={w.bbox.map(([x, y]) => `${x},${y}`).join(" ")}
                                                fill={fill}
                                                stroke={stroke}
                                                strokeWidth={width}
                                                strokeDasharray={dash}
                                                style={{ pointerEvents: overlayEvents, cursor: overlayCursor }}
                                                onClick={() => {
                                                    if (movedRef.current) return;
                                                    if (link) onSampleClick(link);
                                                    else if (targetField) onBboxClick(targetField);
                                                }}
                                                onDoubleClick={() => {
                                                    if (drawMode) return;
                                                    openEditor(i, text, w.bbox);
                                                }}
                                            >
                                                <title>
                                                    {link ? `${text} — ${STATUS_LABELS[link.status]}` : text}
                                                    {isEdited ? " (исправлено)" : ""}
                                                    {isSelectedInList ? " · выбрано в списке" : ""}{" · двойной клик — правка"}
                                                </title>
                                            </polygon>
                                            {isActiveSample && (
                                                <rect
                                                    x={Math.min(...xs) - 6 / scale}
                                                    y={Math.min(...ys) - 6 / scale}
                                                    width={Math.max(...xs) - Math.min(...xs) + 12 / scale}
                                                    height={Math.max(...ys) - Math.min(...ys) + 12 / scale}
                                                    fill="none"
                                                    stroke={ACTIVE_SAMPLE_COLOR}
                                                    strokeWidth={3 / scale}
                                                    strokeDasharray={(10 / scale) + " " + (6 / scale)}
                                                    style={{ pointerEvents: "none" }}
                                                />
                                            )}
                                            {isEdited && (
                                                <text
                                                    x={Math.min(...xs)}
                                                    y={Math.min(...ys) - dims.h / 200}
                                                    fill={EDIT_COLOR}
                                                    fontSize={dims.h / 40 / scale}
                                                    style={{ pointerEvents: "none" }}
                                                >
                                                    ✎
                                                </text>
                                            )}
                                        </g>
                                    );
                                })}
                                {drawRect && drawRect.w > 0 && drawRect.h > 0 && (
                                    <rect
                                        x={drawRect.x}
                                        y={drawRect.y}
                                        width={drawRect.w}
                                        height={drawRect.h}
                                        fill="rgba(0,131,143,0.18)"
                                        stroke={EDIT_COLOR}
                                        strokeWidth={2 / scale}
                                        strokeDasharray="8 4"
                                        style={{ pointerEvents: "none" }}
                                    />
                                )}
                            </svg>
                        )}
                    </Box>

                    {editor && (
                        <Box
                            sx={{
                                position: "absolute",
                                left: editorLeft,
                                top: editorTop,
                                width: EDITOR_WIDTH,
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
                                onChange={(e) => setEditor({ ...editor, text: e.target.value })}
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
                </Box>

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
                <Typography
                    variant="caption"
                    sx={{ display: "block", mt: 0.5, color: "text.secondary" }}
                >
                    Пробы: <b style={{ color: STATUS_COLORS.covered }}>зелёный</b> — есть в списке ·{" "}
                    <b style={{ color: STATUS_COLORS.anomaly }}>жёлтый</b> — выбивается ·{" "}
                    <b style={{ color: STATUS_COLORS.missing }}>малиновый пунктир</b> — нет в списке.
                    Выбранная — <b style={{ color: "#0097A7" }}>голубая рамка</b>.{" "}
                    <b style={{ color: EDIT_COLOR }}>Двойной клик по слову — правка</b> (✎).
                    Вид: колесо к курсору, при увеличении — тяни мышью или стрелки
                    (Shift — крупный шаг), клавиши <b>+ / − / 0</b>. Зоны: пунктир — нарисовано вручную.
                </Typography>
            </CardContent>
        </Card>
    );
}