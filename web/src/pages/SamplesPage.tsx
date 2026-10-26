/**
 * Реестр проб: сгруппированный список.
 *
 * Пачка 2f-8: заменен компонент списка на дерево-таблицу.
 */
import { useState } from "react";
import {
    Box,
    Card,
    CardContent,
    Checkbox,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
    Typography,
} from "@mui/material";

import {
    SAMPLE_STATUS_LABELS,
    useResearchTypes,
    useSites,
    type SampleFilters,
    type SampleStatus,
} from "../api";
import SamplesTreeTable from "../components/SamplesTreeTable";

export default function SamplesPage() {
    const [filters, setFilters] = useState<SampleFilters>({});
    const [numberInput, setNumberInput] = useState("");

    const researchTypes = useResearchTypes();
    const sites = useSites();

    function applyNumberFilter() {
        setFilters((prev) => ({
            ...prev,
            sample_number: numberInput || undefined,
        }));
    }

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>
                Пробы
            </Typography>

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <TextField
                                label="Номер пробы"
                                value={numberInput}
                                onChange={(e) => setNumberInput(e.target.value)}
                                onBlur={applyNumberFilter}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") applyNumberFilter();
                                }}
                                fullWidth
                                size="small"
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="rt-label">
                                    Тип исследования
                                </InputLabel>
                                <Select
                                    labelId="rt-label"
                                    label="Тип исследования"
                                    value={
                                        filters.research_type !== undefined
                                            ? String(filters.research_type)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value as string;
                                        setFilters((prev) => ({
                                            ...prev,
                                            research_type:
                                                value === ""
                                                    ? undefined
                                                    : Number(value),
                                        }));
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(researchTypes.data ?? []).map((rt) => (
                                        <MenuItem
                                            key={rt.id}
                                            value={String(rt.id)}
                                        >
                                            {rt.code} — {rt.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="site-label">Участок</InputLabel>
                                <Select
                                    labelId="site-label"
                                    label="Участок"
                                    value={
                                        filters.site !== undefined
                                            ? String(filters.site)
                                            : ""
                                    }
                                    onChange={(e) => {
                                        const value = e.target.value as string;
                                        setFilters((prev) => ({
                                            ...prev,
                                            site:
                                                value === ""
                                                    ? undefined
                                                    : Number(value),
                                        }));
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(sites.data ?? []).map((s) => (
                                        <MenuItem
                                            key={s.id}
                                            value={String(s.id)}
                                        >
                                            {s.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="status-label">Статус</InputLabel>
                                <Select
                                    labelId="status-label"
                                    label="Статус"
                                    value={filters.status ?? ""}
                                    onChange={(e) => {
                                        const value = e.target.value as
                                            | SampleStatus
                                            | "";
                                        setFilters((prev) => ({
                                            ...prev,
                                            status:
                                                value === ""
                                                    ? undefined
                                                    : (value as SampleStatus),
                                        }));
                                    }}
                                >
                                    <MenuItem value="">Все</MenuItem>
                                    {(
                                        Object.keys(
                                            SAMPLE_STATUS_LABELS,
                                        ) as SampleStatus[]
                                    ).map((s) => (
                                        <MenuItem key={s} value={s}>
                                            {SAMPLE_STATUS_LABELS[s]}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={
                                            filters.show_disposed ?? false
                                        }
                                        onChange={(e) => {
                                            setFilters((prev) => ({
                                                ...prev,
                                                show_disposed:
                                                    e.target.checked
                                                    || undefined,
                                            }));
                                        }}
                                    />
                                }
                                label="Показать утилизированные"
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            <SamplesTreeTable filters={filters} />
        </Box>
    );
}