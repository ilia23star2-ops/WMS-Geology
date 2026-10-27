/**
 * Дерево-таблица проб (пачка 2f-8 + 2f-11c).
 */
import React, { useState } from "react";
import {
    Alert,
    Box,
    Chip,
    CircularProgress,
    Collapse,
    IconButton,
    Pagination,
    Paper,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Tooltip,
    Typography,
} from "@mui/material";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowRightIcon from "@mui/icons-material/KeyboardArrowRight";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ScienceIcon from "@mui/icons-material/Science";
import PlaceIcon from "@mui/icons-material/Place"; // <--- Добавлено
import { useNavigate } from "react-router-dom"; // <--- Добавлено

import {
    SAMPLE_STATUS_LABELS,
    useSamplesGrouped,
    type GroupedSampleBrief,
    type SampleFilters,
    type SampleStatus,
} from "../api";
import SampleEditDialog from "./SampleEditDialog";

const GROUPS_PAGE_SIZE = 20;

const STATUS_COLORS: Record<
    SampleStatus,
    "success" | "warning" | "info" | "default" | "error"
> = {
    IN_STORAGE: "success",
    IN_TRANSIT: "info",
    CONSUMED: "warning",
    DISPOSED: "error",
    PENDING_PLACEMENT: "warning",
    SELECTED: "default",
};

const CONTAINER_STATUS_LABELS: Record<string, string> = {
    PENDING_FILLING: "Ожидает заполнения",
    PENDING_PLACEMENT: "Ожидает размещения",
    ACTIVE: "Активна",
    IN_TRANSIT: "В пути",
    ISSUED: "Выдана",
};

const WORK_ORDER_TYPE_LABELS: Record<string, string> = {
    INCOMING: "Входящий",
    CODED: "Текущий",
};

function formatDate(value: string): string {
    try {
        return new Date(value).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
        });
    } catch {
        return value;
    }
}

interface SamplesTreeTableProps {
    filters: SampleFilters;
}

