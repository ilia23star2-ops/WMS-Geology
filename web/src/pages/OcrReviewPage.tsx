/**
 * Экран проверки OCR: слева фото + bbox-overlay, справа форма.
 *
 * c-3.x-migration-5b. Открывается по `/ocr/review/:id`,
 * где `id` — OcrTask.id.
 *
 * MUI 9: не используем <Grid item> / <Grid container> — заменяем на
 * Box + display: grid.
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

import {
    resolveImageUrl,
    useApproveOcrTask,
    useOcrTask,
    type OcrApprovePayload,
    type OcrTask,
} from "../api/ocr";
import {
    parseSampleGroups,
    type ParseResult,
} from "../utils/parseSampleGroups";

export default function OcrReviewPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const taskId = id ? parseInt(id, 10) : null;

    const { data: task, isLoading, error } = useOcrTask(
        taskId && Number.isFinite(taskId) ? taskId : null,
    );
    const approve = useApproveOcrTask(taskId ?? 0);

    const [containerNumber, setContainerNumber] = useState("");
    const [containerTypeId, setContainerTypeId] = useState<number | "">("");
    const [cellId, setCellId] = useState<number | "">("");
    const [workOrderCoded, setWorkOrderCoded] = useState("");
    const [workOrderIncoming, setWorkOrderIncoming] = useState("");
    const [researchTypeId, setResearchTypeId] = useState<number | "">("");
    const [siteId, setSiteId] = useState<number | "">("");
    const [sampleGroupsText, setSampleGroupsText] = useState("");
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitOk, setSubmitOk] = useState<string | null>(null);

    useEffect(() => {
        if (!task?.raw_ocr_data?.text) return;
        const text = task.raw_ocr_data.text;
        const m = text.match(/\b[TТ][-–]?\d{2,6}\b/);
        if (m && !containerNumber) {
            setContainerNumber(m[0]);
        }
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
        return (
            <Alert severity="info" sx={{ m: 2 }}>
                Задача уже подтверждена.
            </Alert>
        );
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
            setSubmitError("Исправь ошибки в списке проб: " + parsedGroups.errors.join("; "));
            return;
        }
        if (parsedGroups.groups.length === 0) {
            setSubmitError("Добавь хотя бы одну группу проб.");
            return;
        }
        if (!containerTypeId || !researchTypeId) {
            setSubmitError("Выбери тип тары и тип исследования.");
            return;
        }
        const payload: OcrApprovePayload = {
            container_number: containerNumber.trim(),
            container_type_id: Number(containerTypeId),
            cell_id: cellId === "" ? null : Number(cellId),
            work_order_coded: workOrderCoded.trim(),
            work_order_incoming: workOrderIncoming.trim(),
            research_type_id: Number(researchTypeId),
            site_id: siteId === "" ? null : Number(siteId),
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
                        <TextField
                            label="Номер тары"
                            value={containerNumber}
                            onChange={(e) => setContainerNumber(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Тип тары (ID)"
                            type="number"
                            value={containerTypeId}
                            onChange={(e) =>
                                setContainerTypeId(
                                    e.target.value === "" ? "" : Number(e.target.value),
                                )
                            }
                            fullWidth
                            helperText="Справочник — c-5c. Пока ID вручную."
                        />
                        <TextField
                            label="Ячейка (ID, опционально)"
                            type="number"
                            value={cellId}
                            onChange={(e) =>
                                setCellId(
                                    e.target.value === "" ? "" : Number(e.target.value),
                                )
                            }
                            fullWidth
                        />
                        <TextField
                            label="Н/З (зашифрованный)"
                            value={workOrderCoded}
                            onChange={(e) => setWorkOrderCoded(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="Н/З (входящий)"
                            value={workOrderIncoming}
                            onChange={(e) => setWorkOrderIncoming(e.target.value)}
                            fullWidth
                        />
                        <TextField
                            label="ТИ (ID)"
                            type="number"
                            value={researchTypeId}
                            onChange={(e) =>
                                setResearchTypeId(
                                    e.target.value === "" ? "" : Number(e.target.value),
                                )
                            }
                            fullWidth
                            helperText="Справочник — c-5c. Пока ID вручную."
                        />
                        <TextField
                            label="Участок (ID)"
                            type="number"
                            value={siteId}
                            onChange={(e) =>
                                setSiteId(
                                    e.target.value === "" ? "" : Number(e.target.value),
                                )
                            }
                            fullWidth
                            helperText="Справочник — c-5c. Пока ID вручную."
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
                            placeholder={"TAA-A | 34076001 | 1-31\nTAA-B | 34076001 | 1-10"}
                            helperText={
                                parsedGroups.errors.length > 0
                                    ? parsedGroups.errors.join("; ")
                                    : `Разобрано групп: ${parsedGroups.groups.length}`
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

    const onLoad = () => {
        const el = imgRef.current;
        if (!el) return;
        setDims({ w: el.naturalWidth, h: el.naturalHeight });
    };

    return (
        <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
            <CardContent sx={{ flex: 1, position: "relative", overflow: "auto" }}>
                <div style={{ position: "relative", display: "inline-block" }}>
                    <img
                        ref={imgRef}
                        src={src}
                        alt="OCR"
                        onLoad={onLoad}
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
                            {task.raw_ocr_data.words.map((w, i) => {
                                const pts = w.bbox
                                    .map(([x, y]) => `${x},${y}`)
                                    .join(" ");
                                return (
                                    <polygon
                                        key={i}
                                        points={pts}
                                        fill="rgba(30, 58, 95, 0.15)"
                                        stroke="rgba(30, 58, 95, 0.9)"
                                        strokeWidth={2}
                                    />
                                );
                            })}
                        </svg>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}