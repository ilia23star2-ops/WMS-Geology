/**
 * Группированный список проб (пачка 2f-2a + 2f-2b).
 *
 * Группа = (Н/З × ТИ). Внутри — тары с пробами.
 * Источник: `GET /samples/grouped/`, пагинация по 20 групп.
 *
 * Клик по чипу пробы открывает `SampleEditDialog` (edit / dispose /
 * restore / delete).
 */
import { useEffect, useState } from "react";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Divider,
    Pagination,
    Stack,
    Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import {
    SAMPLE_STATUS_LABELS,
    useSamplesGrouped,
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
    ISSUED: "default",
    CONSUMED: "warning",
    DISPOSED: "error",
    PENDING_DECRYPTION: "warning",
    PENDING_PLACEMENT: "warning",
};

interface SamplesGroupedListProps {
    filters: SampleFilters;
}

export default function SamplesGroupedList({
    filters,
}: SamplesGroupedListProps) {
    const [page, setPage] = useState(1);
    const [editingSampleId, setEditingSampleId] = useState<number | null>(null);

    // При смене фильтров — возвращаемся на первую страницу.
    useEffect(() => {
        setPage(1);
    }, [filters]);

    const { data, isLoading, isError } = useSamplesGrouped({
        page,
        filters,
    });

    if (isLoading) {
        return (
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "center",
                    py: 4,
                }}
            >
                <CircularProgress size={28} />
            </Box>
        );
    }

    if (isError) {
        return (
            <Alert severity="error">Не удалось загрузить группы проб.</Alert>
        );
    }

    const groups = data?.results ?? [];
    const totalGroups = data?.count ?? 0;
    const totalPages = Math.max(1, Math.ceil(totalGroups / GROUPS_PAGE_SIZE));

    if (groups.length === 0) {
        return (
            <Alert severity="info">
                По текущим фильтрам групп не найдено.
            </Alert>
        );
    }

    return (
        <Box>
            <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 1 }}
            >
                Групп: {totalGroups}. Клик по пробе — редактирование.
            </Typography>

            {groups.map((group, idx) => {
                const woLabel = group.work_order
                    ? `${group.work_order.number} (${group.work_order.type})`
                    : "Без Н/З";
                const rtLabel =
                    `${group.research_type.code} — ${group.research_type.name}`;
                return (
                    <Accordion
                        key={`${group.work_order?.id ?? "none"}-${group.research_type.id}-${idx}`}
                        defaultExpanded={idx === 0}
                        sx={{ mb: 1 }}
                    >
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack
                                direction="row"
                                spacing={1}
                                sx={{
                                    alignItems: "center",
                                    flexWrap: "wrap",
                                    rowGap: 0.5,
                                    width: "100%",
                                }}
                            >
                                <Typography sx={{ fontWeight: 600 }}>
                                    {woLabel}
                                </Typography>
                                <Chip
                                    size="small"
                                    label={rtLabel}
                                    color="primary"
                                    variant="outlined"
                                />
                                <Box sx={{ flexGrow: 1 }} />
                                <Typography
                                    variant="body2"
                                    color="text.secondary"
                                >
                                    Проб: {group.total_samples} · Тар:{" "}
                                    {group.containers.length}
                                </Typography>
                            </Stack>
                        </AccordionSummary>

                        <AccordionDetails>
                            <Stack spacing={1}>
                                {group.containers.map((c) => (
                                    <Card
                                        key={c.container.id}
                                        variant="outlined"
                                    >
                                        <CardContent>
                                            <Stack
                                                direction="row"
                                                spacing={1}
                                                sx={{
                                                    alignItems: "center",
                                                    mb: 1,
                                                    flexWrap: "wrap",
                                                    rowGap: 0.5,
                                                }}
                                            >
                                                <Typography sx={{ fontWeight: 600 }}>
                                                    Тара:{" "}
                                                    {c.container.number
                                                        ?? `#${c.container.id}`}
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={c.container.status}
                                                    variant="outlined"
                                                />
                                                <Typography
                                                    variant="body2"
                                                    color="text.secondary"
                                                >
                                                    {c.location}
                                                </Typography>
                                            </Stack>

                                            <Divider sx={{ mb: 1 }} />

                                            <Stack
                                                direction="row"
                                                spacing={0.5}
                                                sx={{
                                                    flexWrap: "wrap",
                                                    rowGap: 0.5,
                                                }}
                                            >
                                                {c.samples.map((s) => (
                                                    <Chip
                                                        key={s.id}
                                                        size="small"
                                                        label={s.sample_number}
                                                        color={
                                                            STATUS_COLORS[s.status]
                                                            ?? "default"
                                                        }
                                                        variant="outlined"
                                                        onClick={() =>
                                                            setEditingSampleId(s.id)
                                                        }
                                                        clickable
                                                    />
                                                ))}
                                            </Stack>
                                        </CardContent>
                                    </Card>
                                ))}
                            </Stack>
                        </AccordionDetails>
                    </Accordion>
                );
            })}

            {totalPages > 1 && (
                <Box
                    sx={{
                        display: "flex",
                        justifyContent: "center",
                        mt: 2,
                    }}
                >
                    <Pagination
                        count={totalPages}
                        page={page}
                        onChange={(_e, value) => setPage(value)}
                        color="primary"
                    />
                </Box>
            )}

            <Box sx={{ mt: 3 }}>
                <Typography variant="caption" color="text.secondary">
                    Статусы:{" "}
                    {(
                        Object.keys(SAMPLE_STATUS_LABELS) as SampleStatus[]
                    )
                        .map((s) => SAMPLE_STATUS_LABELS[s])
                        .join(" · ")}
                </Typography>
            </Box>

            <SampleEditDialog
                open={editingSampleId !== null}
                sampleId={editingSampleId}
                onClose={() => setEditingSampleId(null)}
            />
        </Box>
    );
}