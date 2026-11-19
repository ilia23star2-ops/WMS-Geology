/**
 * Поэтапный выбор ячейки (6e-3-web-c): комната → стеллаж → секция → ярус → ячейка.
 * Используются готовые хуки иерархии из api/topology; смена уровня сбрасывает
 * нижестоящие. Выход — cellId + человекочитаемый адрес.
 */
import { useEffect, useMemo, useState } from "react";
import { MenuItem, Stack, TextField, Typography } from "@mui/material";

import {
    useCells,
    useRacks,
    useRooms,
    useSections,
    useTiers,
} from "../../api/topology";

function optLabel(x: { id: number; name?: string | null; code?: string | null }): string {
    return x.name || x.code || `#${x.id}`;
}

export interface CellPick {
    cellId: number | null;
    cellLabel: string;
}

export default function CellCascadePicker({ onPick }: { onPick: (p: CellPick) => void }) {
    const [roomId, setRoomId] = useState<number | null>(null);
    const [rackId, setRackId] = useState<number | null>(null);
    const [sectionId, setSectionId] = useState<number | null>(null);
    const [tierId, setTierId] = useState<number | null>(null);
    const [cellId, setCellId] = useState<number | null>(null);

    const rooms = useRooms();
    const racks = useRacks(roomId);
    const sections = useSections(rackId);
    const tiers = useTiers(sectionId);
    const cells = useCells(tierId);

    useEffect(() => {
        setRackId(null);
        setSectionId(null);
        setTierId(null);
        setCellId(null);
    }, [roomId]);
    useEffect(() => {
        setSectionId(null);
        setTierId(null);
        setCellId(null);
    }, [rackId]);
    useEffect(() => {
        setTierId(null);
        setCellId(null);
    }, [sectionId]);
    useEffect(() => {
        setCellId(null);
    }, [tierId]);

    const cellLabel = useMemo(() => {
        const cell = (cells.data ?? []).find((c) => c.id === cellId);
        if (!cell) return "Ячейка не выбрана";
        return cell.full_address || optLabel(cell);
    }, [cells.data, cellId]);

    useEffect(() => {
        onPick({ cellId, cellLabel });
    }, [cellId, cellLabel, onPick]);

    const selectSx = {
        "& .MuiOutlinedInput-root": { bgcolor: "background.paper" },
    };

    return (
        <Stack spacing={1.5}>
            <TextField
                select size="small" label="Комната" value={roomId ?? ""}
                onChange={(e) => setRoomId(e.target.value === "" ? null : Number(e.target.value))}
                sx={selectSx}
            >
                {(rooms.data ?? []).map((r) => (
                    <MenuItem key={r.id} value={r.id}>{optLabel(r)}</MenuItem>
                ))}
            </TextField>
            <TextField
                select size="small" label="Стеллаж" value={rackId ?? ""} disabled={roomId === null}
                onChange={(e) => setRackId(e.target.value === "" ? null : Number(e.target.value))}
                sx={selectSx}
            >
                {(racks.data ?? []).map((r) => (
                    <MenuItem key={r.id} value={r.id}>{optLabel(r)}</MenuItem>
                ))}
            </TextField>
            <TextField
                select size="small" label="Секция" value={sectionId ?? ""} disabled={rackId === null}
                onChange={(e) => setSectionId(e.target.value === "" ? null : Number(e.target.value))}
                sx={selectSx}
            >
                {(sections.data ?? []).map((r) => (
                    <MenuItem key={r.id} value={r.id}>{optLabel(r)}</MenuItem>
                ))}
            </TextField>
            <TextField
                select size="small" label="Ярус" value={tierId ?? ""} disabled={sectionId === null}
                onChange={(e) => setTierId(e.target.value === "" ? null : Number(e.target.value))}
                sx={selectSx}
            >
                {(tiers.data ?? []).map((r) => (
                    <MenuItem key={r.id} value={r.id}>{optLabel(r)}</MenuItem>
                ))}
            </TextField>
            <TextField
                select size="small" label="Ячейка" value={cellId ?? ""} disabled={tierId === null}
                onChange={(e) => setCellId(e.target.value === "" ? null : Number(e.target.value))}
                sx={selectSx}
            >
                {(cells.data ?? []).map((r) => (
                    <MenuItem key={r.id} value={r.id}>{optLabel(r)}</MenuItem>
                ))}
            </TextField>
            <Typography variant="body2" color={cellId === null ? "text.secondary" : "success.main"}>
                {cellId === null ? "Выбери уровень за уровнем — адрес соберётся сам." : `Адрес: ${cellLabel}`}
            </Typography>
        </Stack>
    );
}