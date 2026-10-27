/**
 * Модалка предпросмотра тары (2f-17c).
 *
 * Вкладки: Этикетка / QR.
 * Открывается из `ContainerDetailDialog` по кнопке «Предпросмотр».
 * Список проб и история — в самом Detail-диалоге.
 */
import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    Tab,
    Tabs,
    Typography,
} from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import PrintIcon from "@mui/icons-material/Print";
import QrCodeIcon from "@mui/icons-material/QrCode";

import {
    downloadLabelPdf,
    fetchLabelPdfUrl,
    useContainer,
} from "../api";
import AddToPrintBatchDialog from "./AddToPrintBatchDialog";

interface ContainerPreviewDialogProps {
    open: boolean;
    containerId: number | null;
    onClose: () => void;
}

type TabKey = "label" | "qr";

export default function ContainerPreviewDialog({
    open,
    containerId,
    onClose,
}: ContainerPreviewDialogProps) {
    const [tab, setTab] = useState<TabKey>("label");
    const [labelUrl, setLabelUrl] = useState<string | null>(null);
    const [labelLoading, setLabelLoading] = useState(false);
    const [labelError, setLabelError] = useState<string | null>(null);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);

    const containerQuery = useContainer(open ? containerId : null);

    function handleClose() {
        setTab("label");
        setLabelUrl(null);
        setLabelError(null);
        onClose();
    }

    // Загрузка PDF при открытии вкладки «Этикетка»
    useEffect(() => {
        if (!open || tab !== "label" || containerId === null) return;
        let cancelled = false;
        let createdUrl: string | null = null;
        setLabelLoading(true);
        setLabelError(null);
        fetchLabelPdfUrl(containerId)
            .then((url) => {
                if (cancelled) { URL.revokeObjectURL(url); return; }
                createdUrl = url;
                setLabelUrl(url);
            })
            .catch(() => { if (!cancelled) setLabelError("Не удалось загрузить этикетку."); })
            .finally(() => { if (!cancelled) setLabelLoading(false); });
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
            setLabelUrl(null);
        };
    }, [open, tab, containerId]);

    const container = containerQuery.data;

    if (!open) return null;

    return (
        <>
            <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    <Typography variant="h6" component="div">
                        Предпросмотр: {container?.container_number ?? `#${containerId}`}
                    </Typography>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 0 }}>
                    <Tabs
                        value={tab}
                        onChange={(_e, v: TabKey) => setTab(v)}
                        sx={{ px: 2, borderBottom: 1, borderColor: "divider" }}
                    >
                        <Tab value="label" label="Этикетка" />
                        <Tab value="qr" label="QR" />
                    </Tabs>

                    {tab === "label" && (
                        <Box sx={{ p: 2 }}>
                            {labelLoading ? (
                                <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                                    <CircularProgress size={24} />
                                </Box>
                            ) : labelError ? (
                                <Alert severity="error">{labelError}</Alert>
                            ) : !labelUrl ? (
                                <Typography variant="body2" color="text.secondary">Этикетка не загружена.</Typography>
                            ) : (
                                <Box
                                    component="iframe"
                                    src={labelUrl}
                                    title="PDF этикетки"
                                    sx={{ width: "100%", height: 520, border: 1, borderColor: "divider", borderRadius: 1 }}
                                />
                            )}
                        </Box>
                    )}

                    {tab === "qr" && (
                        <Box sx={{ p: 2 }}>
                            {containerId === null ? (
                                <Typography variant="body2" color="text.secondary">Тара не загружена.</Typography>
                            ) : (
                                <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
                                    <Typography variant="body1">
                                        QR-сетка для тары <b>{container?.container_number ?? `#${containerId}`}</b>.
                                    </Typography>
                                    <Alert severity="info" sx={{ width: "100%" }}>
                                        Добавьте тару в партию печати с типом <b>QR-сетка</b> (новая или существующая DRAFT).
                                    </Alert>
                                    <Button variant="contained" startIcon={<QrCodeIcon />} onClick={() => setPrintDialogOpen(true)}>
                                        В партию QR-сетка
                                    </Button>
                                </Stack>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Stack direction="row" spacing={1} sx={{ flexGrow: 1, pl: 1 }}>
                        <Button
                            startIcon={<PictureAsPdfIcon />}
                            onClick={() => { if (containerId !== null) void downloadLabelPdf(containerId); }}
                            disabled={containerId === null}
                        >
                            Скачать
                        </Button>
                        <Button
                            startIcon={<PrintIcon />}
                            onClick={() => setPrintDialogOpen(true)}
                            disabled={containerId === null}
                        >
                            В партию
                        </Button>
                    </Stack>
                    <Button onClick={handleClose}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            <AddToPrintBatchDialog
                open={printDialogOpen}
                containerIds={containerId !== null ? [containerId] : []}
                onClose={() => setPrintDialogOpen(false)}
                onSuccess={() => setPrintDialogOpen(false)}
            />
        </>
    );
}