/**
 * Страница «Пул» (Корзина).
 * Списком, с иконками, чекбоксами и фильтрацией.
 * Статусы на русском.
 */
import { useMemo, useState } from "react";
import {
    Box, Button, Card, Checkbox, Divider, List, ListItem,
    ListItemButton, ListItemIcon, ListItemText, Stack, TextField, Tooltip, Typography
} from "@mui/material";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ScienceIcon from "@mui/icons-material/Science";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import OutputIcon from "@mui/icons-material/Output";
import RecyclingIcon from "@mui/icons-material/Recycling";
import EditNoteIcon from "@mui/icons-material/EditNote";

import { usePool, useClearPool, useRemoveFromPool } from "../api/pool";
import { CONTAINER_STATUS_LABELS, SAMPLE_STATUS_LABELS } from "../api";

interface PoolRow {
    id: string;
    type: "Тара" | "Проба";
    number: string;
    workOrder: string;
    researchType: string;
    status: string;
    statusLabel: string;
    rawId: number;
}

const STATUS_ICONS: Record<string, React.ReactElement> = {
    PENDING_FILLING: <EditNoteIcon fontSize="small" color="warning" />,
    PENDING_PLACEMENT: <Inventory2Icon fontSize="small" color="warning" />,
    ACTIVE: <CheckCircleIcon fontSize="small" color="success" />,
    IN_STORAGE: <CheckCircleIcon fontSize="small" color="success" />,
    IN_TRANSIT: <LocalShippingIcon fontSize="small" color="info" />,
    ISSUED: <OutputIcon fontSize="small" color="disabled" />,
    DISPOSED: <RecyclingIcon fontSize="small" color="disabled" />,
    SELECTED: <CheckCircleIcon fontSize="small" color="primary" />,
};

export default function PoolPage() {
    const { data: pool, isLoading } = usePool();
    const clearMutation = useClearPool();
    const removeMutation = useRemoveFromPool();
    const [search, setSearch] = useState("");
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const rows: PoolRow[] = useMemo(() => {
        if (!pool) return [];
        const res: PoolRow[] = [];
        for (const item of pool.items) {
            if (item.container) {
                const status = item.container_status || "";
                res.push({
                    id: `c-${item.id}`,
                    type: "Тара",
                    number: item.container_number ? `Тара № ${item.container_number}` : `Тара без номера (#${item.container})`,
                    workOrder: item.draft_work_order_coded || "Без Н/З",
                    researchType: item.draft_research_type_name || "Без ТИ",
                    status: status,
                    statusLabel: CONTAINER_STATUS_LABELS[status as keyof typeof CONTAINER_STATUS_LABELS] || status,
                    rawId: item.container,
                });
            } else if (item.sample) {
                const status = item.sample_status || "";
                res.push({
                    id: `s-${item.id}`,
                    type: "Проба",
                    number: item.sample_number || `Проба #${item.sample}`,
                    workOrder: item.sample_work_order || "Без Н/З",
                    researchType: item.sample_research_type || "Без ТИ",
                    status: status,
                    statusLabel: SAMPLE_STATUS_LABELS[status as keyof typeof SAMPLE_STATUS_LABELS] || status,
                    rawId: item.sample,
                });
            }
        }
        return res;
    }, [pool]);

    const filteredRows = useMemo(() => {
        const q = search.toLowerCase();
        if (!q) return rows;
        return rows.filter(
            (r) =>
                r.number.toLowerCase().includes(q) ||
                r.workOrder.toLowerCase().includes(q) ||
                r.researchType.toLowerCase().includes(q)
        );
    }, [rows, search]);

    const handleToggle = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedIds.size === filteredRows.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(filteredRows.map((r) => r.id)));
        }
    };

    async function handleClear() {
        if (selectedIds.size > 0) {
            if (window.confirm(`Удалить из пула выбранные элементы (${selectedIds.size})?`)) {
                const itemIds = Array.from(selectedIds).map(id => Number(id.split("-")[1]));
                await removeMutation.mutateAsync(itemIds);
                setSelectedIds(new Set());
            }
        } else {
            if (window.confirm("Очистить весь пул?")) {
                await clearMutation.mutateAsync();
                setSelectedIds(new Set());
            }
        }
    }

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h2" component="h1">
                    Пул (Корзина)
                </Typography>
                <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteSweepIcon />}
                    onClick={() => void handleClear()}
                    disabled={rows.length === 0 || clearMutation.isPending || removeMutation.isPending}
                >
                    {selectedIds.size > 0 ? `Удалить выбранное (${selectedIds.size})` : "Очистить весь пул"}
                </Button>
            </Box>

            <Card sx={{ p: 2, mb: 2 }}>
                <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                    <TextField
                        label="Поиск по номеру, Н/З или ТИ"
                        size="small"
                        fullWidth
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </Stack>
            </Card>

            {selectedIds.size > 0 && (
                <Card sx={{ p: 2, mb: 2, bgcolor: "primary.main", color: "primary.contrastText" }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography>Выбрано элементов: {selectedIds.size}</Typography>
                        <Button color="inherit" size="small" onClick={() => setSelectedIds(new Set())}>
                            Снять выделение
                        </Button>
                    </Stack>
                </Card>
            )}

            <Card>
                {isLoading ? (
                    <Box sx={{ p: 4, textAlign: "center" }}><Typography>Загрузка...</Typography></Box>
                ) : filteredRows.length === 0 ? (
                    <Box sx={{ p: 4, textAlign: "center" }}>
                        <Typography color="text.secondary">
                            {search ? "Ничего не найдено по запросу." : "Пул пуст. Добавьте тары или пробы в реестрах."}
                        </Typography>
                    </Box>
                ) : (
                    <>
                        <Box sx={{ p: 1, px: 2, borderBottom: "1px solid", borderColor: "divider", display: "flex", alignItems: "center" }}>
                            <Checkbox
                                size="small"
                                checked={selectedIds.size === filteredRows.length && filteredRows.length > 0}
                                indeterminate={selectedIds.size > 0 && selectedIds.size < filteredRows.length}
                                onChange={handleSelectAll}
                            />
                            <Typography variant="body2" color="text.secondary">Выбрать все</Typography>
                        </Box>
                        <List disablePadding>
                            {filteredRows.map((item, index) => (
                                <div key={item.id}>
                                    {index > 0 && <Divider />}
                                    <ListItem
                                        disablePadding
                                        secondaryAction={
                                            <Tooltip title={item.statusLabel}>
                                                <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
                                                    {STATUS_ICONS[item.status] || <Typography variant="caption">{item.statusLabel}</Typography>}
                                                </Box>
                                            </Tooltip>
                                        }
                                    >
                                        <ListItemButton onClick={() => handleToggle(item.id)} sx={{ py: 1.5 }}>
                                            <Checkbox
                                                edge="start"
                                                checked={selectedIds.has(item.id)}
                                                tabIndex={-1}
                                                disableRipple
                                            />
                                            <ListItemIcon>
                                                {item.type === "Тара" ? (
                                                    <Inventory2Icon color="primary" />
                                                ) : (
                                                    <ScienceIcon color="secondary" />
                                                )}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={
                                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                        {item.number}
                                                    </Typography>
                                                }
                                                secondary={`Н/З: ${item.workOrder}  ·  ТИ: ${item.researchType}`}
                                            />
                                            <Typography variant="caption" color="text.secondary" sx={{ mr: 3 }}>
                                                {item.type}
                                            </Typography>
                                        </ListItemButton>
                                    </ListItem>
                                </div>
                            ))}
                        </List>
                    </>
                )}
            </Card>
        </Box>
    );
}