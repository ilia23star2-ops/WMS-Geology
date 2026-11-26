/**
 * Карточка ячейки для сетки топологии (topology-ux-web + cell-card-ui).
 * Без горизонтального скролла: адрес переносится, действия иконками.
 * Мини-схема позиций яруса (слева→направо по коду) с подписью секции:
 * заливка = заполненность (серый/зелёный/жёлтый/красный),
 * текущая ячейка — чистая скруглённая синяя обводка 2px.
 * Осмысленный чип состояния (Свободна/Занята N/Отключена),
 * выделение иконкой + рамкой вместо чекбокса.
 */
import { useState } from "react";
import {
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { CELL_TYPE_LABELS, type Cell } from "../../api";
import { orderCellsByCode, occupancyColor, OCCUPANCY_COLORS } from "../../utils/cellOrder";

export default function CellCard({
    cell,
    tierCells,
    selected,
    onToggleSelect,
    onToggleSelectCell,
    onOpenPallet,
    onViewContents,
    onQr,
    onEdit,
    onDelete,
}: {
    cell: Cell;
    tierCells: Cell[];
    selected: boolean;
    onToggleSelect: () => void;
    onToggleSelectCell: (id: number) => void;
    onOpenPallet: (cell: Cell) => void;
    onViewContents: (cell: Cell, palletId: number) => void;
    onQr: (cell: Cell) => void;
    onEdit: (cell: Cell) => void;
    onDelete: (cell: Cell) => void;
}) {
    const [copied, setCopied] = useState(false);
    const palletId = cell.pallet_id;
    const palletStatus = cell.pallet_status;
    const ordered = orderCellsByCode(tierCells);
    const parts = cell.full_address.split(" / ");
    const sectionLabel = parts[2] ?? "—";
    const tierLabel = parts[3] ?? "—";

    const stateLabel = !cell.is_active
        ? "Отключена"
        : cell.containers_count > 0
            ? `Занята ${cell.containers_count}`
            : "Свободна";
    const stateColor = !cell.is_active
        ? "error"
        : cell.containers_count > 0
            ? "success"
            : "default";

    function copyAddress() {
        void navigator.clipboard.writeText(cell.full_address);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
    }

    return (
        <Card
            variant="outlined"
            sx={{
                height: "100%",
                borderColor: selected ? "primary.main" : undefined,
                borderWidth: selected ? 2 : 1,
                "&:hover": { boxShadow: 3 },
            }}
        >
            <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <Typography variant="h3" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {cell.code}
                    </Typography>
                    <Chip size="small" label={stateLabel} color={stateColor} variant={cell.is_active && cell.containers_count > 0 ? "filled" : "outlined"} />
                    <Tooltip title={selected ? "Снять выделение" : "Выделить для пакетной печати"}>
                        <IconButton size="small" color={selected ? "primary" : "default"} onClick={onToggleSelect}>
                            {selected ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Секция {sectionLabel} · Ярус {tierLabel}
                </Typography>

                <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, flexWrap: "wrap", rowGap: 0.5 }}>
                    {ordered.map((c) => (
                        <Tooltip key={c.id} title={`Ячейка ${c.code}: ${c.containers_count} тар (клик — выделить)`}>
                            <Box
                                onClick={() => onToggleSelectCell(c.id)}
                                sx={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 1,
                                    cursor: "pointer",
                                    bgcolor: OCCUPANCY_COLORS[occupancyColor(c.containers_count)],
                                    border: c.id === cell.id ? "2px solid" : "2px solid transparent",
                                    borderColor: c.id === cell.id ? "primary.main" : "transparent",
                                    "&:hover": { opacity: 0.85 },
                                }}
                            />
                        </Tooltip>
                    ))}
                </Stack>
                <Typography variant="caption" color="text.secondary">
                    Позиции яруса слева→направо; клик по квадрату — выделить ячейку.
                </Typography>

                <Stack direction="row" spacing={0.5} sx={{ mt: 1, alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary" sx={{ flex: 1, wordBreak: "break-word" }}>
                        {cell.full_address}
                    </Typography>
                    <Tooltip title={copied ? "Скопировано" : "Скопировать адрес"}>
                        <IconButton size="small" onClick={copyAddress}>
                            <ContentCopyIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.5, alignItems: "center" }}>
                    <Chip size="small" variant="outlined" label={CELL_TYPE_LABELS[cell.cell_type] ?? cell.cell_type} />
                    {palletId ? (
                        <Tooltip title="Открыть содержимое поддона">
                            <Chip
                                size="small"
                                color={palletStatus === "ACTIVE" ? "success" : "default"}
                                label={`#${palletId} · ${cell.containers_count} тар`}
                                onClick={() => onViewContents(cell, palletId)}
                                clickable
                            />
                        </Tooltip>
                    ) : (
                        <Button size="small" variant="text" onClick={() => onOpenPallet(cell)} sx={{ textTransform: "none" }}>
                            Добавить поддон
                        </Button>
                    )}
                </Stack>

                <Stack direction="row" spacing={0.5} sx={{ mt: 1, justifyContent: "flex-end" }}>
                    {palletId && (
                        <Tooltip title="Содержимое">
                            <IconButton size="small" onClick={() => onViewContents(cell, palletId)}>
                                <VisibilityIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="QR-код">
                        <IconButton size="small" onClick={() => onQr(cell)}>
                            <QrCode2Icon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Редактировать">
                        <IconButton size="small" onClick={() => onEdit(cell)}>
                            <EditIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Удалить">
                        <IconButton size="small" color="error" onClick={() => onDelete(cell)}>
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    </Tooltip>
                </Stack>
            </CardContent>
        </Card>
    );
}