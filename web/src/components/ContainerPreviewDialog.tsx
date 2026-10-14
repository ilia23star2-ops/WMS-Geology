/**
 * Диалог предпросмотра тары после заполнения пробами.
 *
 * 3 вкладки:
 * - Список — таблица проб внутри тары (с пагинацией).
 * - Этикетка — iframe с PDF-этикеткой.
 * - QR — кнопка «В партию QR-сетка (PDF)».
 *
 * Внизу — кнопка «В партию печати» (переиспользует
 * `AddToPrintBatchDialog`: этикетки или QR-сетка).
 */
import { useEffect, useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Paper,
    Stack,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
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
    useSamples,
    type SampleStatus,
    SAMPLE_STATUS_LABELS,
} from "../api";
import AddToPrintBatchDialog from "./AddToPrintBatchDialog";

interface ContainerPreviewDialogProps {
    open: boolean;
    containerId: number | null;
    onClose: () => void;
}


type TabKey = "list" | "label" | "qr";

export default function ContainerPreviewDialog({
    open,
    containerId,
    onClose,
}: ContainerPreviewDialogProps) {
    const [tab, setTab] = useState<TabKey>("list");
    const [labelUrl, setLabelUrl] = useState<string | null>(null);
    const [labelLoading, setLabelLoading] = useState(false);
    const [labelError, setLabelError] = useState<string | null>(null);
    const [printDialogOpen, setPrintDialogOpen] = useState(false);

    const containerQuery = useContainer(open ? containerId : null);
    const samplesQuery = useSamples({
        page: 1,
        filters: { container_id: containerId ?? undefined },
    });

    // Загрузить PDF-этикетку, когда открыта вкладка «Этикетка».
    useEffect(() => {
        if (!open || tab !== "label" || containerId === null) return;
        let cancelled = false;
        let createdUrl: string | null = null;
        setLabelLoading(true);
        setLabelError(null);
        fetchLabelPdfUrl(containerId)
            .then((url) => {
                if (cancelled) {
                    URL.revokeObjectURL(url);
                    return;
                }
                createdUrl = url;
                setLabelUrl(url);
            })
            .catch(() => {
                if (!cancelled) {
                    setLabelError("Не удалось загрузить этикетку.");
                }
            })
            .finally(() => {
                if (!cancelled) setLabelLoading(false);
            });
        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
            setLabelUrl(null);
        };
    }, [open, tab, containerId]);

    function handleClose() {
        setTab("list");
        setLabelUrl(null);
        setLabelError(null);
        onClose();
    }

    const container = containerQuery.data;
    const samples = useMemo(
        () => samplesQuery.data?.results ?? [],
        [samplesQuery.data],
    );

    if (!open) return null;

    return (
        <>
            <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
                <DialogTitle>
                    Тара: {container?.container_number ?? `#${containerId}`}
                </DialogTitle>
                <DialogContent dividers>
                    {containerQuery.isError && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            Не удалось загрузить данные тары.
                        </Alert>
                    )}

                    <Tabs
                        value={tab}
                        onChange={(_e, value: TabKey) => setTab(value)}
                        sx={{ mb: 2 }}
                    >
                        <Tab value="list" label="Список проб" />
                        <Tab value="label" label="Этикетка" />
                        <Tab value="qr" label="QR" />
                    </Tabs>

                    {tab === "list" && (
                        <SamplesTab
                            samples={samples}
                            isLoading={samplesQuery.isLoading}
                            totalCount={samplesQuery.data?.count ?? 0}
                        />
                    )}

                    {tab === "label" && (
                        <LabelTab
                            labelUrl={labelUrl}
                            loading={labelLoading}
                            error={labelError}
                        />
                    )}

                    {tab === "qr" && (
                        <QrTab
                            containerId={containerId}
                            containerNumber={
                                container?.container_number ?? null
                            }
                            onOpenPrint={() => setPrintDialogOpen(true)}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Stack
                        direction="row"
                        spacing={1}
                        sx={{ flexGrow: 1, pl: 1 }}
                    >
                        <Button
                            startIcon={<PictureAsPdfIcon />}
                            onClick={() => {
                                if (containerId !== null) {
                                    void downloadLabelPdf(containerId);
                                }
                            }}
                            disabled={containerId === null}
                        >
                            Скачать этикетку
                        </Button>
                        <Button
                            startIcon={<PrintIcon />}
                            onClick={() => setPrintDialogOpen(true)}
                            disabled={containerId === null}
                        >
                            В партию печати
                        </Button>
                    </Stack>
                    <Button onClick={handleClose}>Закрыть</Button>
                </DialogActions>
            </Dialog>

            <AddToPrintBatchDialog
                open={printDialogOpen}
                containerIds={containerId !== null ? [containerId] : []}
                onClose={() => setPrintDialogOpen(false)}
                onSuccess={() => {
                    setPrintDialogOpen(false);
                }}
            />
        </>
    );
}

