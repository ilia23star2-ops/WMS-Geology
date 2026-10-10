/**
 * Справочники: типы исследования, участки, лаборатории.
 *
 * Режим — только просмотр. Редактирование через Django Admin
 * (решение 1.36 из DECISIONS.md).
 */
import { useState } from "react";
import {
    Box,
    Card,
    Chip,
    Tab,
    Tabs,
    Typography,
} from "@mui/material";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

import {
    useLaboratories,
    useResearchTypes,
    useSites,
    type Laboratory,
    type ResearchType,
    type Site,
} from "../api";

interface TabPanelProps {
    value: number;
    index: number;
    children: React.ReactNode;
}

function TabPanel({ value, index, children }: TabPanelProps) {
    if (value !== index) return null;
    return <Box sx={{ pt: 2 }}>{children}</Box>;
}

function ActiveChip({ value }: { value: boolean }) {
    return value ? (
        <Chip label="Активен" color="success" size="small" />
    ) : (
        <Chip label="Отключён" color="default" size="small" />
    );
}

export default function CatalogsPage() {
    const [tab, setTab] = useState(0);

    const researchTypes = useResearchTypes();
    const sites = useSites();
    const laboratories = useLaboratories();

    const researchColumns: GridColDef<ResearchType>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "code", headerName: "Код", width: 100 },
        { field: "name", headerName: "Название", flex: 1, minWidth: 180 },
        { field: "description", headerName: "Описание", flex: 1, minWidth: 180 },
        {
            field: "is_active",
            headerName: "Статус",
            width: 120,
            renderCell: (params) => <ActiveChip value={params.value as boolean} />,
        },
    ];

    const siteColumns: GridColDef<Site>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "code", headerName: "Код", width: 100 },
        { field: "name", headerName: "Название", flex: 1, minWidth: 180 },
        {
            field: "match_patterns",
            headerName: "Паттерны распознавания",
            flex: 1,
            minWidth: 200,
            valueGetter: (value) => ((value as string[]) ?? []).join(", "),
        },
        {
            field: "is_active",
            headerName: "Статус",
            width: 120,
            renderCell: (params) => <ActiveChip value={params.value as boolean} />,
        },
    ];

    const laboratoryColumns: GridColDef<Laboratory>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "code", headerName: "Код", width: 100 },
        { field: "name", headerName: "Название", flex: 1, minWidth: 180 },
        {
            field: "prefixes",
            headerName: "Префиксы",
            flex: 1,
            minWidth: 200,
            valueGetter: (value) => ((value as string[]) ?? []).join(", "),
        },
        {
            field: "is_active",
            headerName: "Статус",
            width: 120,
            renderCell: (params) => <ActiveChip value={params.value as boolean} />,
        },
    ];

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>
                Справочники
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Просмотр. Редактирование — через административную панель.
            </Typography>

            <Tabs
                value={tab}
                onChange={(_e, v: number) => setTab(v)}
                sx={{ borderBottom: 1, borderColor: "divider" }}
            >
                <Tab label="Типы исследования" />
                <Tab label="Участки" />
                <Tab label="Лаборатории" />
            </Tabs>

            <TabPanel value={tab} index={0}>
                <Card>
                    <Box sx={{ height: 500, width: "100%" }}>
                        <DataGrid
                            rows={researchTypes.data ?? []}
                            columns={researchColumns}
                            loading={researchTypes.isLoading}
                            disableRowSelectionOnClick
                            disableColumnFilter
                            disableColumnSelector
                            disableDensitySelector
                            hideFooter
                        />
                    </Box>
                </Card>
            </TabPanel>

            <TabPanel value={tab} index={1}>
                <Card>
                    <Box sx={{ height: 500, width: "100%" }}>
                        <DataGrid
                            rows={sites.data ?? []}
                            columns={siteColumns}
                            loading={sites.isLoading}
                            disableRowSelectionOnClick
                            disableColumnFilter
                            disableColumnSelector
                            disableDensitySelector
                            hideFooter
                        />
                    </Box>
                </Card>
            </TabPanel>

            <TabPanel value={tab} index={2}>
                <Card>
                    <Box sx={{ height: 500, width: "100%" }}>
                        <DataGrid
                            rows={laboratories.data ?? []}
                            columns={laboratoryColumns}
                            loading={laboratories.isLoading}
                            disableRowSelectionOnClick
                            disableColumnFilter
                            disableColumnSelector
                            disableDensitySelector
                            hideFooter
                        />
                    </Box>
                </Card>
            </TabPanel>
        </Box>
    );
}