/**
 * Локальный предпросмотр тары до сохранения.
 * Рисует макет этикетки, максимально похожий на PDF.
 */
import { useMemo, useState } from "react";
import {
    Box,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Button,
    Tab,
    Tabs,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Stack,
} from "@mui/material";

import type { Container } from "../api";

interface RangeData {
    prefix: string;
    middle: string;
    sequenceDigits: number;
    allSeqs: number[];
    skippedSeqs: number[];
    selectedSeqs: number[];
    wellName: string | null;
}

interface LocalPreviewDialogProps {
    open: boolean;
    container: Container;
    ranges: RangeData[];
    // 2f-9a-fix: номер тары, который ввели вручную (если контейнер — заготовка)
    containerNumberOverride?: string;
    onClose: () => void;
}

type TabKey = "list" | "label";

export default function LocalPreviewDialog({
    open,
    container,
    ranges,
    containerNumberOverride,
    onClose,
}: LocalPreviewDialogProps) {
    const [tab, setTab] = useState<TabKey>("list");

    // 2f-9a-fix: приоритет — реальный номер, потом введённый, потом "Заготовка"
    const displayNumber =
        container.container_number
        || containerNumberOverride?.trim()
        || "Заготовка";

    const previewSamples = useMemo(() => {
        const list: Array<{ number: string; isSelected: boolean }> = [];
        for (const r of ranges) {
            const skipped = new Set(r.skippedSeqs);
            const selected = new Set(r.selectedSeqs);
            for (const seq of r.allSeqs) {
                if (skipped.has(seq)) continue;
                const seqStr = String(seq).padStart(r.sequenceDigits, "0");
                const sampleNumber = `${r.prefix}${r.middle}${seqStr}`;
                list.push({
                    number: sampleNumber,
                    isSelected: selected.has(seq),
                });
            }
        }
        return list;
    }, [ranges]);

    const totalSamples = previewSamples.length;
    const selectedCount = previewSamples.filter((s) => s.isSelected).length;

    if (!open) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>Предпросмотр тары (до сохранения)</DialogTitle>
            <DialogContent dividers>
                <Tabs value={tab} onChange={(_e, val: TabKey) => setTab(val)} sx={{ mb: 2 }}>
                    <Tab value="list" label="Список проб" />
                    <Tab value="label" label="Макет этикетки" />
                </Tabs>

                {tab === "list" && (
                    <Box>
                        <Typography variant="body2" sx={{ mb: 2 }}>
                            Всего будет создано: <b>{totalSamples}</b> проб. Выбрано: <b>{selectedCount}</b>.
                        </Typography>
                        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 400 }}>
                            <Table size="small" stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell width={50}>п/п</TableCell>
                                        <TableCell>Номер пробы</TableCell>
                                        <TableCell>Статус</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {previewSamples.map((s, i) => (
                                        <TableRow key={s.number}>
                                            <TableCell>{i + 1}</TableCell>
                                            <TableCell sx={{ fontFamily: "monospace" }}>{s.number}</TableCell>
                                            <TableCell>
                                                {s.isSelected ? (
                                                    <Chip size="small" label="Выбрана" color="default" sx={{ color: "#000", border: "1px solid #000" }} variant="outlined" />
                                                ) : (
                                                    <Chip size="small" label="Обычная" color="default" variant="outlined" />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>
                )}

                {tab === "label" && (
                    <Box sx={{ bgcolor: "#f5f5f5", p: 3, display: "flex", justifyContent: "center" }}>
                        <Paper
                            elevation={4}
                            sx={{
                                width: 550,
                                p: 0,
                                bgcolor: "#fff",
                                border: "1px dashed #888",
                                position: "relative",
                            }}
                        >
                            {/* Пунктирный периметр */}
                            <Box sx={{ border: "1px solid #ccc", m: 1, p: 1 }}>

                                {/* Шапка этикетки */}
                                <Stack direction="row" sx={{ mb: 1, borderBottom: "1px solid #000", pb: 1 }}>
                                    <Box sx={{ flexGrow: 1, fontFamily: "sans-serif", fontSize: 12, lineHeight: 1.4 }}>
                                        <Box><span style={{ color: "#666" }}>Уч:</span> <b>{container.draft_site_name || "—"}</b></Box>
                                        <Box><span style={{ color: "#666" }}>Н/З:</span> <b>{container.draft_work_order_coded || "—"}</b></Box>
                                        <Box><span style={{ color: "#666" }}>Исл:</span> <b>{container.draft_research_type_name || "—"}</b></Box>
                                        <Box><span style={{ color: "#666" }}>№:</span> <b>{displayNumber}</b></Box>
                                    </Box>

                                    {/* QR-заглушка */}
                                    <Box
                                        sx={{
                                            width: 80, height: 80, border: "1px solid #000",
                                            display: "flex", alignItems: "center", justifyContent: "center",
                                            bgcolor: "#fff", textAlign: "center", p: 0.5,
                                            ml: 2,
                                        }}
                                    >
                                        <Typography variant="caption" sx={{ fontSize: 8, wordBreak: "break-all" }}>
                                            QR: WMSG:CONTAINER:{container.id}
                                        </Typography>
                                    </Box>
                                </Stack>

                                {/* Таблица проб с рамками */}
                                <Table size="small" sx={{ borderCollapse: "collapse" }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ p: 0.5, border: "1px solid #000", fontSize: 11, width: 40, bgcolor: "#eee" }}>п/п</TableCell>
                                            <TableCell sx={{ p: 0.5, border: "1px solid #000", fontSize: 11, width: 40, bgcolor: "#eee" }}></TableCell>
                                            <TableCell sx={{ p: 0.5, border: "1px solid #000", fontSize: 11, bgcolor: "#eee" }}>Образец</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {previewSamples.map((s, i) => (
                                            <TableRow key={s.number}>
                                                <TableCell sx={{ p: 0.5, border: "1px solid #000", fontSize: 11 }}>{i + 1}.</TableCell>
                                                <TableCell sx={{ p: 0.5, border: "1px solid #000", fontSize: 11, textAlign: "center" }}>
                                                    {/* Чекбокс: пустой или с черной галочкой */}
                                                    <Box sx={{
                                                        width: 12, height: 12,
                                                        border: "1px solid #000",
                                                        display: "inline-flex",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                        position: "relative"
                                                    }}>
                                                        {s.isSelected && (
                                                            <svg viewBox="0 0 10 10" style={{ width: "100%", height: "100%", fill: "none", stroke: "#000", strokeWidth: 1.5 }}>
                                                                <path d="M2 5 L4 8 L8 2" />
                                                            </svg>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ p: 0.5, border: "1px solid #000", fontFamily: "monospace", fontSize: 11 }}>
                                                    {s.number}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Box>
                        </Paper>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Закрыть</Button>
            </DialogActions>
        </Dialog>
    );
}