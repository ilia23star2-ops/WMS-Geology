/**
 * Экран проверки OCR.
 *
 * c-3.x-migration-5c/5d/5f: layout, approve, SmartAutocomplete, подсветка bbox ↔ поля.
 * c-3.x-migration-6e-a3-web-fix: после approve остаёмся на окне.
 * c-3.x-migration-6e-2-web: переключатель зон + «Открыть тару».
 * c-3.x-migration-6e-2-web-fix…fix4:
 *   - легенда вместо подписей, аудит проб, нормализация OCR-токенов;
 *   - мини-зоны проб: клик по пробе на фото → строка списка, и обратно;
 *   - цвет строки = цвет её бокса (зелёный / жёлтый / малиновый пунктир);
 *   - динамическая готовность к подтверждению + зелёный сигнал.
 * 6e-2-web: фото (ImageWithBboxes), готовность (ReadinessPanel) и таблица проб
 *   (RangesTable) вынесены в components/ocr.
 * 6e-2-web-fix5: шапка тары (ContainerHeaderFields) и алерты аудита (AuditAlerts)
 *   вынесены в components/ocr.
 */
import { useEffect, useMemo, useRef, useState } from "react";
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
import AddIcon from "@mui/icons-material/Add";

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
    type SampleGroup,
} from "../api/ocr";
import { useSuggestions } from "../api/suggestions";
import SmartAutocomplete from "../components/SmartAutocomplete";
import RangeEditDialog from "../components/RangeEditDialog";
import { parseSampleInput } from "../utils/parseSampleInput";
import {
    auditSamples,
    linkSampleWords,
    normalizeToken,
    rangeNumbers,
    rangeNumberSet,
    type SampleWordLink,
} from "../utils/ocrSampleAudit";
import { checkReadiness } from "../utils/ocrReadiness";
import ImageWithBboxes from "../components/ocr/ImageWithBboxes";
import RangesTable, { type RangeEntry } from "../components/ocr/RangesTable";
import ReadinessPanel from "../components/ocr/ReadinessPanel";
import ContainerHeaderFields from "../components/ocr/ContainerHeaderFields";
import AuditAlerts from "../components/ocr/AuditAlerts";

