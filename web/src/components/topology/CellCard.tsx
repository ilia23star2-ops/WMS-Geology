/**
 * Карточка ячейки для сетки топологии (topology-ux-web + cell-card-ui).
 * Без горизонтального скролла: адрес переносится, действия иконками.
 * Мини-схема позиций яруса (слева→направо по коду), счётчик тар,
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
import { CELL_TYPE_LABELS, PALLET_STATUS_LABELS, type Cell } from "../../api";
import { orderCellsByCode, occupancyColor } from "../../utils/cellOrder";

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
            }}
        >
            <CardContent sx={{ pb: 1 }}>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                    <Typography variant="h3" sx={{ flex: 1, minWidth: 0 }} noWrap>
                        {cell.code}
                    </Typography>
                    <Chip
                        size="small"
                        label={cell.is_active ? "Активна" : "Отключена"}
                        color={cell.is_active ? "success" : "default"}
                    />
                    <Tooltip title={selected ? "Снять выделение" : "Выделить для пакетной печати"}>
                        <IconButton size="small" color={selected ? "primary" : "default"} onClick={onToggleSelect}>
                            {selected ? <CheckCircleIcon fontSize="small" /> : <RadioButtonUncheckedIcon fontSize="small" />}
                        </IconButton>
                    </Tooltip>
                </Stack>

                <Stack direction="row" spacing={1} sx={{ mt: 1, alignItems: "center" }}>
                    <Typography variant="body2" color="text.secondary" sx={{ minWidth: 64 }}>
                        Ярус {cell.full_address.split(" / ")[3] ?? "—"}
                    </Typography>
                    <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                        {ordered.map((c) => (
                            <Tooltip key={c.id} title={`Ячейка ${c.code}: ${c.containers_count} тар (клик — выделить)`}>
                                <Box
                                    onClick={() => onToggleSelectCell(c.id)}
                                    sx={{
                                        width: 22,
                                        height: 22,
                                        borderRadius: 0.5,
                                        cursor: "pointer",
                                        border: c.id === cell.id ? "2px solid" : "1px solid",
                                        borderColor: c.id === cell.id ? "primary.main" : "divider",
                                        bgcolor:
                                            occupancyColor(c.containers_count) === "filled"
                                                ? "success.main"
                                                : "action.disabledBackground",
                                        opacity: c.containers_count > 0 ? 1 : 0.6,
                                    }}
                                />
                            </Tooltip>
                        ))}
                    </Stack>
                </Stack>

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
                    <Chip
                        size="small"
                        label={`${cell.containers_count} тар`}
                        color={cell.containers_count > 0 ? "info" : "default"}
                    />
                    {palletId ? (
                        <Chip
                            size="small"
                            color={palletStatus === "ACTIVE" ? "success" : "default"}
                            label={`#${palletId} · ${PALLET_STATUS_LABELS[palletStatus as keyof typeof PALLET_STATUS_LABELS] || palletStatus}`}
                            onClick={() => onViewContents(cell, palletId)}
                            clickable
                        />
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