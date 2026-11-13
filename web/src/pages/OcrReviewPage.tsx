/**
 * Экран проверки OCR.
 *
 * c-3.x-migration-5c: layout, approve.
 * c-3.x-migration-5d:
 *   - Порядок: Участок → ТИ → Н/З → Н/З (вх.) → Тип тары → Номер → Пробы.
 *   - SmartAutocomplete (существующий компонент) на все поля с подсказками.
 *   - Н/З подсказки из /storage/suggestions/ (зависят от участка).
 *   - Пробы — textarea (построчный редактор — 5e).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

import { useContainerTypes } from "../api/containerTypes";
import { useResearchTypes, useSites } from "../api/catalogs";
import {
    resolveImageUrl,
    useApproveOcrTask,
    useOcrTask,
    type OcrApprovePayload,
    type OcrTask,
} from "../api/ocr";
import { useSuggestions } from "../api/suggestions";
import {
    parseSampleGroups,
    type ParseResult,
} from "../utils/parseSampleGroups";
import SmartAutocomplete from "../components/SmartAutocomplete";

export default function OcrReviewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const parsedTaskId = id ? parseInt(id, 10) : NaN;
    const taskId = Number.isFinite(parsedTaskId) && parsedTaskId > 0 ? parsedTaskId : null;

    const { data: task, isLoading, error } = useOcrTask(taskId);
    const approve = useApproveOcrTask(taskId ?? 0);

    const containerTypes = useContainerTypes();
    const researchTypes = useResearchTypes();
    const sites = useSites();

    const [siteName, setSiteName] = useState("");
    const [researchTypeName, setResearchTypeName] = useState("");
    const [containerTypeName, setContainerTypeName] = useState("");
    const [workOrderCoded, setWorkOrderCoded] = useState("");
    const [workOrderIncoming, setWorkOrderIncoming] = useState("");
    const [containerNumber, setContainerNumber] = useState("");
    const [sampleGroupsText, setSampleGroupsText] = useState("");
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitOk, setSubmitOk] = useState<string | null>(null);

    const siteId = useMemo(() => {
        if (!siteName) return null;
        const s = sites.data?.find((x) => x.name === siteName || x.code === siteName);
        return s?.id ?? null;
    }, [sites.data, siteName]);

    const researchTypeId = useMemo(() => {
        if (!researchTypeName) return null;
        const clean = researchTypeName.split(" — ")[0].trim();
        const rt = researchTypes.data?.find((x) => x.code === clean || x.name === clean);
        return rt?.id ?? null;
    }, [researchTypes.data, researchTypeName]);

    const containerTypeId = useMemo(() => {
        if (!containerTypeName) return null;
        const ct = containerTypes.data?.find((x) => x.name === containerTypeName);
        return ct?.id ?? null;
    }, [containerTypes.data, containerTypeName]);

    const suggestions = useSuggestions(
        {
            site: siteId ?? undefined,
            research_type: researchTypeId
                ? researchTypes.data?.find((r) => r.id === researchTypeId)?.code
                : undefined,
        },
        siteId !== null || researchTypeId !== null,
    );

    useEffect(() => {
        if (!task?.raw_ocr_data?.text) return;
        const m = task.raw_ocr_data.text.match(/\b[TТ][-–]?\d{2,6}\b/);
        if (m && !containerNumber) setContainerNumber(m[0]);
    }, [task, containerNumber]);

    const parsedGroups: ParseResult = useMemo(
        () => parseSampleGroups(sampleGroupsText),
        [sampleGroupsText],
    );

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }
    if (error || !task) {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                Не удалось загрузить задачу{error ? `: ${String(error)}` : "."}
            </Alert>
        );
    }
    if (task.status === "DONE") {
        return <Alert severity="info" sx={{ m: 2 }}>Задача уже подтверждена.</Alert>;
    }
    if (task.status === "ERROR") {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                OCR упал: {task.error_message || "нет сообщения"}
            </Alert>
        );
    }

    const onSubmit = () => {
        setSubmitError(null);
        setSubmitOk(null);
        if (parsedGroups.errors.length > 0) {
            setSubmitError("Исправь ошибки: " + parsedGroups.errors.join("; "));
            return;
        }
        if (parsedGroups.groups.length === 0) {
            setSubmitError("Добавь хотя бы одну группу проб.");
            return;
        }
        if (containerTypeId === null) {
            setSubmitError("Тип тары не найден в справочнике — выбери из списка.");
            return;
        }
        if (researchTypeId === null) {
            setSubmitError("Тип исследования не найден в справочнике — выбери из списка.");
            return;
        }
        const payload: OcrApprovePayload = {
            container_number: containerNumber.trim(),
            container_type_id: containerTypeId,
            work_order_coded: workOrderCoded.trim(),
            work_order_incoming: workOrderIncoming.trim(),
            research_type_id: researchTypeId,
            site_id: siteId,
            sample_groups: parsedGroups.groups,
        };
        approve.mutate(payload, {
            onSuccess: (res) => {
                setSubmitOk(
                    `Создана тара #${res.container_id}, проб: ${res.samples_created}.` +
                    (res.batch_completed ? " Батч закрыт." : ""),
                );
                setTimeout(
                    () => navigate(`/containers?highlight=${res.container_id}`),
                    1500,
                );
            },
            onError: (e) => {
                setSubmitError(
                    (e as { response?: { data?: { error?: string } } })
                        ?.response?.data?.error ?? String(e),
                );
            },
        });
    };

    return (
        <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
            <Typography variant="h5" gutterBottom>
                Проверка OCR — задача #{task.id} ({task.status})
            </Typography>
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                    alignItems: "start",
                }}
            >
                <ImageWithBboxes task={task} />
                <Paper sx={{ p: 2 }}>
                    <Stack spacing={2}>
                        <Typography variant="subtitle1">Шапка тары</Typography>

                        <SmartAutocomplete
                            label="Участок"
                            value={siteName}
                            onChange={setSiteName}
                            options={(sites.data ?? []).map(
                                (s) => `${s.code} — ${s.name}`,
                            )}
                            loading={sites.isLoading}
                            helperText="Сначала выбери участок — от него зависят подсказки Н/З"
                        />

                        <SmartAutocomplete
                            label="Тип исследования"
                            value={researchTypeName}
                            onChange={setResearchTypeName}
                            options={(researchTypes.data ?? []).map(
                                (r) => `${r.code} — ${r.name}`,
                            )}
                            loading={researchTypes.isLoading}
                            required
                        />

                        <SmartAutocomplete
                            label="Н/З (текущий)"
                            value={workOrderCoded}
                            onChange={setWorkOrderCoded}
                            options={suggestions.data?.work_orders ?? []}
                            loading={suggestions.isFetching}
                            required
                            helperText={
                                siteId === null && researchTypeId === null
                                    ? "Выбери участок или ТИ — появятся подсказки"
                                    : suggestions.data?.work_orders?.length
                                        ? `Подсказок: ${suggestions.data.work_orders.length}`
                                        : "Подсказок нет — введи вручную"
                            }
                        />

                        <SmartAutocomplete
                            label="Н/З (входящий)"
                            value={workOrderIncoming}
                            onChange={setWorkOrderIncoming}
                            options={suggestions.data?.work_orders_incoming ?? []}
                            loading={suggestions.isFetching}
                            helperText={
                                suggestions.data?.work_orders_incoming?.length
                                    ? `Подсказок: ${suggestions.data.work_orders_incoming.length}`
                                    : "Введи вручную"
                            }
                        />

                        <SmartAutocomplete
                            label="Тип тары"
                            value={containerTypeName}
                            onChange={setContainerTypeName}
                            options={(containerTypes.data ?? []).map((c) => c.name)}
                            loading={containerTypes.isLoading}
                            required
                        />

                        <TextField
                            label="Номер тары"
                            value={containerNumber}
                            onChange={(e) => setContainerNumber(e.target.value)}
                            fullWidth
                            size="small"
                        />

                        <Typography variant="subtitle1" sx={{ pt: 1 }}>
                            Пробы
                        </Typography>
                        <TextField
                            label="Группы проб"
                            value={sampleGroupsText}
                            onChange={(e) => setSampleGroupsText(e.target.value)}
                            multiline
                            minRows={4}
                            maxRows={10}
                            fullWidth
                            placeholder={
                                "TAA-A | 34076001 | 001-031\nTAA-B | 34076001 | 001-010"
                            }
                            helperText={
                                parsedGroups.errors.length > 0
                                    ? parsedGroups.errors.join("; ")
                                    : `Разобрано групп: ${parsedGroups.groups.length}. ` +
                                    "Длина `to` = длина sequence (001-031 → трёхзначный, 1-31 → однозначный)."
                            }
                            error={parsedGroups.errors.length > 0}
                        />

                        {submitError && <Alert severity="error">{submitError}</Alert>}
                        {submitOk && <Alert severity="success">{submitOk}</Alert>}

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="contained"
                                onClick={onSubmit}
                                disabled={approve.isPending}
                            >
                                {approve.isPending ? "Сохраняем…" : "Подтвердить"}
                            </Button>
                            <Button onClick={() => navigate(-1)}>Отмена</Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>
        </Box>
    );
}

function ImageWithBboxes({ task }: { task: OcrTask }) {
    const imgRef = useRef<HTMLImageElement | null>(null);
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
    const src = resolveImageUrl(task.image);

    return (
        <Card sx={{ height: "100%" }}>
            <CardContent sx={{ position: "relative", overflow: "auto" }}>
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
                    {dims && task.raw_ocr_data && (
                        <svg
                            viewBox={`0 0 ${dims.w} ${dims.h}`}
                            preserveAspectRatio="none"
                            style={{
                                position: "absolute",
                                inset: 0,
                                width: "100%",
                                height: "100%",
                                pointerEvents: "none",
                            }}
                        >
                            {task.raw_ocr_data.words.map((w, i) => (
                                <polygon
                                    key={i}
                                    points={w.bbox.map(([x, y]) => `${x},${y}`).join(" ")}
                                    fill="rgba(30, 58, 95, 0.15)"
                                    stroke="rgba(30, 58, 95, 0.9)"
                                    strokeWidth={2}
                                />
                            ))}
                        </svg>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}