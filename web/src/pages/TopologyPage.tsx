/**
 * Топология склада (пачка 2f-4a + 2f-4b + 2f-4c-2 + 2f-11).
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    IconButton,
    List,
    ListItemButton,
    ListItemText,
    Snackbar,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PrintIcon from "@mui/icons-material/Print";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import VisibilityIcon from "@mui/icons-material/Visibility"; // <--- Добавлено
import {
    DataGrid,
    type GridColDef,
    type GridRowId,
    type GridRowSelectionModel,
} from "@mui/x-data-grid";

import {
    CELL_TYPE_LABELS,
    PALLET_STATUS_LABELS,
    downloadCellQrPdf,
    downloadCellsBatchQrPdf,
    downloadSectionQrPdf,
    useCells,
    useDeleteCell,
    useDeleteRack,
    useDeleteRoom,
    useDeleteSection,
    useDeleteTier,
    usePalletByCell,
    useRacks,
    useRooms,
    useSections,
    useTiers,
    type Cell,
    type QrBatchItem,
    type Rack,
    type Room,
    type Section,
    type Tier,
} from "../api";
import PalletDialog from "../components/PalletDialog";
import TopologyEntityDialog, {
    type TopologyInitial,
    type TopologyKind,
} from "../components/TopologyEntityDialog";
import CellContentsDialog from "../components/CellContentsDialog";

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

function emptySelection(): GridRowSelectionModel {
    return { type: "include", ids: new Set<GridRowId>() };
}

/**
 * Ячейка колонки «Поддон»: chip с номером/статусом и кнопки
 * «Посмотреть» (глаз) / «Настроить» (карандаш).
 */
function CellPalletChip({
    cell,
    onOpenPallet,
    onViewContents,
}: {
    cell: Cell;
    onOpenPallet: (cell: Cell) => void;
    onViewContents: (cell: Cell, palletId: number) => void;
}) {
    const { data: pallet, isLoading } = usePalletByCell(cell.id);

    if (isLoading) {
        return <CircularProgress size={14} />;
    }

    if (!pallet) {
        return (
            <Button
                size="small"
                variant="text"
                onClick={() => onOpenPallet(cell)}
                sx={{ textTransform: "none" }}
            >
                Добавить
            </Button>
        );
    }

    return (
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
            <Chip
                size="small"
                label={`#${pallet.id} · ${PALLET_STATUS_LABELS[pallet.status]}`}
                color={pallet.status === "ACTIVE" ? "success" : "default"}
                onClick={() => onViewContents(cell, pallet.id)}
                clickable
            />
            <Tooltip title="Посмотреть содержимое">
                <IconButton size="small" onClick={() => onViewContents(cell, pallet.id)}>
                    <VisibilityIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>
            <Tooltip title="Настроить поддон">
                <IconButton size="small" onClick={() => onOpenPallet(cell)}>
                    <EditIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>
        </Stack>
    );
}

