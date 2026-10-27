/**
 * Единое окно тары (2f-17c).
 *
 * Вкладки: Пробы / Редактирование / История.
 * Шапка: номер, Н/З, ТИ, участок, статус + кнопки
 * [Предпросмотр] [Разместить / Местоположение] [Закрыть].
 *
 * Предпросмотр (этикетка / QR) — отдельная модалка ContainerPreviewDialog,
 * открывается по кнопке из шапки.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PlaceIcon from "@mui/icons-material/Place";

import {
    CONTAINER_STATUS_LABELS,
    SAMPLE_STATUS_LABELS,
    useContainer,
    useSamples,
    useUpdateSample,
    type SampleStatus,
} from "../api";
import ContainerHistoryTab from "./ContainerHistoryTab";
import ContainerPreviewDialog from "./ContainerPreviewDialog";
import FillContainerContent from "./FillContainerContent";
import PlaceContainerDialog from "./PlaceContainerDialog";
import SampleEditDialog from "./SampleEditDialog";

interface ContainerDetailDialogProps {
    open: boolean;
    containerId: number | null;
    onClose: () => void;
}

type TabKey = "samples" | "edit" | "history";

const ALL_SAMPLE_STATUSES = Object.keys(SAMPLE_STATUS_LABELS) as SampleStatus[];

export default function ContainerDetailDialog({
    open,
    containerId,
    onClose,
}: ContainerDetailDialogProps) {
    const navigate = useNavigate();
    const [tab, setTab] = useState<TabKey>("samples");
    const [previewOpen, setPreviewOpen] = useState(false);
    const [placeOpen, setPlaceOpen] = useState(false);
    const [editingSampleId, setEditingSampleId] = useState<number | null>(null);

    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [bulkStatus, setBulkStatus] = useState<SampleStatus | "">("");

    const containerQuery = useContainer(open ? containerId : null);
    const samplesQuery = useSamples({
        page: 1,
        filters: { container_id: containerId ?? undefined, show_disposed: true },
    });
    const updateMutation = useUpdateSample();

    function reset() {
        setTab("samples");
        setPreviewOpen(false);
        setPlaceOpen(false);
        setEditingSampleId(null);
        setSearch("");
        setSelectedIds(new Set());
        setBulkStatus("");
    }

    function handleClose() {
        reset();
        onClose();
    }

    const container = containerQuery.data;
    const allSamples = useMemo(() => samplesQuery.data?.results ?? [], [samplesQuery.data]);
    const filteredSamples = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return allSamples;
        return allSamples.filter(s =>
            s.sample_number.toLowerCase().includes(q) ||
            (s.well_name ?? "").toLowerCase().includes(q)
        );
    }, [allSamples, search]);

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

    async function handleBulkStatusChange() {
        if (selectedIds.size === 0 || !bulkStatus) return;
        const ok = window.confirm(`Сменить статус у ${selectedIds.size} проб на «${SAMPLE_STATUS_LABELS[bulkStatus]}»?`);
        if (!ok) return;
        try {
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

    // Loading / error states
    if (!open) return null;
    if (containerQuery.isLoading || !container) {
        return (
            <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
                <DialogContent>
                    {containerQuery.isError ? (
                        <Alert severity="error">Не удалось загрузить данные тары.</Alert>
                    ) : (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                            <CircularProgress size={32} />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        );
    }

    const canPlace = container.status === "PENDING_FILLING" || container.status === "PENDING_PLACEMENT";
    const hasCell = container.cell_id !== null && container.cell_id !== undefined;

    return (
        <>
            <Dialog
                open={open && !previewOpen && !placeOpen && editingSampleId === null}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Stack direction="row" spacing={2} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                        <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="h6" component="div">
                                Тара: {container.container_number ?? `#${container.id}`}
                            </Typography>
                            <Stack direction="row" spacing={2} sx={{ mt: 0.5, typography: "body2", color: "text.secondary", flexWrap: "wrap" }}>
                                <span><b>Н/З:</b> {container.draft_work_order_coded || "—"}</span>
                                <span><b>ТИ:</b> {container.draft_research_type_name || "—"}</span>
                                <span><b>Участок:</b> {container.draft_site_name || "—"}</span>
                                <span><b>Статус:</b> {CONTAINER_STATUS_LABELS[container.status] ?? container.status}</span>
                            </Stack>
                        </Box>
                        <Stack direction="row" spacing={1}>
                            <Button size="small" variant="outlined" startIcon={<VisibilityIcon />} onClick={() => setPreviewOpen(true)}>
                                Предпросмотр
                            </Button>
                            {canPlace && (
                                <Button size="small" variant="outlined" color="primary" startIcon={<Inventory2Icon />} onClick={() => setPlaceOpen(true)}>
                                    Разместить
                                </Button>
                            )}
                            {hasCell && (
                                <Button
                                    size="small"
                                    variant="outlined"
                                    color="info"
                                    startIcon={<PlaceIcon />}
                                    onClick={() => {
                                        handleClose();
                                        navigate(`/topology?cell_id=${container.cell_id}`);
                                    }}
                                >
                                    Местоположение
                                </Button>
                            )}
                        </Stack>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    <Tabs
                        value={tab}
                        onChange={(_e, v: TabKey) => setTab(v)}
                        sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
                    >
                        <Tab value="samples" label="Пробы" />
                        <Tab value="edit" label="Редактирование" />
                        <Tab value="history" label="История" />
                    </Tabs>

                    {tab === "samples" && (
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
                                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
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

                    {tab === "edit" && (
                        <Box sx={{ p: 2 }}>
                            <FillContainerContent
                                container={container}
                                onClose={handleClose}
                                onSuccess={() => {
                                    setTab("samples");
                                }}
                            />
                        </Box>
                    )}

                    {tab === "history" && (
                        <ContainerHistoryTab containerId={container.id} />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {previewOpen && (
                <ContainerPreviewDialog
                    open={true}
                    containerId={container.id}
                    onClose={() => setPreviewOpen(false)}
                />
            )}

            {placeOpen && (
                <PlaceContainerDialog
                    open={true}
                    containerIds={[container.id]}
                    onClose={() => setPlaceOpen(false)}
                    onSuccess={() => setPlaceOpen(false)}
                />
            )}

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