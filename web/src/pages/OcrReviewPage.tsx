/**
 * Экран проверки OCR.
 *
 * c-3.x-migration-5c/5d/5f: layout, approve, SmartAutocomplete, подсветка bbox ↔ поля.
 * c-3.x-migration-6e-a3-web-fix: после approve остаёмся на окне.
 * c-3.x-migration-6e-2-web…fix4: легенда зон, аудит проб, мини-зоны фото ↔ строка,
 *   цвета статусов, динамическая готовность + зелёный сигнал.
 * 6e-2-web-fix5: компоненты в components/ocr, хуки предзаполнения и проб.
 * 6e-2-web-fix6: обратный аудит «нет на фото», дубли как блокер.
 * 6e-2-web-fix7: вкладки «Шапка тары» / «Пробы», подсказки под полями,
 *   компактная строка-статус; клик по зоне переключает нужную вкладку.
 * 6e-2-web-fix8: deep-link ?open → карточка тары.
 * 6e-2-web-2: инлайн-правка OCR-токенов на фото — аудит считается по правкам,
 *   исправленная проба добавляется сама (с отменой), вкладки вынесены в ReviewTabs.
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
import { checkReadiness, readinessByKey } from "../utils/ocrReadiness";
import { buildSampleGroups } from "../utils/ocrRangeHelpers";
import { useOcrRanges } from "../hooks/useOcrRanges";
import { useOcrTaskPrefill } from "../hooks/useOcrTaskPrefill";
import { useSampleBaseOptions } from "../hooks/useSampleBaseOptions";
import { useOcrTokenEdits } from "../hooks/useOcrTokenEdits";
import { useSampleHints } from "../hooks/useSampleHints";
import ImageWithBboxes from "../components/ocr/ImageWithBboxes";
import ReadinessPanel from "../components/ocr/ReadinessPanel";
import ContainerHeaderFields from "../components/ocr/ContainerHeaderFields";
import SamplesPanel from "../components/ocr/SamplesPanel";
import TokenEditsPanel from "../components/ocr/TokenEditsPanel";
import ReviewTabs, { type ReviewTab } from "../components/ocr/ReviewTabs";
import { useZoneDrawing } from "../hooks/useZoneDrawing";

const HEADER_KEYS = [
    "site",
    "research_type",
    "work_order_coded",
    "container_type",
    "container_number",
    "container_number_photo",
];

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
    const photoWords = useMemo(() => task?.raw_ocr_data?.words ?? [], [task]);

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
    const [tab, setTab] = useState<ReviewTab>("header");

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

    const tokenEdits = useOcrTokenEdits({
        words: photoWords,
        ranges,
        setRanges,
        laboratoryPrefixes,
        siteMatchPatterns,
        workOrderIncoming,
    });

    const zoneDrawing = useZoneDrawing({
        containerTypes: (containerTypes.data ?? []).map((c) => c.name),
        setContainerTypeName,
        task,
        words: photoWords,
        ranges,
        setRanges,
        laboratoryPrefixes,
        siteMatchPatterns,
        workOrderIncoming,
        sites: sites.data,
        researchTypes: researchTypes.data,
        setSiteName,
        setResearchTypeName,
        setWorkOrderCoded,
        setWorkOrderIncoming,
        setContainerNumber,
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

    // 6e-2-web-7-web: контекст аудита — зоны разметки и скаляры шапки.
    const auditCtx = useMemo(
        () => ({
            zones: zoneDrawing.zones,
            scalars: [workOrderCoded, workOrderIncoming, containerNumber],
        }),
        [zoneDrawing.zones, workOrderCoded, workOrderIncoming, containerNumber],
    );

    const audit = useMemo(
        () => auditSamples(photoWords, ranges, validPrefixes, auditCtx),
        [photoWords, ranges, validPrefixes, auditCtx],
    );
    const anomalySet = useMemo(() => new Set(audit.anomalyIds), [audit]);
    const notOnPhotoSet = useMemo(() => new Set(audit.notOnPhotoIds), [audit]);
    const duplicateSet = useMemo(() => new Set(audit.duplicateIds), [audit]);
    const sampleNumbers = useMemo(() => rangeNumberSet(ranges), [ranges]);

    const links = useMemo(
        () => linkSampleWords(
            photoWords,
            ranges,
            audit.anomalyIds,
            validPrefixes,
            auditCtx,
        ),
        [photoWords, ranges, audit.anomalyIds, validPrefixes, auditCtx],
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

    const sampleHints = useSampleHints({
        ranges,
        setRanges,
        missing: audit.missing,
        validPrefixes,
        photoSampleCount: audit.photoSamples.length,
        anomalyIds: audit.anomalyIds,
        links,
        words: photoWords,
        wordRefs,
        setActiveSample,
        setActiveField,
        laboratoryPrefixes,
        siteMatchPatterns,
        workOrderIncoming,
    });

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
            duplicateCount: audit.duplicateNumbers.length,
            notOnPhotoCount: audit.notOnPhotoIds.length,
            unconfirmedEditCount: tokenEdits.unconfirmedCount,
        }),
        [siteName, researchTypeName, workOrderCoded, containerTypeName,
            task, containerNumber, ranges.length, audit, tokenEdits.unconfirmedCount],
    );
    const issuesByKey = useMemo(() => readinessByKey(readiness), [readiness]);

    const headerProblems = HEADER_KEYS.filter(
        (k) => issuesByKey[k] && !issuesByKey[k].ok,
    ).length;
    const sampleProblems =
        audit.duplicateNumbers.length +
        audit.missing.length +
        audit.notOnPhotoIds.length +
        audit.anomalyIds.length +
        (ranges.length === 0 ? 1 : 0);

    const focusSampleFromPhoto = (link: SampleWordLink) => {
        sampleHints.focusWord(link.index, link.number);
        setActiveField("sample");
        setTab("samples");
        if (link.rangeId) {
            const rid = link.rangeId;
            window.setTimeout(() => {
                rowRefs.current.get(rid)?.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                });
            }, 60);
        }
    };

    const focusSampleFromRow = (rangeId: string) => {
        const ls = linksByRange.get(rangeId) ?? [];
        const first = ls[0];
        sampleHints.focusRange(rangeId);
        setActiveField("sample");
        if (first) {
            wordRefs.current.get(first.index)?.scrollIntoView({
                block: "center",
                inline: "center",
                behavior: "smooth",
            });
        }
    };

    const handleBboxClick = (type: string) => {
        sampleHints.clearFocus();
        setActiveField(type);
        setTab(type === "sample" ? "samples" : "header");
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

    const focusField = (name: string) => { sampleHints.clearFocus(); setActiveField(name); };
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
                        edits={tokenEdits.edits}
                        activeWordIndex={sampleHints.activeWordIndex}
                        onEditWord={tokenEdits.commitEdit}
                        onBboxClick={handleBboxClick}
                        onSampleClick={focusSampleFromPhoto}
                        drawing={zoneDrawing}
                    />
                </Box>
                <Paper sx={{ p: 2 }}>
                    <ReviewTabs
                        value={tab}
                        onChange={setTab}
                        rangesCount={ranges.length}
                        headerProblems={headerProblems}
                        sampleProblems={sampleProblems}
                        hasDuplicates={audit.duplicateNumbers.length > 0}
                    />

                    <Stack spacing={2}>
                        {tokenEdits.notice && (
                            <Alert
                                severity="success"
                                action={
                                    <Button
                                        size="small"
                                        color="inherit"
                                        onClick={tokenEdits.undoAutoAdd}
                                    >
                                        Отменить
                                    </Button>
                                }
                            >
                                {tokenEdits.notice}
                            </Alert>
                        )}

                        <TokenEditsPanel
                            edits={tokenEdits.editList}
                            onRevert={tokenEdits.revertEdit}
                            verdicts={tokenEdits.verdicts}
                            acknowledged={tokenEdits.acknowledged}
                            onAcknowledge={tokenEdits.acknowledge}
                        />

                        {tab === "header" ? (
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
                                issues={issuesByKey}
                                onFocusField={focusField}
                                onBlurField={blurField}
                            />
                        ) : (
                            <SamplesPanel
                                rangesCount={ranges.length}
                                audit={audit}
                                parseErrors={parseErrors}
                                rangeInput={rangeInput}
                                onRangeInputChange={(v) => {
                                    setRangeInput(v);
                                    setRangeInputError(null);
                                }}
                                rangeInputError={rangeInputError}
                                baseSampleOptions={baseSampleOptions}
                                suggestionsLoading={suggestions.isFetching}
                                onAddRange={handleAddRange}
                                onFocusInput={() => focusField("sample")}
                                onBlurInput={blurField}
                                rangesByWell={rangesByWell}
                                anomalySet={anomalySet}
                                notOnPhotoSet={notOnPhotoSet}
                                duplicateSet={duplicateSet}
                                linksByRange={linksByRange}
                                numbersByRange={numbersByRange}
                                activeSample={activeSample}
                                rowRefs={rowRefs}
                                onRowClick={focusSampleFromRow}
                                onEdit={setEditingRange}
                                onRemove={removeRange}
                                anomalies={sampleHints.anomalies}
                                hints={sampleHints.hints}
                                onAnomalyClick={sampleHints.focusRange}
                                onHintView={sampleHints.focusRange}
                                onHintFix={sampleHints.fixHint}
                                prefixIssues={sampleHints.prefixIssues}
                                countMismatch={sampleHints.countMismatch}
                                onPrefixClick={sampleHints.focusRange}
                            />
                        )}

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
                                        navigate(`/containers?open=${approvedContainerId}`)
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