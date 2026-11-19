/**
 * Сессия оцифровки в web (6e-3-web-c, +имя пакета 6e-3-backend).
 * Поток как в мобилке: «Добавить ячейку» → окно с поэтапным выбором
 * (комната → стеллаж → секция → ярус → ячейка) или «без ячейки» → запись
 * появляется в списке и переживает выход со страницы (Zustand) → раскрыть →
 * добавить несколько фото → задать имя пакета (или оставить пустым для
 * автоимени) → «Отправить в OCR» → очередь со статусами → SENT.
 */
import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    LinearProgress,
    Paper,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import AddPhotoAlternateIcon from "@mui/icons-material/AddPhotoAlternate";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import StopIcon from "@mui/icons-material/Stop";
import GridOnIcon from "@mui/icons-material/GridOn";

import CellCascadePicker, { type CellPick } from "../components/ocr/CellCascadePicker";
import { useOcrSessionLocal } from "../hooks/useOcrSessionLocal";
import { useOcrSessionStore, type SessionPhoto } from "../stores/ocrSessionStore";
import { displayBatchName } from "../utils/batchName";
import { STATUS_LABELS, formatBytes } from "../utils/uploadQueue";

const STATUS_COLOR: Record<string, "default" | "info" | "success" | "warning" | "error"> = {
    queued: "default",
    uploading: "info",
    recognizing: "warning",
    done: "success",
    error: "error",
    canceled: "default",
};

