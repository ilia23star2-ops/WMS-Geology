/**
 * Экран проверки OCR.
 *
 * c-3.x-migration-5c/5d/5f: layout, approve, SmartAutocomplete, подсветка bbox ↔ поля.
 * c-3.x-migration-6e-a3-web-fix: после approve остаёмся на окне.
 * c-3.x-migration-6e-2-web…fix4: легенда зон, аудит проб, мини-зоны фото ↔ строка,
 *   цвета статусов, динамическая готовность + зелёный сигнал.
 * 6e-2-web-fix5: фото, готовность, таблица проб, шапка тары и алерты аудита
 *   вынесены в components/ocr; предзаполнение — useOcrTaskPrefill,
 *   список проб — useOcrRanges, хелперы — utils/ocrRangeHelpers,
 *   ввод диапазона — SampleInputBar.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    FormControlLabel,
    Paper,
    Stack,
    Switch,
    Typography,
} from "@mui/material";

import { useContainerTypes } from "../api/containerTypes";
import {
    useLaboratories,
    useResearchTypes,
    useSites,
} from "../api/catalogs";
import {
    useApproveOcrTask,
    useOcrTask,
    type OcrApprovePayload,
} from "../api/ocr";
import { useSuggestions } from "../api/suggestions";
import RangeEditDialog from "../components/RangeEditDialog";
import {
    auditSamples,
    linkSampleWords,
    normalizeToken,
    rangeNumbers,
    rangeNumberSet,
    type SampleWordLink,
} from "../utils/ocrSampleAudit";
import { checkReadiness } from "../utils/ocrReadiness";
import { buildSampleGroups } from "../utils/ocrRangeHelpers";
import { useOcrRanges } from "../hooks/useOcrRanges";
import { useOcrTaskPrefill } from "../hooks/useOcrTaskPrefill";
import { useSampleBaseOptions } from "../hooks/useSampleBaseOptions";
import ImageWithBboxes from "../components/ocr/ImageWithBboxes";
import RangesTable from "../components/ocr/RangesTable";
import ReadinessPanel from "../components/ocr/ReadinessPanel";
import ContainerHeaderFields from "../components/ocr/ContainerHeaderFields";
import AuditAlerts from "../components/ocr/AuditAlerts";
import SampleInputBar from "../components/ocr/SampleInputBar";

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
    const labs = useLaboratories();

    const laboratoryPrefixes = useMemo(
        () => (labs.data ?? []).flatMap((l) => l.prefixes ?? []),
        [labs.data],
    );
    const siteMatchPatterns = useMemo(
        () => (sites.data ?? []).flatMap((s) => s.match_patterns ?? []),
        [sites.data],
    );
    const validPrefixes = useMemo(() => {
        const codes = (sites.data ?? []).map((s) => s.code);
        return [...codes, ...siteMatchPatterns, ...laboratoryPrefixes];
    }, [sites.data, siteMatchPatterns, laboratoryPrefixes]);

    const [siteName, setSiteName] = useState("");
    const [researchTypeName, setResearchTypeName] = useState("");
    const [containerTypeName, setContainerTypeName] = useState("");
    const [workOrderCoded, setWorkOrderCoded] = useState("");
    const [workOrderIncoming, setWorkOrderIncoming] = useState("");
    const [containerNumber, setContainerNumber] = useState("");

    const [activeField, setActiveField] = useState<string | null>(null);
    const [activeSample, setActiveSample] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitOk, setSubmitOk] = useState<string | null>(null);
    const [showZones, setShowZones] = useState(true);
    const [approvedContainerId, setApprovedContainerId] = useState<number | null>(null);

    const rowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
    const wordRefs = useRef<Map<number, SVGPolygonElement | null>>(new Map());

    const {
        ranges,
        setRanges,
        rangeInput,
        setRangeInput,
        rangeInputError,
        setRangeInputError,
        editingRange,
        setEditingRange,
        parseErrors,
        setParseErrors,
        rangesByWell,
        handleAddRange,
        handleRangeSave,
        removeRange,
    } = useOcrRanges({
        laboratoryPrefixes,
        siteMatchPatterns,
        workOrderIncoming,
        onError: setSubmitError,
    });

    useOcrTaskPrefill({
        task,
        sites: sites.data,
        researchTypes: researchTypes.data,
        containerTypes: containerTypes.data,
        laboratoryPrefixes,
        siteMatchPatterns,
        containerNumber,
        setSiteName,
        setResearchTypeName,
        setContainerTypeName,
        setWorkOrderCoded,
        setWorkOrderIncoming,
        setContainerNumber,
        setRanges,
        setParseErrors,
    });

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

    const baseSampleOptions = useSampleBaseOptions(suggestions.data?.samples, ranges);

    const audit = useMemo(
        () => auditSamples(task?.raw_ocr_data?.words ?? [], ranges, validPrefixes),
        [task, ranges, validPrefixes],
    );
    const anomalySet = useMemo(() => new Set(audit.anomalyIds), [audit]);
    const sampleNumbers = useMemo(() => rangeNumberSet(ranges), [ranges]);

    const links = useMemo(
        () => linkSampleWords(
            task?.raw_ocr_data?.words ?? [],
            ranges,
            audit.anomalyIds,
            validPrefixes,
        ),
        [task, ranges, audit.anomalyIds, validPrefixes],
    );
    const linksByRange = useMemo(() => {
        const m = new Map<string, SampleWordLink[]>();
        for (const l of links) {
            if (!l.rangeId) continue;
            const arr = m.get(l.rangeId);
            if (arr) arr.push(l);
            else m.set(l.rangeId, [l]);
        }
        return m;
    }, [links]);
    const numbersByRange = useMemo(() => {
        const m = new Map<string, string[]>();
        for (const r of ranges) {
            m.set(r.id, rangeNumbers(r).map((n) => normalizeToken(n)));
        }
        return m;
    }, [ranges]);

    const readiness = useMemo(
        () => checkReadiness({
            siteName,
            researchTypeName,
            workOrderCoded,
            containerTypeName,
            containerNumber,
            photoContainerNumber: task?.raw_ocr_data?.extracted?.container_number ?? null,
            rangesCount: ranges.length,
            missingCount: audit.missing.length,
            anomalyCount: audit.anomalyIds.length,
        }),
        [siteName, researchTypeName, workOrderCoded, containerTypeName,
            task, containerNumber, ranges.length, audit.missing.length, audit.anomalyIds.length],
    );

    const focusSampleFromPhoto = (link: SampleWordLink) => {
        setActiveSample(link.number);
        setActiveField("sample");
        if (link.rangeId) {
            rowRefs.current.get(link.rangeId)?.scrollIntoView({
                block: "nearest",
                behavior: "smooth",
            });
        }
    };

    const focusSampleFromRow = (rangeId: string) => {
        const ls = linksByRange.get(rangeId) ?? [];
        const first = ls[0];
        setActiveSample(first ? first.number : numbersByRange.get(rangeId)?.[0] ?? null);
        setActiveField("sample");
        if (first) {
            wordRefs.current.get(first.index)?.scrollIntoView({
                block: "center",
                inline: "center",
                behavior: "smooth",
            });
        }
    };

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
    if (task.status === "DONE" && submitOk === null) {
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
        if (ranges.length === 0) {
            setSubmitError("Добавь хотя бы одну группу проб.");
            return;
        }
        if (containerTypeId === null) {
            setSubmitError("Тип тары не найден — выбери из списка.");
            return;
        }
        if (containerNumber.trim() === "") {
            setSubmitError("Номер тары обязателен.");
            return;
        }
        if (researchTypeId === null) {
            setSubmitError("Тип исследования не найден — выбери из списка.");
            return;
        }
        if (workOrderCoded.trim() === "") {
            setSubmitError("Н/З (текущий) обязателен.");
            return;
        }
        const sampleGroups = buildSampleGroups(ranges, workOrderIncoming.trim() !== "");
        if (sampleGroups.length === 0) {
            setSubmitError("Все пробы пропущены — оставь хотя бы одну.");
            return;
        }
        const payload: OcrApprovePayload = {
            container_number: containerNumber.trim(),
            container_type_id: containerTypeId,
            work_order_coded: workOrderCoded.trim(),
            work_order_incoming: workOrderIncoming.trim(),
            research_type_id: researchTypeId,
            site_id: siteId,
            sample_groups: sampleGroups,
        };
        approve.mutate(payload, {
            onSuccess: (res) => {
                setApprovedContainerId(res.container_id);
                setSubmitOk(
                    `Создана тара #${res.container_id}, проб: ${res.samples_created}.` +
                    (res.batch_completed ? " Батч закрыт." : ""),
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

    const focusField = (name: string) => setActiveField(name);
    const blurField = () => setActiveField(null);

    return (
        <Box sx={{ p: 2, height: "100%", overflow: "auto" }}>
            <Typography variant="h5" gutterBottom>
                Проверка OCR — задача #{task.id} ({task.status})
            </Typography>
            <FormControlLabel
                sx={{ mb: 1 }}
                control={
                    <Switch
                        size="small"
                        checked={showZones}
                        onChange={(e) => setShowZones(e.target.checked)}
                    />
                }
                label="Показывать зоны на фото"
            />
            <Box
                sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                    gap: 2,
                    alignItems: "start",
                }}
            >
                <Box
                    sx={{
                        position: { md: "sticky" },
                        top: { md: 8 },
                        alignSelf: "start",
                        maxHeight: { md: "calc(100vh - 110px)" },
                        overflow: { md: "auto" },
                    }}
                >
                    <ImageWithBboxes
                        task={task}
                        activeField={activeField}
                        activeSample={activeSample}
                        showZones={showZones}
                        sampleNumbers={sampleNumbers}
                        validPrefixes={validPrefixes}
                        links={links}
                        wordRefs={wordRefs}
                        onBboxClick={(type) => setActiveField(type)}
                        onSampleClick={focusSampleFromPhoto}
                    />
                </Box>
                <Paper sx={{ p: 2 }}>
                    <Stack spacing={2}>
                        <ContainerHeaderFields
                            siteName={siteName}
                            onSiteNameChange={setSiteName}
                            researchTypeName={researchTypeName}
                            onResearchTypeNameChange={setResearchTypeName}
                            workOrderCoded={workOrderCoded}
                            onWorkOrderCodedChange={setWorkOrderCoded}
                            workOrderIncoming={workOrderIncoming}
                            onWorkOrderIncomingChange={setWorkOrderIncoming}
                            containerTypeName={containerTypeName}
                            onContainerTypeNameChange={setContainerTypeName}
                            containerNumber={containerNumber}
                            onContainerNumberChange={setContainerNumber}
                            siteOptions={(sites.data ?? []).map((s) => `${s.code} — ${s.name}`)}
                            sitesLoading={sites.isLoading}
                            researchTypeOptions={(researchTypes.data ?? []).map((r) => `${r.code} — ${r.name}`)}
                            researchTypesLoading={researchTypes.isLoading}
                            containerTypeOptions={(containerTypes.data ?? []).map((c) => c.name)}
                            containerTypesLoading={containerTypes.isLoading}
                            workOrderOptions={suggestions.data?.work_orders ?? []}
                            workOrderIncomingOptions={suggestions.data?.work_orders_incoming ?? []}
                            suggestionsLoading={suggestions.isFetching}
                            siteId={siteId}
                            researchTypeId={researchTypeId}
                            activeField={activeField}
                            onFocusField={focusField}
                            onBlurField={blurField}
                        />

                        <Box>
                            <Typography variant="subtitle1" sx={{ pt: 1 }}>
                                Пробы ({ranges.length})
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                На фото распознано проб: {audit.photoSamples.length} · в списке: {ranges.length}
                            </Typography>
                        </Box>

                        <SampleInputBar
                            value={rangeInput}
                            onChange={(v) => {
                                setRangeInput(v);
                                setRangeInputError(null);
                            }}
                            options={baseSampleOptions}
                            loading={suggestions.isFetching}
                            error={rangeInputError}
                            onAdd={handleAddRange}
                            onFocus={() => focusField("sample")}
                            onBlur={blurField}
                        />

                        {ranges.length > 0 && (
                            <RangesTable
                                rangesByWell={rangesByWell}
                                anomalySet={anomalySet}
                                linksByRange={linksByRange}
                                numbersByRange={numbersByRange}
                                activeSample={activeSample}
                                rowRefs={rowRefs}
                                onRowClick={focusSampleFromRow}
                                onEdit={setEditingRange}
                                onRemove={removeRange}
                            />
                        )}

                        <AuditAlerts
                            missing={audit.missing}
                            anomalyCount={audit.anomalyIds.length}
                            parseErrors={parseErrors}
                            onMissingClick={setRangeInput}
                        />

                        <ReadinessPanel readiness={readiness} />

                        {submitError && <Alert severity="error">{submitError}</Alert>}
                        {submitOk && <Alert severity="success">{submitOk}</Alert>}

                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="contained"
                                color={readiness.ready ? "success" : "primary"}
                                onClick={onSubmit}
                                disabled={
                                    approve.isPending ||
                                    submitOk !== null ||
                                    readiness.blockers > 0
                                }
                            >
                                {approve.isPending ? "Сохраняем…" : submitOk ? "Подтверждено" : "Подтвердить"}
                            </Button>
                            {approvedContainerId !== null && (
                                <Button
                                    variant="outlined"
                                    onClick={() =>
                                        navigate(`/containers?highlight=${approvedContainerId}`)
                                    }
                                >
                                    Открыть тару
                                </Button>
                            )}
                            <Button onClick={() => navigate(-1)}>Отмена</Button>
                        </Stack>
                    </Stack>
                </Paper>
            </Box>

            <RangeEditDialog
                open={editingRange !== null}
                initialRaw={editingRange?.rawInput ?? ""}
                initialSkipped={editingRange?.skippedSeqs.join(" ") ?? ""}
                initialSelected={editingRange?.selectedSeqs.join(" ") ?? ""}
                onClose={() => setEditingRange(null)}
                onSave={handleRangeSave}
            />
        </Box>
    );
}