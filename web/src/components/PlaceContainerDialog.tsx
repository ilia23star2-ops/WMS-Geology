/**
 * Диалог размещения тар (2f-10a).
 * Позволяет разместить в ячейку (через поддон) или на пол в комнате.
 */
import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    FormLabel,
    InputLabel,
    MenuItem,
    Radio,
    RadioGroup,
    Select,
    Stack,
    Typography,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";

import {
    apiClient,
    useCells,
    useRacks,
    useRooms,
    useSections,
    useTiers,
    type Cell,
} from "../api";

interface PlaceContainerDialogProps {
    open: boolean;
    containerIds: number[];
    onClose: () => void;
    onSuccess: (message: string) => void;
}

type PlaceMode = "cell" | "floor";

export default function PlaceContainerDialog({
    open,
    containerIds,
    onClose,
    onSuccess,
}: PlaceContainerDialogProps) {
    const queryClient = useQueryClient();
    const [mode, setMode] = useState<PlaceMode>("cell");

    // Для ячейки
    const [roomId, setRoomId] = useState<number | "">("");
    const [rackId, setRackId] = useState<number | "">("");
    const [sectionId, setSectionId] = useState<number | "">("");
    const [tierId, setTierId] = useState<number | "">("");
    const [cellId, setCellId] = useState<number | "">("");

    // Для пола
    const [floorRoomId, setFloorRoomId] = useState<number | "">("");

    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const rooms = useRooms();
    const racks = useRacks(roomId === "" ? null : roomId);
    const sections = useSections(rackId === "" ? null : rackId);
    const tiers = useTiers(sectionId === "" ? null : sectionId);
    const cells = useCells(tierId === "" ? null : tierId);

    function reset() {
        setMode("cell");
        setRoomId(""); setRackId(""); setSectionId(""); setTierId(""); setCellId("");
        setFloorRoomId("");
        setError(null);
    }

    function handleClose() {
        if (isSubmitting) return;
        reset();
        onClose();
    }

    async function handleSubmit() {
        if (mode === "cell" && cellId === "") {
            setError("Выберите ячейку.");
            return;
        }
        if (mode === "floor" && floorRoomId === "") {
            setError("Выберите комнату.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const payload = mode === "cell"
                ? { container_ids: containerIds, cell_id: cellId }
                : { container_ids: containerIds, floor_room_id: floorRoomId };

            const { data } = await apiClient.post("/storage/containers/bulk-place/", payload);

            queryClient.invalidateQueries({ queryKey: ["containers"] });
            queryClient.invalidateQueries({ queryKey: ["topology"] });
            queryClient.invalidateQueries({ queryKey: ["samples"] });

            onSuccess(data.message || "Тары успешно размещены.");
            reset();
            onClose();
        } catch (err) {
            const anyErr = err as any;
            const msg = anyErr?.response?.data?.error ?? "Не удалось разместить тары.";
            setError(msg);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!open) return null;

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Разместить тары</DialogTitle>
            <DialogContent>
                <Typography variant="body2" sx={{ mb: 2 }}>
                    Выбрано тар: <b>{containerIds.length}</b>.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <FormControl component="fieldset" sx={{ mb: 2 }}>
                    <FormLabel component="legend">Куда разместить?</FormLabel>
                    <RadioGroup
                        row
                        value={mode}
                        onChange={(e) => setMode(e.target.value as PlaceMode)}
                    >
                        <FormControlLabel value="cell" control={<Radio />} label="В ячейку (на поддон)" />
                        <FormControlLabel value="floor" control={<Radio />} label="На пол в комнате" />
                    </RadioGroup>
                </FormControl>

                {mode === "cell" ? (
                    <Stack spacing={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Комната</InputLabel>
                            <Select
                                label="Комната"
                                value={roomId}
                                onChange={(e) => {
                                    setRoomId(e.target.value as number);
                                    setRackId(""); setSectionId(""); setTierId(""); setCellId("");
                                }}
                            >
                                {(rooms.data ?? []).map((r) => (
                                    <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small" disabled={roomId === ""}>
                            <InputLabel>Стеллаж</InputLabel>
                            <Select
                                label="Стеллаж"
                                value={rackId}
                                onChange={(e) => {
                                    setRackId(e.target.value as number);
                                    setSectionId(""); setTierId(""); setCellId("");
                                }}
                            >
                                {(racks.data ?? []).map((r) => (
                                    <MenuItem key={r.id} value={r.id}>{r.code}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small" disabled={rackId === ""}>
                            <InputLabel>Секция</InputLabel>
                            <Select
                                label="Секция"
                                value={sectionId}
                                onChange={(e) => {
                                    setSectionId(e.target.value as number);
                                    setTierId(""); setCellId("");
                                }}
                            >
                                {(sections.data ?? []).map((s) => (
                                    <MenuItem key={s.id} value={s.id}>{s.code}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small" disabled={sectionId === ""}>
                            <InputLabel>Ярус</InputLabel>
                            <Select
                                label="Ярус"
                                value={tierId}
                                onChange={(e) => {
                                    setTierId(e.target.value as number);
                                    setCellId("");
                                }}
                            >
                                {(tiers.data ?? []).map((t) => (
                                    <MenuItem key={t.id} value={t.id}>Ярус {t.code}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth size="small" disabled={tierId === ""}>
                            <InputLabel>Ячейка</InputLabel>
                            <Select
                                label="Ячейка"
                                value={cellId}
                                onChange={(e) => setCellId(e.target.value as number)}
                            >
                                {(cells.data ?? []).map((c: Cell) => (
                                    <MenuItem key={c.id} value={c.id}>
                                        {c.full_address} ({c.cell_type === "CORE" ? "Керн" : "Обычная"})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                ) : (
                    <Box>
                        <FormControl fullWidth size="small">
                            <InputLabel>Комната (на пол)</InputLabel>
                            <Select
                                label="Комната (на пол)"
                                value={floorRoomId}
                                onChange={(e) => setFloorRoomId(e.target.value as number)}
                            >
                                {(rooms.data ?? []).map((r) => (
                                    <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={isSubmitting}>Отмена</Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting}
                >
                    {isSubmitting ? "Размещаем..." : "Разместить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}