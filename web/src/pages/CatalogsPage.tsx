/**
 * Справочники: типы исследования, участки, лаборатории.
 *
 * Пачка 2f-3a: добавлены CRUD-действия (создать / редактировать /
 * активировать-деактивировать / удалить).
 * - «Деактивировать» — soft через `is_active=false`.
 * - «Удалить» — hard `DELETE`, backend отдаст 409 при `PROTECT`.
 */
import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    Chip,
    IconButton,
    Snackbar,
    Stack,
    Tab,
    Tabs,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ToggleOffIcon from "@mui/icons-material/ToggleOff";
import ToggleOnIcon from "@mui/icons-material/ToggleOn";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

import {
    useDeleteCatalog,
    useLaboratories,
    useResearchTypes,
    useSites,
    useUpdateCatalog,
    type CatalogKind,
    type Laboratory,
    type ResearchType,
    type Site,
} from "../api";
import CatalogEntityDialog, {
    type CatalogEntityInitial,
} from "../components/CatalogEntityDialog";

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

function extractError(err: unknown): string | null {
    const anyErr = err as {
        response?: { data?: { error?: string; detail?: string } };
    };
    return (
        anyErr?.response?.data?.error
        ?? anyErr?.response?.data?.detail
        ?? null
    );
}

interface CatalogTabConfig {
    kind: CatalogKind;
    title: string;
    singular: string;
}

const RESEARCH_TAB: CatalogTabConfig = {
    kind: "research-types",
    title: "Типы исследования",
    singular: "тип исследования",
};

const SITE_TAB: CatalogTabConfig = {
    kind: "sites",
    title: "Участки",
    singular: "участок",
};

const LAB_TAB: CatalogTabConfig = {
    kind: "laboratories",
    title: "Лаборатории",
    singular: "лаборатория",
};

export default function CatalogsPage() {
    const [tab, setTab] = useState(0);

    const researchTypes = useResearchTypes();
    const sites = useSites();
    const laboratories = useLaboratories();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editing, setEditing] = useState<CatalogEntityInitial | null>(null);
    const [dialogConfig, setDialogConfig] = useState<CatalogTabConfig>(
        RESEARCH_TAB,
    );
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    function openCreate(config: CatalogTabConfig) {
        setDialogConfig(config);
        setEditing(null);
        setDialogOpen(true);
    }

    function openEdit(
        config: CatalogTabConfig,
        row: ResearchType | Site | Laboratory,
    ) {
        setDialogConfig(config);
        setEditing({
            id: row.id,
            code: row.code,
            name: row.name,
            description: row.description ?? "",
            sort_order: row.sort_order ?? 100,
            is_active: row.is_active,
            match_patterns:
                "match_patterns" in row ? row.match_patterns : undefined,
            prefixes: "prefixes" in row ? row.prefixes : undefined,
        });
        setDialogOpen(true);
    }

    function renderActions(
        config: CatalogTabConfig,
        row: ResearchType | Site | Laboratory,
    ) {
        return (
            <CatalogRowActions
                config={config}
                row={row}
                onEdit={() => openEdit(config, row)}
                onMessage={setMessage}
                onError={setError}
            />
        );
    }

    const researchColumns: GridColDef<ResearchType>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "code", headerName: "Код", width: 100 },
        { field: "name", headerName: "Название", flex: 1, minWidth: 180 },
        {
            field: "description",
            headerName: "Описание",
            flex: 1,
            minWidth: 180,
        },
        {
            field: "sort_order",
            headerName: "Сорт.",
            width: 80,
        },
        {
            field: "is_active",
            headerName: "Статус",
            width: 120,
            renderCell: (params) => (
                <ActiveChip value={params.value as boolean} />
            ),
        },
        {
            field: "actions",
            headerName: "",
            width: 140,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) =>
                renderActions(RESEARCH_TAB, params.row),
        },
    ];

    const siteColumns: GridColDef<Site>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "code", headerName: "Код", width: 100 },
        { field: "name", headerName: "Название", flex: 1, minWidth: 180 },
        {
            field: "match_patterns",
            headerName: "Паттерны",
            flex: 1,
            minWidth: 200,
            valueGetter: (value) => ((value as string[]) ?? []).join(", "),
        },
        {
            field: "sort_order",
            headerName: "Сорт.",
            width: 80,
        },
        {
            field: "is_active",
            headerName: "Статус",
            width: 120,
            renderCell: (params) => (
                <ActiveChip value={params.value as boolean} />
            ),
        },
        {
            field: "actions",
            headerName: "",
            width: 140,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => renderActions(SITE_TAB, params.row),
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
            field: "sort_order",
            headerName: "Сорт.",
            width: 80,
        },
        {
            field: "is_active",
            headerName: "Статус",
            width: 120,
            renderCell: (params) => (
                <ActiveChip value={params.value as boolean} />
            ),
        },
        {
            field: "actions",
            headerName: "",
            width: 140,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) =>
                renderActions(LAB_TAB, params.row),
        },
    ];

    return (
        <Box>
            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    mb: 2,
                    flexWrap: "wrap",
                    rowGap: 1,
                }}
            >
                <Typography variant="h2" component="h1">
                    Справочники
                </Typography>
            </Box>

            {error && (
                <Alert
                    severity="error"
                    sx={{ mb: 2 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

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
                <Stack
                    direction="row"
                    sx={{ justifyContent: "flex-end", mb: 1 }}
                >
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => openCreate(RESEARCH_TAB)}
                    >
                        Добавить тип
                    </Button>
                </Stack>
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
                <Stack
                    direction="row"
                    sx={{ justifyContent: "flex-end", mb: 1 }}
                >
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => openCreate(SITE_TAB)}
                    >
                        Добавить участок
                    </Button>
                </Stack>
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
                <Stack
                    direction="row"
                    sx={{ justifyContent: "flex-end", mb: 1 }}
                >
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => openCreate(LAB_TAB)}
                    >
                        Добавить лабораторию
                    </Button>
                </Stack>
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

            <CatalogEntityDialog
                open={dialogOpen}
                kind={dialogConfig.kind}
                title={dialogConfig.singular}
                initial={editing}
                onClose={() => setDialogOpen(false)}
                onSuccess={(msg) => setMessage(msg)}
            />

            <Snackbar
                open={message !== null}
                autoHideDuration={6000}
                onClose={() => setMessage(null)}
                message={message ?? ""}
            />
        </Box>
    );
}

