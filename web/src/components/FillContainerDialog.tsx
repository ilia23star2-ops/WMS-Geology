/**
 * Диалог управления пробами в таре (2f-9c).
 *
 * Обёртка над FillContainerContent: сам диалог + заголовок.
 * Вся логика — в FillContainerContent (2f-17a).
 */
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@mui/material";

import type { Container } from "../api";
import FillContainerContent from "./FillContainerContent";

interface FillContainerDialogProps {
    open: boolean;
    container: Container | null;
    onClose: () => void;
    onSuccess: (containerId: number, totalSamples: number) => void;
}

export default function FillContainerDialog({
    open,
    container,
    onClose,
    onSuccess,
}: FillContainerDialogProps) {
    if (!container) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                Управление пробами в таре {container.container_number ? `№${container.container_number}` : ""}
            </DialogTitle>
            <DialogContent>
                <FillContainerContent
                    container={container}
                    onClose={onClose}
                    onSuccess={onSuccess}
                />
            </DialogContent>
        </Dialog>
    );
}