function newRangeId(): string {
    return `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeAllSeqs(from: number, to: number): number[] {
    const out: number[] = [];
    for (let i = from; i <= to; i++) out.push(i);
    return out;
}

function groupSeqsToRanges(
    r: RangeEntry,
    seqs: number[],
    status: "NORMAL" | "SELECTED",
    wellName: string | null,
): SampleGroup[] {
    if (seqs.length === 0) return [];
    const sorted = [...seqs].sort((a, b) => a - b);
    const groups: SampleGroup[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            groups.push({
                prefix: r.prefix,
                middle: r.middle,
                sequence_from: start,
                sequence_to: prev,
                sequence_digits: r.sequenceDigits,
                well_name: wellName,
                status,
            });
            start = sorted[i];
            prev = sorted[i];
        }
    }
    groups.push({
        prefix: r.prefix,
        middle: r.middle,
        sequence_from: start,
        sequence_to: prev,
        sequence_digits: r.sequenceDigits,
        well_name: wellName,
        status,
    });
    return groups;
}

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

    const [ranges, setRanges] = useState<RangeEntry[]>([]);
    const [rangeInput, setRangeInput] = useState("");
    const [rangeInputError, setRangeInputError] = useState<string | null>(null);
    const [editingRange, setEditingRange] = useState<RangeEntry | null>(null);

    const [activeField, setActiveField] = useState<string | null>(null);
    const [activeSample, setActiveSample] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitOk, setSubmitOk] = useState<string | null>(null);
    const [parseErrors, setParseErrors] = useState<string[]>([]);
    const [prefilled, setPrefilled] = useState(false);
    const [showZones, setShowZones] = useState(true);
    const [approvedContainerId, setApprovedContainerId] = useState<number | null>(null);

    const rowRefs = useRef<Map<string, HTMLTableRowElement | null>>(new Map());
    const wordRefs = useRef<Map<number, SVGPolygonElement | null>>(new Map());

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

    const usedSampleNumbers = useMemo(() => {
        const set = new Set<string>();
        for (const r of ranges) {
            for (let i = r.sequenceFrom; i <= r.sequenceTo; i++) {
                const seq = String(i).padStart(r.sequenceDigits, "0");
                set.add(`${r.prefix}${r.middle}${seq}`);
            }
        }
        return set;
    }, [ranges]);

    const baseSampleOptions = useMemo(() => {
        const samples = suggestions.data?.samples ?? [];
        const groups = new Map<string, string[]>();
        for (const sampleNumber of samples) {
            const base = sampleNumber.slice(0, -2);
            const arr = groups.get(base);
            if (arr) arr.push(sampleNumber);
            else groups.set(base, [sampleNumber]);
        }
        const result: string[] = [];
        for (const [base, sampleNumbers] of groups) {
            const hasUnused = sampleNumbers.some((n) => !usedSampleNumbers.has(n));
            if (hasUnused) result.push(base);
        }
        return result.sort();
    }, [suggestions.data, usedSampleNumbers]);

    // ---------- предзаполнение ----------
    useEffect(() => {
        if (!task || prefilled) return;
        const ex = task.raw_ocr_data?.extracted;
        if (!ex) {
            setPrefilled(true);
            return;
        }
        if (ex.work_order_coded) setWorkOrderCoded(ex.work_order_coded);
        if (ex.work_order_incoming) setWorkOrderIncoming(ex.work_order_incoming);
        if (!sites.data || !researchTypes.data || !containerTypes.data) {
            return;
        }
        if (ex.container_number) setContainerNumber(ex.container_number);
        if (ex.site) {
            const s = sites.data.find((x) => x.code === ex.site);
            setSiteName(s ? `${s.code} — ${s.name}` : ex.site);
        }
        if (ex.container_type) setContainerTypeName(ex.container_type);
        if (ex.research_type) {
            const rt = researchTypes.data.find(
                (x) => x.code === ex.research_type || x.name === ex.research_type,
            );
            setResearchTypeName(rt ? `${rt.code} — ${rt.name}` : ex.research_type);
        }
        if (ex.samples && ex.samples.length > 0) {
            const opts = {
                laboratoryPrefixes,
                siteMatchPatterns,
                hasIncomingWorkOrder: (ex.work_order_incoming ?? "").trim() !== "",
            };
            const parsed: RangeEntry[] = [];
            const errors: string[] = [];
            for (const num of ex.samples) {
                const r = parseSampleInput(num, opts);
                if (r.ok) {
                    parsed.push({
                        id: newRangeId(),
                        rawInput: num,
                        ...r.value,
                        allSeqs: makeAllSeqs(r.value.sequenceFrom, r.value.sequenceTo),
                        skippedSeqs: [],
                        selectedSeqs: [],
                    });
                } else {
                    errors.push(num);
                    parsed.push({
                        id: newRangeId(),
                        rawInput: num,
                        prefix: "",
                        middle: num,
                        sequenceFrom: 1,
                        sequenceTo: 1,
                        sequenceDigits: 1,
                        wellName: null,
                        allSeqs: [1],
                        skippedSeqs: [],
                        selectedSeqs: [],
                    });
                }
            }
            setRanges(parsed);
            setParseErrors(errors);
        }
        setPrefilled(true);
    }, [task, prefilled, sites.data, researchTypes.data, containerTypes.data, laboratoryPrefixes, siteMatchPatterns]);

    useEffect(() => {
        if (!task?.raw_ocr_data?.text) return;
        if (containerNumber) return;
        const m = task.raw_ocr_data.text.match(/\b[TТ][-–]?\d{2,6}\b/);
        if (m) setContainerNumber(m[0]);
    }, [task, containerNumber]);

    const rangesByWell = useMemo(() => {
        const map = new Map<string, RangeEntry[]>();
        for (const r of ranges) {
            const key = r.wellName ?? "__none__";
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(r);
        }
        const entries = Array.from(map.entries()).sort((a, b) =>
            a[0].localeCompare(b[0], "ru", { numeric: true }),
        );
        for (const [, list] of entries) {
            list.sort((a, b) =>
                a.rawInput.localeCompare(b.rawInput, "ru", { numeric: true }),
            );
        }
        return entries;
    }, [ranges]);

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
            photoContainerNumber: task.raw_ocr_data?.extracted?.container_number ?? null,
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

    const handleAddRange = () => {
        const result = parseSampleInput(rangeInput, {
            laboratoryPrefixes,
            siteMatchPatterns,
            hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
        });
        if (!result.ok) {
            setRangeInputError(result.error);
            return;
        }
        setRanges((prev) => [
            ...prev,
            {
                id: newRangeId(),
                rawInput: rangeInput.trim(),
                ...result.value,
                allSeqs: makeAllSeqs(result.value.sequenceFrom, result.value.sequenceTo),
                skippedSeqs: [],
                selectedSeqs: [],
            },
        ]);
        setRangeInput("");
        setRangeInputError(null);
    };

    const handleRangeSave = (raw: string, skipped: number[], selected: number[]) => {
        if (!editingRange) return;
        const result = parseSampleInput(raw, {
            laboratoryPrefixes,
            siteMatchPatterns,
            hasIncomingWorkOrder: workOrderIncoming.trim() !== "",
        });
        if (!result.ok) {
            setSubmitError(result.error);
            return;
        }
        const validSkipped = skipped.filter(
            (s) => s >= result.value.sequenceFrom && s <= result.value.sequenceTo,
        );
        const validSelected = selected.filter(
            (s) => s >= result.value.sequenceFrom && s <= result.value.sequenceTo,
        );
        setRanges((prev) =>
            prev.map((r) =>
                r.id === editingRange.id
                    ? {
                        id: r.id,
                        rawInput: raw.trim(),
                        ...result.value,
                        allSeqs: makeAllSeqs(result.value.sequenceFrom, result.value.sequenceTo),
                        skippedSeqs: validSkipped,
                        selectedSeqs: validSelected,
                    }
                    : r,
            ),
        );
        setEditingRange(null);
    };

    const removeRange = (id: string) => {
        setRanges((prev) => prev.filter((r) => r.id !== id));
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
        const hasIncoming = workOrderIncoming.trim() !== "";
        const sampleGroups: SampleGroup[] = [];
        for (const r of ranges) {
            const wellName = hasIncoming ? null : r.middle;
            const skipped = new Set(r.skippedSeqs);
            const selected = new Set(r.selectedSeqs);
            const normal = r.allSeqs.filter((s) => !skipped.has(s) && !selected.has(s));
            const selArr = r.allSeqs.filter((s) => selected.has(s) && !skipped.has(s));
            sampleGroups.push(...groupSeqsToRanges(r, normal, "NORMAL", wellName));
            sampleGroups.push(...groupSeqsToRanges(r, selArr, "SELECTED", wellName));
        }
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

                        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                            <Box sx={{ flexGrow: 1 }} onFocus={() => focusField("sample")} onBlur={blurField}>
                                <SmartAutocomplete
                                    label="Диапазон проб"
                                    value={rangeInput}
                                    onChange={(v) => {
                                        setRangeInput(v);
                                        setRangeInputError(null);
                                    }}
                                    options={baseSampleOptions}
                                    loading={suggestions.isFetching}
                                    appendOnSelect="-"
                                    error={Boolean(rangeInputError)}
                                    helperText={
                                        rangeInputError ??
                                        "Выбери базу из подсказок (клик → «-») или введи вручную: TAA-A34076001-031"
                                    }
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault();
                                            handleAddRange();
                                        }
                                    }}
                                />
                            </Box>
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={handleAddRange}
                                sx={{ whiteSpace: "nowrap", height: 40 }}
                            >
                                Добавить
                            </Button>
                        </Box>

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