export default function OcrSessionPage() {
    const navigate = useNavigate();
    const session = useOcrSessionLocal();
    const addRecord = useOcrSessionStore((s) => s.addRecord);
    const removeRecord = useOcrSessionStore((s) => s.removeRecord);
    const addPhotos = useOcrSessionStore((s) => s.addPhotos);
    const removePhoto = useOcrSessionStore((s) => s.removePhoto);
    const clearAll = useOcrSessionStore((s) => s.clearAll);
    const batchName = useOcrSessionStore((s) => s.batchName);
    const setBatchName = useOcrSessionStore((s) => s.setBatchName);

    const [pickerOpen, setPickerOpen] = useState(false);
    const [noCell, setNoCell] = useState(false);
    const [pick, setPick] = useState<CellPick>({ cellId: null, cellLabel: "Ячейка не выбрана" });
    const [expanded, setExpanded] = useState<string | false>(false);

    const onPick = useCallback((p: CellPick) => setPick(p), []);

    const confirmAdd = () => {
        const id = noCell ? addRecord(null, "Без ячейки") : addRecord(pick.cellId, pick.cellLabel);
        setPickerOpen(false);
        setExpanded(id);
        setPick({ cellId: null, cellLabel: "Ячейка не выбрана" });
    };

    const total = session.totalCount || session.queuedCount + session.doneCount + session.failedCount;

    return (
        <Box sx={{ p: 2, maxWidth: 1100, mx: "auto" }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 2, flexWrap: "wrap" }}>
                <Typography variant="h5" sx={{ flexGrow: 1 }}>
                    Сессия оцифровки
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setPickerOpen(true)}>
                    Добавить ячейку
                </Button>
                <Button variant="outlined" startIcon={<Inventory2Icon />} onClick={() => navigate("/ocr/batches")}>
                    Пакеты OCR
                </Button>
            </Stack>

            <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
                <TextField
                    fullWidth
                    size="small"
                    label="Имя пакета (необязательно)"
                    placeholder="Пусто — сервер поставит автоимя «адрес ячейки + дата»"
                    value={batchName ?? ""}
                    onChange={(e) => setBatchName(e.target.value || null)}
                    helperText={
                        session.batchId !== null
                            ? `Пакет уже создан: ${displayBatchName(batchName, session.batchId)}. Имя уйдёт в следующий пакет.`
                            : "Имя отправится с первым фото сессии."
                    }
                />
            </Paper>

            {session.records.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: "center" }} variant="outlined">
                    <GridOnIcon sx={{ fontSize: 56, color: "text.disabled" }} />
                    <Typography sx={{ mt: 1, fontWeight: 600 }}>Сессия пуста</Typography>
                    <Typography variant="body2" color="text.secondary">
                        Нажми «Добавить ячейку», пройди комнату → стеллаж → секцию → ярус → ячейку
                        (или отметь «без ячейки») — появится запись, в которую можно добавить фото.
                        Сессия не теряется при переходе на другие страницы.
                    </Typography>
                </Paper>
            ) : (
                <Stack spacing={1}>
                    {session.records.map((rec) => (
                        <Accordion
                            key={rec.id}
                            expanded={expanded === rec.id}
                            onChange={(_, open) => setExpanded(open ? rec.id : false)}
                        >
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                                    <Typography sx={{ fontWeight: 600 }}>{rec.cellLabel}</Typography>
                                    <Chip size="small" label={`фото: ${rec.photos.length}`} />
                                    <Chip size="small" color="success" label={`готово: ${rec.photos.filter((p) => p.status === "done").length}`} />
                                    {rec.photos.some((p) => p.status === "error") && (
                                        <Chip size="small" color="error" label="есть ошибки" />
                                    )}
                                </Stack>
                            </AccordionSummary>
                            <AccordionDetails>
                                <RecordPhotos
                                    photos={rec.photos}
                                    onAdd={(files) => addPhotos(rec.id, files)}
                                    onRemove={(photoId) => removePhoto(rec.id, photoId)}
                                    onDeleteRecord={() => removeRecord(rec.id)}
                                />
                            </AccordionDetails>
                        </Accordion>
                    ))}
                </Stack>
            )}

            {session.records.length > 0 && (
                <Paper sx={{ p: 2, mt: 2 }} variant="outlined">
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap", mb: 1 }}>
                        <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                            Отправка: {session.sentCount}/{total}
                        </Typography>
                        {session.batchId !== null && (
                            <Chip
                                icon={<Inventory2Icon />}
                                label={displayBatchName(batchName, session.batchId)}
                                color="primary"
                                onClick={() => navigate(`/ocr/batches/${session.batchId}`)}
                            />
                        )}
                    </Stack>
                    <LinearProgress
                        variant="determinate"
                        value={total > 0 ? Math.round((session.sentCount / total) * 100) : 0}
                        sx={{ mb: 1.5, height: 8, borderRadius: 4 }}
                    />
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                        <Button
                            variant="contained"
                            color="success"
                            startIcon={<CloudUploadIcon />}
                            disabled={session.sending || session.queuedCount + session.failedCount === 0}
                            onClick={session.start}
                        >
                            {session.sending ? "Отправляем…" : "Отправить в OCR"}
                        </Button>
                        <Button variant="outlined" color="warning" startIcon={<StopIcon />} disabled={!session.sending} onClick={session.stop}>
                            Остановить после текущего
                        </Button>
                        <Button color="error" startIcon={<DeleteIcon />} disabled={session.sending} onClick={clearAll}>
                            Очистить сессию
                        </Button>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Первое фото создаёт пакет (с именем сессии или автоименем), остальные идут
                        в него же с cell_id своей записи; после отправки пакет переводится в SENT.
                    </Typography>
                </Paper>
            )}

            <Dialog open={pickerOpen} onClose={() => setPickerOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Выбор ячейки сессии</DialogTitle>
                <DialogContent dividers>
                    <Stack spacing={2}>
                        <CellCascadePicker onPick={onPick} />
                        <FormControlLabel
                            control={<Checkbox checked={noCell} onChange={(e) => setNoCell(e.target.checked)} />}
                            label="Без привязки к ячейке"
                        />
                        <Alert severity="info">
                            Будет создана запись: <b>{noCell ? "Без ячейки" : pick.cellLabel}</b>.
                            В неё можно добавить несколько фото и отправить всю сессию.
                        </Alert>
                    </Stack>
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={() => setPickerOpen(false)}>Отмена</Button>
                    <Button variant="contained" disabled={!noCell && pick.cellId === null} onClick={confirmAdd}>
                        Добавить в сессию
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

function RecordPhotos({
    photos,
    onAdd,
    onRemove,
    onDeleteRecord,
}: {
    photos: SessionPhoto[];
    onAdd: (files: File[]) => void;
    onRemove: (photoId: string) => void;
    onDeleteRecord: () => void;
}) {
    const inputRef = useRef<HTMLInputElement | null>(null);
    return (
        <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button size="small" variant="outlined" startIcon={<AddPhotoAlternateIcon />} onClick={() => inputRef.current?.click()}>
                    Добавить фото
                </Button>
                <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDeleteRecord}>
                    Удалить запись
                </Button>
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    hidden
                    onChange={(e) => {
                        onAdd(Array.from(e.target.files ?? []));
                        e.target.value = "";
                    }}
                />
            </Stack>
            {photos.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                    Фото пока нет — добавь одно или несколько.
                </Typography>
            ) : (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
                    {photos.map((p) => (
                        <Paper key={p.id} variant="outlined" sx={{ p: 1, width: 150 }}>
                            {p.preview && (
                                <Box component="img" src={p.preview} alt={p.name}
                                    sx={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 1, mb: 0.5 }} />
                            )}
                            <Typography variant="caption" sx={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">{formatBytes(p.size)}</Typography>
                            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", mt: 0.5 }}>
                                <Chip size="small" color={STATUS_COLOR[p.status]} label={STATUS_LABELS[p.status]} />
                                <Button size="small" color="error" onClick={() => onRemove(p.id)}>✕</Button>
                            </Stack>
                            {p.status === "uploading" && <LinearProgress variant="determinate" value={p.progress} sx={{ mt: 0.5, height: 4 }} />}
                            {p.status === "recognizing" && <LinearProgress sx={{ mt: 0.5, height: 4 }} />}
                            {p.error && <Typography variant="caption" color="error.main">{p.error}</Typography>}
                        </Paper>
                    ))}
                </Box>
            )}
        </Stack>
    );
}