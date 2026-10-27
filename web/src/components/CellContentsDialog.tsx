/**
 * Диалог просмотра содержимого ячейки (2f-11a + 2f-12b).
 * 2f-17c: клик на тару → ContainerDetailDialog.
 */
import { useState, useMemo } from "react";
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
    Accordion,
    AccordionSummary,
    AccordionDetails,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import VisibilityIcon from "@mui/icons-material/Visibility";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import PlaceIcon from "@mui/icons-material/Place";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import AddIcon from "@mui/icons-material/Add";
import { useQueryClient } from "@tanstack/react-query";

import {
    apiClient,
    CONTAINER_STATUS_LABELS,
    useContainers,
    useUpdateContainer,
    type Cell,
    type Container,
    type ContainerStatus,
} from "../api";
import ContainerDetailDialog from "./ContainerDetailDialog";
import PlaceContainerDialog from "./PlaceContainerDialog";
import CreateInCellDialog from "./CreateInCellDialog";
import FillContainerDialog from "./FillContainerDialog";

interface CellContentsDialogProps {
    open: boolean;
    cell: Cell | null;
    palletId: number | null;
    onClose: () => void;
}

const STATUS_COLORS: Record<
    ContainerStatus,
    "default" | "warning" | "success" | "info" | "error"
> = {
    PENDING_FILLING: "warning",
    PENDING_PLACEMENT: "warning",
    ACTIVE: "success",
    IN_TRANSIT: "info",
    ISSUED: "default",
};