export default function TopologyPage() {
    const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
    const [selectedRack, setSelectedRack] = useState<number | null>(null);
    const [selectedSection, setSelectedSection] = useState<number | null>(null);
    const [selectedTier, setSelectedTier] = useState<number | null>(null);

    const [dialogOpen, setDialogOpen] = useState(false);
    const [dialogKind, setDialogKind] = useState<TopologyKind>("room");
    const [dialogParentId, setDialogParentId] = useState<number | null>(null);
    const [dialogInitial, setDialogInitial] =
        useState<TopologyInitial | null>(null);
    const [dialogAddressPrefix, setDialogAddressPrefix] =
        useState<string>("");

    const [palletCell, setPalletCell] = useState<Cell | null>(null);
    const [viewCell, setViewCell] = useState<Cell | null>(null);
    const [viewPalletId, setViewPalletId] = useState<number | null>(null);

    const [cellSelection, setCellSelection] =
        useState<GridRowSelectionModel>(emptySelection());

    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const rooms = useRooms();
    const racks = useRacks(selectedRoom);
    const sections = useSections(selectedRack);
    const tiers = useTiers(selectedSection);
    const cells = useCells(selectedTier);

    const delRoom = useDeleteRoom();
    const delRack = useDeleteRack();
    const delSection = useDeleteSection();
    const delTier = useDeleteTier();
    const delCell = useDeleteCell();

    const selectedCellIds = useMemo(
        () => Array.from(cellSelection.ids).map((id) => Number(id)),
        [cellSelection],
    );

    function openCreate(
        kind: TopologyKind,
        parentId: number | null,
        addressPrefix?: string,
    ) {
        setDialogKind(kind);
        setDialogParentId(parentId);
        setDialogInitial(null);
        setDialogAddressPrefix(addressPrefix ?? "");
        setDialogOpen(true);
    }

    function openEdit(kind: TopologyKind, initial: TopologyInitial) {
        setDialogKind(kind);
        setDialogInitial(initial);
        setDialogAddressPrefix("");
        setDialogOpen(true);
    }

    async function handleDelete(
        kind: TopologyKind,
        id: number,
        label: string,
    ) {
        const ok = window.confirm(
            `Удалить «${label}»? Вложенные объекты тоже удалятся.`,
        );
        if (!ok) return;
        try {
            if (kind === "room") await delRoom.mutateAsync(id);
            else if (kind === "rack") await delRack.mutateAsync(id);
            else if (kind === "section") await delSection.mutateAsync(id);
            else if (kind === "tier") await delTier.mutateAsync(id);
            else await delCell.mutateAsync(id);
            setMessage(`«${label}» удалено.`);
        } catch (err) {
            setError(extractError(err) ?? "Не удалось удалить.");
        }
    }

    async function handleSectionQr(section: Section) {
        try {
            await downloadSectionQrPdf(section.id);
        } catch {
            setError(`Не удалось открыть QR секции «${section.code}».`);
        }
    }

    async function handleCellQr(cell: Cell) {
        try {
            await downloadCellQrPdf(cell.id);
        } catch {
            setError(`Не удалось открыть QR ячейки «${cell.code}».`);
        }
    }

    async function handleBatchQr() {
        if (selectedCellIds.length === 0) return;
        const items: QrBatchItem[] = selectedCellIds.map((id) => ({
            type: "CELL",
            id,
        }));
        try {
            await downloadCellsBatchQrPdf(items);
            setCellSelection(emptySelection());
        } catch {
            setError("Не удалось сформировать PDF с QR.");
        }
    }

    // Ячейки выбранного яруса
    const cellColumns: GridColDef<Cell>[] = [
        { field: "id", headerName: "ID", width: 70 },
        { field: "code", headerName: "Код", width: 90 },
        {
            field: "full_address",
            headerName: "Адрес",
            flex: 1,
            minWidth: 240,
        },
        {
            field: "cell_type",
            headerName: "Тип",
            width: 110,
            valueGetter: (value) =>
                CELL_TYPE_LABELS[value as keyof typeof CELL_TYPE_LABELS]
                ?? value,
        },
        {
            field: "pallet",
            headerName: "Поддон",
            width: 240,
            sortable: false,
            filterable: false,
            renderCell: (params) => (
                <CellPalletChip
                    cell={params.row}
                    onOpenPallet={(c) => setPalletCell(c)}
                    onViewContents={(c, pId) => {
                        setViewCell(c);
                        setViewPalletId(pId);
                    }}
                />
            ),
        },
        {
            field: "is_active",
            headerName: "Статус",
            width: 110,
            renderCell: (params) =>
                params.value ? (
                    <Chip label="Активна" color="success" size="small" />
                ) : (
                    <Chip label="Отключена" size="small" />
                ),
        },
        {
            field: "actions",
            headerName: "",
            width: 140,
            sortable: false,
            filterable: false,
            disableColumnMenu: true,
            renderCell: (params) => (
                <Stack direction="row" spacing={0.5}>
                    <Tooltip title="QR-код">
                        <IconButton
                            size="small"
                            onClick={() => void handleCellQr(params.row)}
                        >
                            <QrCode2Icon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <IconButton
                            size="small"
                            onClick={() =>
                                openEdit("cell", {
                                    id: params.row.id,
                                    code: params.row.code,
                                    full_address: params.row.full_address,
                                    cell_type: params.row.cell_type,
                                    qr_code: params.row.qr_code,
                                    is_active: params.row.is_active,
                                })
                            }
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить">
                        <IconButton
                            size="small"
                            color="error"
                            onClick={() =>
                                void handleDelete(
                                    "cell",
                                    params.row.id,
                                    params.row.full_address,
                                )
                            }
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            ),
        },
    ];

    // Строка дерева
    function TreeNode({
        label,
        depth,
        hasChildren,
        onSelect,
        onAdd,
        onEdit,
        onDelete,
        onQr,
        selected,
    }: {
        label: string;
        depth: number;
        hasChildren: boolean;
        onSelect?: () => void;
        onAdd: () => void;
        onEdit: () => void;
        onDelete: () => void;
        onQr?: () => void;
        selected?: boolean;
    }) {
        return (
            <ListItemButton
                selected={selected}
                onClick={onSelect}
                sx={{ pl: 2 + depth * 2 }}
            >
                {hasChildren ? (
                    selected
                        ? <ExpandMoreIcon fontSize="small" />
                        : <ChevronRightIcon fontSize="small" />
                ) : (
                    <Box sx={{ width: 20 }} />
                )}
                <ListItemText
                    primary={label}
                    slotProps={{
                        primary: { variant: "body2" },
                    }}
                />
                <Tooltip title="Добавить вложенное">
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onAdd();
                        }}
                    >
                        <AddIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                {onQr && (
                    <Tooltip title="QR-код">
                        <IconButton
                            size="small"
                            onClick={(e) => {
                                e.stopPropagation();
                                onQr();
                            }}
                        >
                            <QrCode2Icon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                )}
                <Tooltip title="Редактировать">
                    <IconButton
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit();
                        }}
                    >
                        <EditIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
                <Tooltip
                    title={
                        hasChildren
                            ? "Сначала удалите вложенные объекты"
                            : "Удалить"
                    }
                >
                    <span>
                        <IconButton
                            size="small"
                            color="error"
                            disabled={hasChildren}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </span>
                </Tooltip>
            </ListItemButton>
        );
    }

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
                    Топология склада
                </Typography>
                <Tooltip title="Добавить комнату">
                    <IconButton
                        color="primary"
                        onClick={() => openCreate("room", null)}
                    >
                        <AddIcon />
                    </IconButton>
                </Tooltip>
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

            <Stack
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                sx={{ alignItems: "flex-start" }}
            >
                {/* Дерево */}
                <Card sx={{ width: { xs: "100%", md: 460 }, flexShrink: 0 }}>
                    <CardContent>
                        <Typography variant="h3" sx={{ mb: 1 }}>
                            Иерархия
                        </Typography>
                        <List dense disablePadding>
                            {(rooms.data ?? []).map((room: Room) => {
                                const roomSelected = selectedRoom === room.id;
                                const roomRacks = roomSelected
                                    ? racks.data ?? []
                                    : [];
                                return (
                                    <Box key={room.id}>
                                        <TreeNode
                                            label={room.name}
                                            depth={0}
                                            hasChildren={true}
                                            selected={roomSelected}
                                            onSelect={() => {
                                                setSelectedRoom(room.id);
                                                setSelectedRack(null);
                                                setSelectedSection(null);
                                                setSelectedTier(null);
                                            }}
                                            onAdd={() =>
                                                openCreate("rack", room.id)
                                            }
                                            onEdit={() =>
                                                openEdit("room", {
                                                    id: room.id,
                                                    name: room.name,
                                                    description: room.description,
                                                })
                                            }
                                            onDelete={() =>
                                                void handleDelete(
                                                    "room",
                                                    room.id,
                                                    room.name,
                                                )
                                            }
                                        />

                                        {roomSelected
                                            && roomRacks.map((rack: Rack) => {
                                                const rackSelected =
                                                    selectedRack === rack.id;
                                                const rackSections =
                                                    rackSelected
                                                        ? sections.data ?? []
                                                        : [];
                                                return (
                                                    <Box key={rack.id}>
                                                        <TreeNode
                                                            label={`Стеллаж ${rack.code}`}
                                                            depth={1}
                                                            hasChildren={true}
                                                            selected={rackSelected}
                                                            onSelect={() => {
                                                                setSelectedRack(rack.id);
                                                                setSelectedSection(null);
                                                                setSelectedTier(null);
                                                            }}
                                                            onAdd={() =>
                                                                openCreate(
                                                                    "section",
                                                                    rack.id,
                                                                )
                                                            }
                                                            onEdit={() =>
                                                                openEdit("rack", {
                                                                    id: rack.id,
                                                                    code: rack.code,
                                                                    description: rack.description,
                                                                })
                                                            }
                                                            onDelete={() =>
                                                                void handleDelete(
                                                                    "rack",
                                                                    rack.id,
                                                                    `Стеллаж ${rack.code}`,
                                                                )
                                                            }
                                                        />

                                                        {rackSelected
                                                            && rackSections.map((section: Section) => {
                                                                const sectionSelected =
                                                                    selectedSection === section.id;
                                                                const sectionTiers =
                                                                    sectionSelected
                                                                        ? tiers.data ?? []
                                                                        : [];
                                                                return (
                                                                    <Box key={section.id}>
                                                                        <TreeNode
                                                                            label={`Секция ${section.code}`}
                                                                            depth={2}
                                                                            hasChildren={true}
                                                                            selected={sectionSelected}
                                                                            onSelect={() => {
                                                                                setSelectedSection(section.id);
                                                                                setSelectedTier(null);
                                                                            }}
                                                                            onAdd={() =>
                                                                                openCreate(
                                                                                    "tier",
                                                                                    section.id,
                                                                                )
                                                                            }
                                                                            onQr={() =>
                                                                                void handleSectionQr(section)
                                                                            }
                                                                            onEdit={() =>
                                                                                openEdit("section", {
                                                                                    id: section.id,
                                                                                    code: section.code,
                                                                                    qr_code: section.qr_code,
                                                                                    description: section.description,
                                                                                })
                                                                            }
                                                                            onDelete={() =>
                                                                                void handleDelete(
                                                                                    "section",
                                                                                    section.id,
                                                                                    `Секция ${section.code}`,
                                                                                )
                                                                            }
                                                                        />

                                                                        {sectionSelected
                                                                            && sectionTiers.map((tier: Tier) => {
                                                                                const tierSelected =
                                                                                    selectedTier === tier.id;
                                                                                return (
                                                                                    <TreeNode
                                                                                        key={tier.id}
                                                                                        label={`Ярус ${tier.code}`}
                                                                                        depth={3}
                                                                                        hasChildren={false}
                                                                                        selected={tierSelected}
                                                                                        onSelect={() => {
                                                                                            setSelectedTier(tier.id);
                                                                                            setCellSelection(emptySelection());
                                                                                        }}
                                                                                        onAdd={() =>
                                                                                            openCreate(
                                                                                                "cell",
                                                                                                tier.id,
                                                                                                `${room.name} / ${rack.code} / ${section.code} / ${tier.code}`,
                                                                                            )
                                                                                        }
                                                                                        onEdit={() =>
                                                                                            openEdit("tier", {
                                                                                                id: tier.id,
                                                                                                code: tier.code,
                                                                                                level_number: tier.level_number,
                                                                                                description: tier.description,
                                                                                            })
                                                                                        }
                                                                                        onDelete={() =>
                                                                                            void handleDelete(
                                                                                                "tier",
                                                                                                tier.id,
                                                                                                `Ярус ${tier.code}`,
                                                                                            )
                                                                                        }
                                                                                    />
                                                                                );
                                                                            })}
                                                                    </Box>
                                                                );
                                                            })}
                                                    </Box>
                                                );
                                            })}
                                    </Box>
                                );
                            })}
                        </List>

                        {rooms.isLoading && (
                            <Typography variant="body2" color="text.secondary">
                                Загрузка...
                            </Typography>
                        )}
                        {!rooms.isLoading && (rooms.data?.length ?? 0) === 0 && (
                            <Alert severity="info">
                                Пока нет ни одной комнаты. Начните с «+» в шапке.
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* Ячейки */}
                <Card sx={{ flex: 1, minWidth: 0 }}>
                    <CardContent>
                        <Typography variant="h3" sx={{ mb: 1 }}>
                            Ячейки{" "}
                            {selectedTier !== null && `яруса #${selectedTier}`}
                        </Typography>

                        {selectedTier === null ? (
                            <Alert severity="info">
                                Выберите ярус в дереве, чтобы увидеть ячейки.
                            </Alert>
                        ) : (
                            <>
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    sx={{
                                        justifyContent: "flex-end",
                                        alignItems: "center",
                                        mb: 1,
                                        flexWrap: "wrap",
                                        rowGap: 1,
                                    }}
                                >
                                    {selectedCellIds.length > 0 && (
                                        <>
                                            <Typography
                                                variant="body2"
                                                color="text.secondary"
                                            >
                                                Выбрано: {selectedCellIds.length}
                                            </Typography>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<PrintIcon />}
                                                onClick={() => void handleBatchQr()}
                                            >
                                                Печать QR ({selectedCellIds.length})
                                            </Button>
                                        </>
                                    )}
                                    <Tooltip title="Добавить ячейку">
                                        <IconButton
                                            color="primary"
                                            onClick={() => {
                                                const tier = (tiers.data ?? [])
                                                    .find((t) => t.id === selectedTier);
                                                const section = (sections.data ?? [])
                                                    .find((s) => s.id === tier?.section);
                                                const rack = (racks.data ?? [])
                                                    .find((r) => r.id === section?.rack);
                                                const room = (rooms.data ?? [])
                                                    .find((r) => r.id === rack?.room);
                                                const prefix =
                                                    room && rack && section && tier
                                                        ? `${room.name} / ${rack.code} / ${section.code} / ${tier.code}`
                                                        : "";
                                                openCreate("cell", selectedTier, prefix);
                                            }}
                                        >
                                            <AddIcon />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                                <Box sx={{ height: 480, width: "100%" }}>
                                    <DataGrid
                                        rows={cells.data ?? []}
                                        columns={cellColumns}
                                        loading={cells.isLoading}
                                        checkboxSelection
                                        rowSelectionModel={cellSelection}
                                        onRowSelectionModelChange={setCellSelection}
                                        disableRowSelectionOnClick
                                        disableColumnFilter
                                        disableColumnSelector
                                        disableDensitySelector
                                        hideFooter
                                    />
                                </Box>
                            </>
                        )}
                    </CardContent>
                </Card>
            </Stack>

            <TopologyEntityDialog
                open={dialogOpen}
                kind={dialogKind}
                parentId={dialogParentId}
                initial={dialogInitial}
                addressPrefix={dialogAddressPrefix}
                onClose={() => setDialogOpen(false)}
                onSuccess={(msg) => setMessage(msg)}
            />

            <PalletDialog
                open={palletCell !== null}
                cell={palletCell}
                onClose={() => setPalletCell(null)}
                onSuccess={(msg) => setMessage(msg)}
            />

            <CellContentsDialog
                open={viewCell !== null}
                cell={viewCell}
                palletId={viewPalletId}
                onClose={() => {
                    setViewCell(null);
                    setViewPalletId(null);
                }}
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