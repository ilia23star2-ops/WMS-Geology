/**
 * Диалог предпросмотра тары (2f-11b).
 * Добавлены: фильтр, чекбоксы и массовая смена статуса проб.
 */
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Paper,
    Select,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tabs,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import QrCodeIcon from "@mui/icons-material/QrCode";
import EditIcon from "@mui/icons-material/Edit";

import {
    downloadLabelPdf,
    fetchLabelPdfUrl,
    useContainer,
    useSamples,
    useUpdateSample,
    type SampleStatus,
    SAMPLE_STATUS_LABELS,
} from "../api";
import AddToPrintBatchDialog from "./AddToPrintBatchDialog";
import SampleEditDialog from "./SampleEditDialog";

interface ContainerPreviewDialogProps {
    open: boolean;
    containerId: number | null;
    onClose: () => void;
}

type TabKey = "list" | "label" | "qr";

const ALL_SAMPLE_STATUSES = Object.keys(SAMPLE_STATUS_LABELS) as SampleStatus[];

export default function ContainerPreviewDialog({
    open,
    containerId,
    onClose,
}: ContainerPreviewDialogProps) {
    const [tab, setTab] = useState<TabKey>("list");
    const [labelUrl, setLabelUrl] = useState<string | null>(null);
    const [labelLoading, setLabelLoading] = useState(false);
    const [labelError, setLabelError] = useState<string | null>(null);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [editingSampleId, setEditingSampleId] = useState<number | null>(null);

    // Состояние для списка проб
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<SampleStatus | "">("");

    const containerQuery = useContainer(open ? containerId : null);
    const samplesQuery = useSamples({
        page: 1,
        filters: { container_id: containerId ?? undefined, show_disposed: true },
    });

    const updateMutation = useUpdateSample();

    // Сброс при закрытии
    function handleClose() {
        setTab("list");
        setLabelUrl(null);
        setLabelError(null);
        setEditingSampleId(null);
        setSearch("");
        setSelectedIds(new Set());
        setBulkStatus("");
        onClose();
    }

    // Загрузка PDF
    useEffect(() => {
        if (!open || tab !== "label" || containerId === null) return;
        let cancelled = false;
        let createdUrl: string | null = null;
        setLabelLoading(true);
        setLabelError(null);
        fetchLabelPdfUrl(containerId)
            .then((url) => {
                if (cancelled) { URL.revokeObjectURL(url); return; }
                createdUrl = url;
                setLabelUrl(url);
            })
            .catch(() => { if (!cancelled) setLabelError("Не удалось загрузить этикетку."); })
            .finally(() => { if (!cancelled) setLabelLoading(false); });
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
            setLabelUrl(null);
        };
    }, [open, tab, containerId]);

    const container = containerQuery.data;
    const allSamples = useMemo(() => samplesQuery.data?.results ?? [], [samplesQuery.data]);

    // Фильтрация проб
    const filteredSamples = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allSamples;
        return allSamples.filter(s =>
            s.sample_number.toLowerCase().includes(q) ||
            (s.well_name ?? "").toLowerCase().includes(q)
        );
    }, [allSamples, search]);

    // Обработка чекбоксов
    function toggleSelect(id: number) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleAll() {
        if (selectedIds.size === filteredSamples.length && filteredSamples.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredSamples.map(s => s.id)));
        }
    }

    // Массовая смена статуса
    async function handleBulkStatusChange() {
        if (selectedIds.size === 0 || !bulkStatus) return;

        const ok = window.confirm(`Сменить статус у ${selectedIds.size} проб на «${SAMPLE_STATUS_LABELS[bulkStatus]}»?`);
        if (!ok) return;

        try {
            // Отправляем параллельные запросы
            await Promise.all(
                Array.from(selectedIds).map(id =>
                    updateMutation.mutateAsync({ id, payload: { status: bulkStatus } })
                )
            );
            setSelectedIds(new Set());
            setBulkStatus("");
        } catch {
            alert("Не удалось сменить статус у некоторых проб.");
        }
    }

    if (!open) return null;

    return (
        <>
            <Dialog open={open && editingSampleId === null} onClose={handleClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Stack spacing={0.5}>
                        <Typography variant="h6" component="div">
                            Тара: {container?.container_number ?? `#${containerId}`}
                        </Typography>
                        {container && (
                            <Stack direction="row" spacing={2} sx={{ typography: "body2", color: "text.secondary" }}>
                                <span><b>Н/З:</b> {container.draft_work_order_coded || "—"}</span>
                                <span><b>ТИ:</b> {container.draft_research_type_name || "—"}</span>
                            </Stack>
                        )}
                    </Stack>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    {containerQuery.isError && (
                        <Alert severity="error" sx={{ m: 2 }}>
                            Не удалось загрузить данные тары.
                        </Alert>
                    )}

                    <Tabs
                        value={tab}
                        onChange={(_e, value: TabKey) => setTab(value)}
                        sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
                    >
                        <Tab value="list" label="Список проб" />
                        <Tab value="label" label="Этикетка" />
                        <Tab value="qr" label="QR" />
                    </Tabs>

                    {tab === "list" && (
                        <Box sx={{ p: 2 }}>
                            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2, alignItems: { sm: "center" } }}>
                                <TextField
                                    size="small"
                                    placeholder="Поиск по номеру или скважине..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    sx={{ flexGrow: 1 }}
                                />
                                {selectedIds.size > 0 && (
                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                        <Typography variant="body2" sx={{ whiteSpace: "nowrap" }}>
                                            Выбрано: <b>{selectedIds.size}</b>
                                        </Typography>
                                        <FormControl size="small" sx={{ minWidth: 160 }}>
                                            <InputLabel>Сменить статус</InputLabel>
                                            <Select
                                                label="Сменить статус"
                                                value={bulkStatus}
                                                onChange={(e) => setBulkStatus(e.target.value as SampleStatus)}
                                            >
                                                {ALL_SAMPLE_STATUSES.map(s => (
                                                    <MenuItem key={s} value={s}>{SAMPLE_STATUS_LABELS[s]}</MenuItem>
                                                ))}
                                            </Select>
                                        </FormControl>
                                        <Button
                                            variant="contained"
                                            size="small"
                                            disabled={!bulkStatus || updateMutation.isPending}
                                            onClick={() => void handleBulkStatusChange()}
                                        >
                                            Применить
                                        </Button>
                                    </Stack>
                                )}
                            </Stack>

                            {samplesQuery.isLoading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : filteredSamples.length === 0 ? (
                                <Alert severity="info">Нет проб по текущему фильтру.</Alert>
                            ) : (
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                                    <Table size="small" stickyHeader>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        size="small"
                                                        checked={filteredSamples.length > 0 && selectedIds.size === filteredSamples.length}
                                                        indeterminate={selectedIds.size > 0 && selectedIds.size < filteredSamples.length}
                                                        onChange={toggleAll}
                                                    />
                                                </TableCell>
                                                <TableCell>Образец</TableCell>
                                                <TableCell>Скважина</TableCell>
                                                <TableCell>Статус</TableCell>
                                                <TableCell width={50} />
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {filteredSamples.map((s) => (
                                                <TableRow key={s.id} hover selected={selectedIds.has(s.id)}>
                                                    <TableCell padding="checkbox">
                                                        <Checkbox
                                                            size="small"
                                                            checked={selectedIds.has(s.id)}
                                                            onChange={() => toggleSelect(s.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontFamily: "monospace", fontSize: 13 }}>
                                                        {s.sample_number}
                                                    </TableCell>
                                                    <TableCell>{s.well_name ?? "—"}</TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            size="small"
                                                            label={SAMPLE_STATUS_LABELS[s.status] ?? s.status}
                                                            sx={{ height: 20, fontSize: 11 }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Tooltip title="Редактировать">
                                                            <IconButton size="small" onClick={() => setEditingSampleId(s.id)}>
                                                                <EditIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    {(samplesQuery.data?.count ?? 0) > filteredSamples.length && (
                                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", p: 1 }}>
                                            Показано {filteredSamples.length} из {samplesQuery.data?.count}.
                                        </Typography>
                                    )}
                                </TableContainer>
                            )}
                        </Box>
                    )}

                    {tab === "label" && (
                        <Box sx={{ p: 2 }}>
                            {labelLoading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : labelError ? (
                                <Alert severity="error">{labelError}</Alert>
                            ) : !labelUrl ? (
                                <Typography variant="body2" color="text.secondary">Этикетка не загружена.</Typography>
                            ) : (
                                <Box
                                    component="iframe"
                                    src={labelUrl}
                                    title="PDF этикетки"
                                    sx={{ width: "100%", height: 520, border: 1, borderColor: "divider", borderRadius: 1 }}
                                />
                            )}
                        </Box>
                    )}

                    {tab === "qr" && (
                        <Box sx={{ p: 2 }}>
                            {containerId === null ? (
                                <Typography variant="body2" color="text.secondary">Тара не загружена.</Typography>
                            ) : (
                                <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
                                    <Typography variant="body1">
                                        QR-сетка для тары <b>{container?.container_number ?? `#${containerId}`}</b>.
                                    </Typography>
                                    <Alert severity="info" sx={{ width: "100%" }}>
                                        Будет создана новая партия печати с типом <b>QR-сетка</b> и добавлена эта тара. Скачайте PDF и распечатайте.
                                    </Alert>
                                    <Button variant="contained" startIcon={<QrCodeIcon />} onClick={() => setPrintDialogOpen(true)}>
                                        В партию QR-сетка
                                    </Button>
                                </Stack>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Stack direction="row" spacing={1} sx={{ flexGrow: 1, pl: 1 }}>
                        <Button
                            startIcon={<PictureAsPdfIcon />}
                            onClick={() => { if (containerId !== null) void downloadLabelPdf(containerId); }}
                            disabled={containerId === null}
                        >
                            Скачать
                        </Button>
                        <Button
                            startIcon={<PrintIcon />}
                            onClick={() => setPrintDialogOpen(true)}
                            disabled={containerId === null}
                        >
                            В партию
                        </Button>
                    </Stack>
                    <Button onClick={handleClose}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            <AddToPrintBatchDialog
                open={printDialogOpen}
                containerIds={containerId !== null ? [containerId] : []}
                onClose={() => setPrintDialogOpen(false)}
                onSuccess={() => setPrintDialogOpen(false)}
            />

            {editingSampleId !== null && (
                <SampleEditDialog
                    open={true}
                    sampleId={editingSampleId}
                    onClose={() => setEditingSampleId(null)}
                />
            )}
        </>
    );
}