// ============================================================
// Действия в строке (edit / toggle / delete)
// ============================================================
interface CatalogRowActionsProps {
    config: CatalogTabConfig;
    row: ResearchType | Site | Laboratory;
    onEdit: () => void;
    onMessage: (msg: string) => void;
    onError: (msg: string) => void;
}

function CatalogRowActions({
    config,
    row,
    onEdit,
    onMessage,
    onError,
}: CatalogRowActionsProps) {
    const update = useUpdateCatalog(config.kind);
    const remove = useDeleteCatalog(config.kind);

    const busy = update.isPending || remove.isPending;

    async function handleToggleActive() {
        try {
            await update.mutateAsync({
                id: row.id,
                payload: { is_active: !row.is_active },
            });
            onMessage(
                row.is_active
                    ? `«${row.name}» деактивировано.`
                    : `«${row.name}» активировано.`,
            );
        } catch (err) {
            onError(
                extractError(err)
                ?? "Не удалось изменить активность.",
            );
        }
    }

    async function handleDelete() {
        const ok = window.confirm(
            `Удалить «${row.name}»? Действие необратимо.`,
        );
        if (!ok) return;
        try {
            await remove.mutateAsync(row.id);
            onMessage(`«${row.name}» удалено.`);
        } catch (err) {
            onError(
                extractError(err)
                ?? "Не удалось удалить (возможно, запись используется).",
            );
        }
    }

    return (
        <Stack direction="row" spacing={0.5}>
            <Tooltip title="Редактировать">
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit();
                    }}
                    disabled={busy}
                >
                    <EditIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Tooltip
                title={row.is_active ? "Деактивировать" : "Активировать"}
            >
                <IconButton
                    size="small"
                    color={row.is_active ? "default" : "success"}
                    onClick={(e) => {
                        e.stopPropagation();
                        void handleToggleActive();
                    }}
                    disabled={busy}
                >
                    {row.is_active ? (
                        <ToggleOffIcon fontSize="small" />
                    ) : (
                        <ToggleOnIcon fontSize="small" />
                    )}
                </IconButton>
            </Tooltip>

            <Tooltip title="Удалить">
                <IconButton
                    size="small"
                    color="error"
                    onClick={(e) => {
                        e.stopPropagation();
                        void handleDelete();
                    }}
                    disabled={busy}
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Stack>
    );
}