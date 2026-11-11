/**
 * Диалог рекомендаций по размещению тар (2.x-sorting).
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Dialog, DialogTitle, DialogContent, DialogActions, Button,
    Typography, CircularProgress, Alert, Box, Chip, Paper, Checkbox,
    FormControlLabel, Divider, IconButton, Tooltip
} from "@mui/material";
import PlaceIcon from "@mui/icons-material/Place";
import { apiClient } from "../api/client";

interface ContainerBrief {
    id: number;
    number: string;
    wo: string;
    rt: string;
}

interface Suggestion {
    cell_id: number;
    full_address: string;
    reason: string;
    score: number;
    capacity_used: number;
    capacity_max: number;
    containers: ContainerBrief[];
}

interface SuggestPlacementDialogProps {
    containerIds: number[] | null;
    isMove: boolean;
    onClose: () => void;
    onSuccess: (msg: string) => void;
}

export default function SuggestPlacementDialog({ containerIds, isMove, onClose, onSuccess }: SuggestPlacementDialogProps) {
    const queryClient = useQueryClient();
    const [showAll, setShowAll] = useState(false);

    const [assigned, setAssigned] = useState<Record<number, number>>({});
    const [placedIds, setPlacedIds] = useState<Set<number>>(new Set());
    const [isPlacingAll, setIsPlacingAll] = useState(false);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["suggest-placement", containerIds],
        queryFn: async () => {
            if (!containerIds || containerIds.length === 0) return { suggestions: [] };
            const idsStr = containerIds.join(",");
            const { data } = await apiClient.get<{ suggestions: Suggestion[] }>(
                `/storage/containers/suggest-placement/?container_ids=${idsStr}`
            );
            return data;
        },
        enabled: !!containerIds && containerIds.length > 0,
    });

    const placeMutation = useMutation({
        mutationFn: async ({ cellId, ids }: { cellId: number; ids: number[] }) => {
            await apiClient.post("/storage/containers/bulk-place/", {
                container_ids: ids,
                cell_id: cellId,
            });
        },
        onSuccess: (_data, variables) => {
            void queryClient.invalidateQueries({ queryKey: ["containers"] });

            const newPlaced = new Set(placedIds);
            variables.ids.forEach(id => newPlaced.add(id));
            setPlacedIds(newPlaced);

            setAssigned(prev => {
                const next = { ...prev };
                variables.ids.forEach(id => delete next[id]);
                return next;
            });

            const total = containerIds?.length ?? 0;
            if (newPlaced.size === total) {
                onSuccess(isMove ? "Все тары успешно перемещены." : "Все тары успешно размещены.");
                onClose();
            } else {
                onSuccess(isMove ? "Часть тар перемещена. Остались неразмещенные." : "Часть тар размещена. Остались неразмещенные.");
            }
        },
        onError: () => {
            alert("Не удалось разместить тары.");
        }
    });

    const handlePlace = (cellId: number, idsToPlace: number[]) => {
        if (idsToPlace.length === 0) return;
        if (isMove) {
            if (!window.confirm(`Вы уверены, что хотите переместить выбранные тары (${idsToPlace.length} шт.) в новую ячейку?`)) return;
        }
        placeMutation.mutate({ cellId, ids: idsToPlace });
    };

    const handlePlaceAll = async () => {
        const groups: Record<number, number[]> = {};
        Object.entries(assigned).forEach(([idStr, cellId]) => {
            const id = Number(idStr);
            if (!groups[cellId]) groups[cellId] = [];
            groups[cellId].push(id);
        });

        const cellIds = Object.keys(groups);
        if (cellIds.length === 0) return;

        if (isMove) {
            if (!window.confirm(`Вы уверены, что хотите переместить все выбранные тары (${Object.keys(assigned).length} шт.)?`)) return;
        }

        setIsPlacingAll(true);
        try {
            await Promise.all(cellIds.map(cellId =>
                apiClient.post("/storage/containers/bulk-place/", {
                    container_ids: groups[Number(cellId)],
                    cell_id: Number(cellId)
                })
            ));

            void queryClient.invalidateQueries({ queryKey: ["containers"] });
            onSuccess(isMove ? "Все тары успешно перемещены." : "Все тары успешно размещены.");
            onClose();
        } catch (err) {
            alert("Не удалось разместить некоторые тары. Обновите страницу.");
        } finally {
            setIsPlacingAll(false);
        }
    };

    const toggleAssign = (id: number, cellId: number) => {
        setAssigned(prev => {
            const next = { ...prev };
            if (next[id] === cellId) delete next[id];
            else next[id] = cellId;
            return next;
        });
    };

    const suggestions = data?.suggestions ?? [];
    const totalContainers = containerIds?.length ?? 0;
    const assignedCount = Object.keys(assigned).length;
    const remainingCount = totalContainers - placedIds.size;

    const activeSuggestions = suggestions.filter(s =>
        s.containers.some(c => !placedIds.has(c.id) && (!assigned[c.id] || assigned[c.id] === s.cell_id))
    );

    let visibleSuggestions = activeSuggestions;
    if (!showAll && activeSuggestions.length > 0) {
        const topScore = activeSuggestions[0].score;
        const topTier = activeSuggestions.filter(s => s.score === topScore);
        if (topTier.length >= 3) {
            visibleSuggestions = topTier.slice(0, 3);
        } else {
            const remaining = activeSuggestions.filter(s => s.score !== topScore);
            visibleSuggestions = [...topTier, ...remaining.slice(0, 3 - topTier.length)];
        }
    }

    const hasMore = activeSuggestions.length > visibleSuggestions.length;

    return (
        <Dialog open={!!containerIds} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pr: 3 }}>
                <span>Куда поставить?</span>
                <Chip
                    label={`Распределено: ${assignedCount} / Осталось: ${remainingCount}`}
                    color={assignedCount === remainingCount && remainingCount > 0 ? "success" : "primary"}
                    variant="outlined"
                />
            </DialogTitle>
            <DialogContent dividers sx={{ bgcolor: "background.default" }}>
                {isLoading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>}
                {isError && <Alert severity="error">Не удалось получить рекомендации.</Alert>}

                {!isLoading && remainingCount === 0 && (
                    <Alert severity="success">Все тары успешно распределены по местам!</Alert>
                )}

                {!isLoading && !isError && remainingCount > 0 && activeSuggestions.length === 0 && (
                    <Alert severity="info">Нет подходящих свободных ячеек для оставшихся тар.</Alert>
                )}

                {!isLoading && visibleSuggestions.map((s, idx) => {
                    const isTop = idx === 0;

                    const availableContainers = s.containers.filter(
                        c => !placedIds.has(c.id) && (!assigned[c.id] || assigned[c.id] === s.cell_id)
                    );

                    if (availableContainers.length === 0) return null;

                    const groups = availableContainers.reduce((acc, c) => {
                        const key = `${c.wo} · ${c.rt}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(c);
                        return acc;
                    }, {} as Record<string, ContainerBrief[]>);

                    const selectedForThisCell = s.containers
                        .filter(c => assigned[c.id] === s.cell_id && !placedIds.has(c.id))
                        .map(c => c.id);

                    const hasSelectedForThisCell = selectedForThisCell.length > 0;

                    const projectedUsed = s.capacity_used + selectedForThisCell.length;
                    const isOverCapacity = projectedUsed > s.capacity_max;

                    return (
                        <Paper
                            key={s.cell_id}
                            elevation={isTop ? 3 : 1}
                            sx={{
                                mb: 2,
                                p: 2,
                                border: isTop ? '2px solid' : '1px solid',
                                borderColor: isTop ? 'primary.main' : 'divider'
                            }}
                        >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>{s.full_address}</Typography>
                                        {isTop && <Chip label="Лучший вариант" size="small" color="primary" />}
                                        <Tooltip title="Посмотреть на карте (откроется в новой вкладке)">
                                            <IconButton size="small" onClick={() => window.open(`/topology?cell_id=${s.cell_id}`, '_blank')}>
                                                <PlaceIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                    <Typography variant="body2" color="text.secondary">
                                        {s.reason}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Chip
                                        label={`Заполнено: ${projectedUsed} / ${s.capacity_max}`}
                                        size="small"
                                        variant={isOverCapacity ? "filled" : "outlined"}
                                        color={isOverCapacity ? "error" : "default"}
                                    />
                                    <Button
                                        variant="contained"
                                        color={isOverCapacity ? "error" : (isMove ? "warning" : "primary")}
                                        disabled={!hasSelectedForThisCell || placeMutation.isPending || isPlacingAll}
                                        onClick={() => {
                                            if (isOverCapacity && !window.confirm("Внимание! Ячейка будет переполнена. Продолжить?")) return;
                                            handlePlace(s.cell_id, selectedForThisCell);
                                        }}
                                    >
                                        {placeMutation.isPending ? "..." : (isMove ? "Переместить" : "Разместить")} {hasSelectedForThisCell ? `(${selectedForThisCell.length})` : ''}
                                    </Button>
                                </Box>
                            </Box>

                            <FormControlLabel
                                control={
                                    <Checkbox
                                        size="small"
                                        checked={availableContainers.length > 0 && availableContainers.every(c => assigned[c.id] === s.cell_id)}
                                        indeterminate={availableContainers.some(c => assigned[c.id] === s.cell_id) && !availableContainers.every(c => assigned[c.id] === s.cell_id)}
                                        onChange={(e) => {
                                            setAssigned(prev => {
                                                const next = { ...prev };
                                                if (e.target.checked) {
                                                    availableContainers.forEach(c => { next[c.id] = s.cell_id; });
                                                } else {
                                                    availableContainers.forEach(c => { delete next[c.id]; });
                                                }
                                                return next;
                                            });
                                        }}
                                    />
                                }
                                label={<Typography variant="body2" color="text.secondary">Выбрать все доступные тары</Typography>}
                                sx={{ mb: 1 }}
                            />

                            <Divider sx={{ mb: 1 }} />

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {Object.entries(groups).map(([groupName, items]) => (
                                    <Box key={groupName} sx={{ bgcolor: 'action.hover', p: 1, borderRadius: 1 }}>
                                        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', display: 'block', mb: 0.5 }}>
                                            {groupName}
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {items.map(c => (
                                                <FormControlLabel
                                                    key={c.id}
                                                    control={
                                                        <Checkbox
                                                            size="small"
                                                            color="success"
                                                            checked={assigned[c.id] === s.cell_id}
                                                            onChange={() => toggleAssign(c.id, s.cell_id)}
                                                        />
                                                    }
                                                    label={<Typography variant="body2">№ {c.number}</Typography>}
                                                    sx={{
                                                        bgcolor: 'background.paper',
                                                        borderRadius: 1,
                                                        pr: 1,
                                                        mr: 0,
                                                        border: assigned[c.id] === s.cell_id ? '1px solid' : '1px solid transparent',
                                                        borderColor: assigned[c.id] === s.cell_id ? 'success.main' : 'transparent'
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Box>
                                ))}
                            </Box>
                        </Paper>
                    );
                })}

                {hasMore && (
                    <Button onClick={() => setShowAll(true)} sx={{ mt: 1, textTransform: 'none' }} fullWidth variant="outlined">
                        Показать остальные варианты ({activeSuggestions.length - visibleSuggestions.length})
                    </Button>
                )}
                {showAll && activeSuggestions.length > 3 && (
                    <Button onClick={() => setShowAll(false)} sx={{ mt: 1, textTransform: 'none' }} fullWidth variant="outlined">
                        Свернуть
                    </Button>
                )}
            </DialogContent>
            <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
                <Button onClick={onClose} variant="outlined" disabled={isPlacingAll}>
                    Закрыть
                </Button>
                <Button
                    variant="contained"
                    color="success"
                    onClick={handlePlaceAll}
                    disabled={assignedCount === 0 || isPlacingAll || placeMutation.isPending}
                >
                    {isPlacingAll ? "Размещаем..." : `Разместить все (${assignedCount})`}
                </Button>
            </DialogActions>
        </Dialog>
    );
}