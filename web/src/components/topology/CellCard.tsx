/**
 * Карточка ячейки для сетки топологии (topology-ux-web).
 * Без горизонтального скролла: адрес переносится, действия иконками.
 */
import {
    Button,
    Card,
    CardContent,
    Checkbox,
    Chip,
    IconButton,
    Stack,
    Tooltip,
    Typography,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { CELL_TYPE_LABELS, PALLET_STATUS_LABELS, type Cell } from "../../api";

export default function CellCard({
    cell,
    selected,
    onToggleSelect,
    onOpenPallet,
    onViewContents,
    onQr,
    onEdit,
    onDelete,
}: {
    cell: Cell;
    selected: boolean;
    onToggleSelect: () => void;
    onOpenPallet: (cell: Cell) => void;
    onViewContents: (cell: Cell, palletId: number) => void;
    onQr: (cell: Cell) => void;
    onEdit: (cell: Cell) => void;
    onDelete: (cell: Cell) => void;
}) {
    const palletId = cell.pallet_id;
    const palletStatus = cell.pallet_status;
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
                    <Checkbox size="small" checked={selected} onChange={onToggleSelect} sx={{ p: 0.5 }} />
                    <Typography variant="h3" sx={{ flex: 1, minWidth: 0 }} noWrap>{cell.code}</Typography>
                    <Chip
                        size="small"
                        label={cell.is_active ? "Активна" : "Отключена"}
                        color={cell.is_active ? "success" : "default"}
                    />
                </Stack>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, wordBreak: "break-word" }}>
                    {cell.full_address}
                </Typography>
                <Stack direction="row" spacing={0.5} sx={{ mt: 1, flexWrap: "wrap", rowGap: 0.5, alignItems: "center" }}>
                    <Chip
                        size="small"
                        variant="outlined"
                        label={CELL_TYPE_LABELS[cell.cell_type as keyof typeof CELL_TYPE_LABELS] ?? cell.cell_type}
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