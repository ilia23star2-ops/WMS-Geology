/**
 * Диалог со списком тар внутри Н/З.
 */
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";

import { type WorkOrder } from "../api";

interface WorkOrderContainersDialogProps {
    open: boolean;
    workOrder: WorkOrder | null;
    onClose: () => void;
}

export default function WorkOrderContainersDialog({
    open,
    workOrder,
    onClose,
}: WorkOrderContainersDialogProps) {
    if (!open || !workOrder) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                Тары в Н/З: <b>{workOrder.order_number}</b>
            </DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2} sx={{ mb: 2 }}>
                    <Typography variant="body1">
                        Всего проб: <b>{workOrder.samples_count}</b>
                    </Typography>
                </Stack>

                <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Тара</TableCell>
                                <TableCell>Тип тары</TableCell>
                                <TableCell>Место хранения</TableCell>
                                <TableCell align="right">Проб</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {workOrder.containers.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell sx={{ fontWeight: 500, fontFamily: "monospace" }}>
                                        {c.number || `#${c.id}`}
                                    </TableCell>
                                    <TableCell>{c.container_type_name}</TableCell>
                                    <TableCell>{c.location}</TableCell>
                                    <TableCell align="right">{c.samples_count}</TableCell>
                                </TableRow>
                            ))}
                            {workOrder.containers.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} align="center">
                                        В этом Н/З пока нет тар.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}