export default function SamplesTreeTable({ filters }: SamplesTreeTableProps) {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
    const [expandedContainers, setExpandedContainers] = useState<Set<number>>(new Set());
    const [editingSampleId, setEditingSampleId] = useState<number | null>(null);

    const { data, isLoading, isError } = useSamplesGrouped({ page, filters });

    function toggleGroup(key: string) {
        setExpandedGroups((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    function toggleContainer(id: number) {
        setExpandedContainers((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (isError) {
        return <Alert severity="error">Не удалось загрузить группы проб.</Alert>;
    }

    const groups = data?.results ?? [];
    const totalGroups = data?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalGroups / GROUPS_PAGE_SIZE));

    if (groups.length === 0) {
        return <Alert severity="info">По текущим фильтрам групп не найдено.</Alert>;
    }

    return (
        <Box>
            <TableContainer component={Paper} variant="outlined" sx={{ mb: 2 }}>
                <Table size="small">
                    <TableHead sx={{ bgcolor: "background.default" }}>
                        <TableRow>
                            <TableCell width={50} />
                            <TableCell>Группа / Тара / Проба</TableCell>
                            <TableCell width={200}>Статус</TableCell>
                            <TableCell width={200}>Место хранения</TableCell>
                            <TableCell width={150}>Инфо</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {groups.map((group) => {
                            const groupKey = `${group.work_order?.id ?? "none"}-${group.research_type.id}`;
                            const isGroupExpanded = expandedGroups.has(groupKey);
                            const woTypeRu = group.work_order ? (WORK_ORDER_TYPE_LABELS[group.work_order.type] ?? group.work_order.type) : "";

                            return (
                                <React.Fragment key={groupKey}>
                                    <TableRow
                                        hover
                                        sx={{ bgcolor: "action.hover", cursor: "pointer" }}
                                        onClick={() => toggleGroup(groupKey)}
                                    >
                                        <TableCell>
                                            <IconButton size="small">
                                                {isGroupExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                                            </IconButton>
                                        </TableCell>
                                        <TableCell>
                                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                <Typography sx={{ fontWeight: 600 }}>
                                                    {group.work_order
                                                        ? `${group.work_order.number} (${woTypeRu})`
                                                        : "Без Н/З"}
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={`${group.research_type.code} — ${group.research_type.name}`}
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </Stack>
                                        </TableCell>
                                        <TableCell />
                                        <TableCell />
                                        <TableCell>
                                            <Typography variant="body2" color="text.secondary">
                                                Тар: {group.containers.length} · Проб: {group.total_samples}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>

                                    <TableRow>
                                        <TableCell sx={{ py: 0, borderBottom: isGroupExpanded ? undefined : "none" }} colSpan={5}>
                                            <Collapse in={isGroupExpanded} timeout="auto" unmountOnExit>
                                                <Table size="small">
                                                    <TableBody>
                                                        {group.containers.map((c) => {
                                                            const isContainerExpanded = expandedContainers.has(c.container.id);
                                                            const hasLocation = c.container.cell_id !== null && c.container.cell_id !== undefined;

                                                            return (
                                                                <React.Fragment key={c.container.id}>
                                                                    <TableRow
                                                                        hover
                                                                        sx={{ bgcolor: "background.paper", cursor: "pointer" }}
                                                                        onClick={() => toggleContainer(c.container.id)}
                                                                    >
                                                                        <TableCell width={50} sx={{ pl: 4 }}>
                                                                            <IconButton size="small">
                                                                                {isContainerExpanded ? <KeyboardArrowDownIcon /> : <KeyboardArrowRightIcon />}
                                                                            </IconButton>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                                                <Inventory2Icon fontSize="small" color="action" />
                                                                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                                                    Тара: {c.container.number ?? `#${c.container.id}`}
                                                                                </Typography>
                                                                            </Stack>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Chip
                                                                                size="small"
                                                                                label={CONTAINER_STATUS_LABELS[c.container.status] ?? c.container.status}
                                                                                variant="outlined"
                                                                                color={c.container.status === "ACTIVE" ? "success" : "default"}
                                                                            />
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                                                <Typography variant="body2" color="text.secondary">
                                                                                    {c.location}
                                                                                </Typography>
                                                                                {hasLocation && (
                                                                                    <Tooltip title="Перейти к ячейке">
                                                                                        <IconButton
                                                                                            size="small"
                                                                                            color="primary"
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                navigate(`/topology?cell_id=${c.container.cell_id}`);
                                                                                            }}
                                                                                        >
                                                                                            <PlaceIcon fontSize="small" />
                                                                                        </IconButton>
                                                                                    </Tooltip>
                                                                                )}
                                                                            </Stack>
                                                                        </TableCell>
                                                                        <TableCell>
                                                                            <Typography variant="caption" color="text.secondary">
                                                                                Проб: {c.samples.length}
                                                                            </Typography>
                                                                        </TableCell>
                                                                    </TableRow>

                                                                    <TableRow>
                                                                        <TableCell sx={{ py: 0, borderBottom: "none" }} colSpan={5}>
                                                                            <Collapse in={isContainerExpanded} timeout="auto" unmountOnExit>
                                                                                <Table size="small">
                                                                                    <TableBody>
                                                                                        {c.samples.map((s: GroupedSampleBrief) => (
                                                                                            <TableRow
                                                                                                key={s.id}
                                                                                                hover
                                                                                                onClick={() => setEditingSampleId(s.id)}
                                                                                                sx={{ cursor: "pointer" }}
                                                                                            >
                                                                                                <TableCell width={50} sx={{ pl: 8 }} />
                                                                                                <TableCell>
                                                                                                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                                                                                        <ScienceIcon fontSize="small" color="disabled" />
                                                                                                        <Typography variant="body2" sx={{ fontFamily: "monospace" }}>
                                                                                                            {s.sample_number}
                                                                                                        </Typography>
                                                                                                    </Stack>
                                                                                                </TableCell>
                                                                                                <TableCell>
                                                                                                    <Chip
                                                                                                        size="small"
                                                                                                        label={SAMPLE_STATUS_LABELS[s.status] ?? s.status}
                                                                                                        color={STATUS_COLORS[s.status] ?? "default"}
                                                                                                    />
                                                                                                </TableCell>
                                                                                                <TableCell>
                                                                                                </TableCell>
                                                                                                <TableCell>
                                                                                                    <Typography variant="caption" color="text.secondary">
                                                                                                        Обн: {formatDate(s.updated_at)}
                                                                                                    </Typography>
                                                                                                </TableCell>
                                                                                            </TableRow>
                                                                                        ))}
                                                                                    </TableBody>
                                                                                </Table>
                                                                            </Collapse>
                                                                        </TableCell>
                                                                    </TableRow>
                                                                </React.Fragment>
                                                            );
                                                        })}
                                                    </TableBody>
                                                </Table>
                                            </Collapse>
                                        </TableCell>
                                    </TableRow>
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            {totalPages > 1 && (
                <Box sx={{ display: "flex", justifyContent: "center", mb: 2 }}>
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_e, value) => setPage(value)}
                        color="primary"
                    />
                </Box>
            )}

            <SampleEditDialog
                open={editingSampleId !== null}
                sampleId={editingSampleId}
                onClose={() => setEditingSampleId(null)}
            />
        </Box>
    );
}