// ============================================================
// Вкладка «Список»
// ============================================================

interface SamplesTabProps {
    samples: Array<{
        id: number;
        sample_number: string;
        well_name: string | null;
        status: SampleStatus;
    }>;
    isLoading: boolean;
    totalCount: number;
}

function SamplesTab({ samples, isLoading, totalCount }: SamplesTabProps) {
    if (isLoading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }
    if (samples.length === 0) {
        return (
            <Typography variant="body2" color="text.secondary">
                В таре нет проб.
            </Typography>
        );
    }
    return (
        <TableContainer
            component={Paper}
            variant="outlined"
            sx={{ maxHeight: 400 }}
        >
            <Table size="small" stickyHeader>
                <TableHead>
                    <TableRow>
                        <TableCell width={60}>п/п</TableCell>
                        <TableCell>Образец</TableCell>
                        <TableCell>Скважина</TableCell>
                        <TableCell>Статус</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {samples.map((s, i) => (
                        <TableRow key={s.id}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell
                                sx={{ fontFamily: "monospace", fontSize: 13 }}
                            >
                                {s.sample_number}
                            </TableCell>
                            <TableCell>{s.well_name ?? "—"}</TableCell>
                            <TableCell>
                                {SAMPLE_STATUS_LABELS[s.status] ?? s.status}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
            {totalCount > samples.length && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", p: 1 }}
                >
                    Показано {samples.length} из {totalCount}.
                </Typography>
            )}
        </TableContainer>
    );
}

// ============================================================
// Вкладка «Этикетка»
// ============================================================

interface LabelTabProps {
    labelUrl: string | null;
    loading: boolean;
    error: string | null;
}

function LabelTab({ labelUrl, loading, error }: LabelTabProps) {
    if (loading) {
        return (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                <CircularProgress size={24} />
            </Box>
        );
    }
    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }
    if (!labelUrl) {
        return (
            <Typography variant="body2" color="text.secondary">
                Этикетка не загружена.
            </Typography>
        );
    }
    return (
        <Box
            component="iframe"
            src={labelUrl}
            title="PDF этикетки"
            sx={{
                width: "100%",
                height: 520,
                border: 1,
                borderColor: "divider",
                borderRadius: 1,
            }}
        />
    );
}

// ============================================================
// Вкладка «QR»
// ============================================================

interface QrTabProps {
    containerId: number | null;
    containerNumber: string | null;
    onOpenPrint: () => void;
}

function QrTab({ containerId, containerNumber, onOpenPrint }: QrTabProps) {
    if (containerId === null) {
        return (
            <Typography variant="body2" color="text.secondary">
                Тара не загружена.
            </Typography>
        );
    }
    return (
        <Stack spacing={2} sx={{ alignItems: "flex-start" }}>
            <Typography variant="body1">
                QR-сетка для тары{" "}
                <b>{containerNumber ?? `#${containerId}`}</b>.
            </Typography>
            <Alert severity="info" sx={{ width: "100%" }}>
                Будет создана новая партия печати с типом{" "}
                <b>QR-сетка</b> и добавлена эта тара. Скачайте PDF и
                распечатайте.
            </Alert>
            <Button
                variant="contained"
                startIcon={<QrCodeIcon />}
                onClick={onOpenPrint}
            >
                В партию QR-сетка
            </Button>
        </Stack>
    );
}