export default function CellContentsDialog({
    open,
    cell,
    palletId,
    onClose,
}: CellContentsDialogProps) {
    const queryClient = useQueryClient();

    const [detailContainerId, setDetailContainerId] = useState<number | null>(null);
    const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
    const [createDialogOpen, setCreateDialogOpen] = useState(false);

    const [draftContainer, setDraftContainer] = useState<Container | null>(null);

    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    const containersQuery = useContainers({
        page: 1,
        filters: { pallet_id: palletId ?? undefined },
    });

    const updateMutation = useUpdateContainer();

    const filteredContainers = useMemo(() => {
        const all = containersQuery.data?.results ?? [];
        const q = search.trim().toLowerCase();
        if (!q) return all;
        return all.filter(c =>
            (c.container_number ?? "").toLowerCase().includes(q) ||
            (c.draft_work_order_coded ?? "").toLowerCase().includes(q) ||
            (c.draft_research_type_name ?? "").toLowerCase().includes(q)
        );
    }, [containersQuery.data, search]);

    const grouped = useMemo(() => {
        const map = new Map<string, { wo: string, rt: string, items: Container[] }>();
        for (const c of filteredContainers) {
            const wo = c.draft_work_order_coded || "Без Н/З";
            const rt = c.draft_research_type_name || "Без ТИ";
            const key = `${wo} | ${rt}`;
            if (!map.has(key)) {
                map.set(key, { wo, rt, items: [] });
            }
            map.get(key)!.items.push(c);
        }
        return Array.from(map.values());
    }, [filteredContainers]);

    function toggleSelect(id: number) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function toggleGroup(items: Container[], select: boolean) {
        setSelectedIds(prev => {
            const next = new Set(prev);
            for (const c of items) {
                if (select) next.add(c.id);
                else next.delete(c.id);
            }
            return next;
        });
    }

    async function handleRemoveFromPallet(container: Container) {
        const ok = window.confirm(
            `Убрать тару ${container.container_number ?? `#${container.id}`} с поддона? Она вернётся в статус «Ожидает размещения».`
        );
        if (!ok) return;

        try {
            await updateMutation.mutateAsync({
                id: container.id,
                payload: { pallet: null, status: "PENDING_PLACEMENT" },
            });
            setSelectedIds(prev => {
                const next = new Set(prev);
                next.delete(container.id);
                return next;
            });
        } catch {
            setError("Не удалось убрать тару с поддона.");
        }
    }

    // Коллбэк после заполнения тары пробами (из CreateInCellDialog → FillContainerDialog)
    async function handleFillSuccess(containerId: number) {
        setDraftContainer(null);
        try {
            await apiClient.post("/storage/containers/bulk-place/", {
                container_ids: [containerId],
                cell_id: cell?.id,
            });
            queryClient.invalidateQueries({ queryKey: ["containers"] });
            queryClient.invalidateQueries({ queryKey: ["topology"] });
            queryClient.invalidateQueries({ queryKey: ["samples"] });

            // 2f-17c: открываем единое окно после успешного заполнения
            setDetailContainerId(containerId);
        } catch {
            alert("Тара создана и заполнена, но не удалось автоматически разместить её в ячейке. Попробуйте переместить её вручную.");
        }
    }

    if (!open || !cell) return null;

    return (
        <>
            <Dialog
                open={open && detailContainerId === null && !placeDialogOpen && !createDialogOpen && draftContainer === null}
                onClose={onClose}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ pb: 1 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <Inventory2Icon color="action" />
                        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                            Ячейка: {cell.full_address}
                        </Typography>
                        <Button
                            size="small"
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            Создать тару
                        </Button>
                    </Stack>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    {error && (
                        <Alert severity="error" sx={{ m: 2 }}>
                            {error}
                        </Alert>
                    )}

                    <Box sx={{ p: 2, bgcolor: "action.hover", borderBottom: 1, borderColor: "divider", display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
                        <Typography variant="body2">
                            Поддон: <b>#{palletId}</b> · Всего тар: <b>{containersQuery.data?.count ?? 0}</b>
                        </Typography>
                        <Box sx={{ flexGrow: 1 }} />
                        <TextField
                            size="small"
                            placeholder="Поиск по номеру, Н/З или ТИ..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            sx={{ width: 300 }}
                        />
                    </Box>

                    {selectedIds.size > 0 && (
                        <Box sx={{ p: 1, bgcolor: "primary.50", borderBottom: 1, borderColor: "divider", display: "flex", gap: 2, alignItems: "center" }}>
                            <Typography variant="body2" sx={{ ml: 1 }}>Выбрано: <b>{selectedIds.size}</b></Typography>
                            <Button size="small" variant="contained" startIcon={<PlaceIcon />} onClick={() => setPlaceDialogOpen(true)}>
                                Переместить
                            </Button>
                        </Box>
                    )}

                    {containersQuery.isLoading ? (
                        <Typography sx={{ p: 2 }}>Загрузка тар...</Typography>
                    ) : filteredContainers.length === 0 ? (
                        <Alert severity="info" sx={{ m: 2 }}>Тар не найдено. Нажмите «Создать тару», чтобы добавить первую.</Alert>
                    ) : (
                        <Box sx={{ p: 2 }}>
                            {grouped.map((group) => {
                                const groupIds = group.items.map(c => c.id);
                                const allSelected = groupIds.every(id => selectedIds.has(id));
                                const someSelected = groupIds.some(id => selectedIds.has(id)) && !allSelected;

                                return (
                                    <Accordion key={`${group.wo}-${group.rt}`} defaultExpanded sx={{ mb: 1, "&:before": { display: "none" }, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                                        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: "action.hover", minHeight: 48 }}>
                                            <Stack direction="row" spacing={2} sx={{ alignItems: "center", width: "100%", pr: 2 }}>
                                                <Checkbox
                                                    size="small"
                                                    checked={allSelected}
                                                    indeterminate={someSelected}
                                                    onChange={(e) => toggleGroup(group.items, e.target.checked)}
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                                <Typography variant="subtitle2">
                                                    Н/З: <b>{group.wo}</b> · ТИ: <b>{group.rt}</b>
                                                </Typography>
                                                <Box sx={{ flexGrow: 1 }} />
                                                <Chip size="small" label={`Тар: ${group.items.length}`} />
                                            </Stack>
                                        </AccordionSummary>
                                        <AccordionDetails sx={{ p: 0 }}>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell padding="checkbox" />
                                                        <TableCell>Тара</TableCell>
                                                        <TableCell>Статус</TableCell>
                                                        <TableCell align="right">Действия</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {group.items.map((c) => (
                                                        <TableRow key={c.id} hover selected={selectedIds.has(c.id)}>
                                                            <TableCell padding="checkbox">
                                                                <Checkbox
                                                                    size="small"
                                                                    checked={selectedIds.has(c.id)}
                                                                    onChange={() => toggleSelect(c.id)}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 500, fontFamily: "monospace" }}>
                                                                {c.container_number || `#${c.id}`}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Chip
                                                                    size="small"
                                                                    label={CONTAINER_STATUS_LABELS[c.status] ?? c.status}
                                                                    color={STATUS_COLORS[c.status] ?? "default"}
                                                                    sx={{ height: 20, fontSize: 11 }}
                                                                />
                                                            </TableCell>
                                                            <TableCell align="right" sx={{ py: 0.5 }}>
                                                                <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                                                                    <Tooltip title="Открыть">
                                                                        <IconButton size="small" onClick={() => setDetailContainerId(c.id)}>
                                                                            <VisibilityIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Переместить">
                                                                        <IconButton size="small" color="primary" onClick={() => {
                                                                            setSelectedIds(new Set([c.id]));
                                                                            setPlaceDialogOpen(true);
                                                                        }}>
                                                                            <PlaceIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Убрать с поддона">
                                                                        <IconButton
                                                                            size="small"
                                                                            color="error"
                                                                            onClick={() => void handleRemoveFromPallet(c)}
                                                                            disabled={updateMutation.isPending}
                                                                        >
                                                                            <DeleteIcon fontSize="small" />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                </Stack>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </AccordionDetails>
                                    </Accordion>
                                );
                            })}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            {detailContainerId !== null && (
                <ContainerDetailDialog
                    open={true}
                    containerId={detailContainerId}
                    onClose={() => setDetailContainerId(null)}
                />
            )}

            {placeDialogOpen && (
                <PlaceContainerDialog
                    open={true}
                    containerIds={Array.from(selectedIds)}
                    onClose={() => setPlaceDialogOpen(false)}
                    onSuccess={() => {
                        setPlaceDialogOpen(false);
                        setSelectedIds(new Set());
                    }}
                />
            )}

            {createDialogOpen && cell && (
                <CreateInCellDialog
                    open={true}
                    cell={cell}
                    onClose={() => setCreateDialogOpen(false)}
                    onSuccess={(container) => {
                        setCreateDialogOpen(false);
                        setDraftContainer(container);
                    }}
                />
            )}

            {draftContainer !== null && cell && (
                <FillContainerDialog
                    open={true}
                    container={draftContainer}
                    onClose={() => setDraftContainer(null)}
                    onSuccess={(containerId) => {
                        void handleFillSuccess(containerId);
                    }}
                />
            )}
        </>
    );
}