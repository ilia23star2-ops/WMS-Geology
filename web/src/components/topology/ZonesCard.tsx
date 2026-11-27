/**
 * Карточка «Зоны» напольного хранения (zones-web).
 * Комната → зона → схема (ряды по ориентации, места со счётчиком).
 */
import { useState } from "react";
import {
    Card,
    CardContent,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { apiClient } from "../../api/client";
import type { Room } from "../../api/topology";
import { useZones, useZoneScheme } from "../../api/zones";
import ZoneScheme from "./ZoneScheme";

export default function ZonesCard() {
    const [roomId, setRoomId] = useState<number | "">("");
    const [zoneId, setZoneId] = useState<number | "">("");

    const rooms = useQuery({
        queryKey: ["rooms"],
        queryFn: async () => {
            const { data } = await apiClient.get<Room[] | { results: Room[] }>(
                "/storage/rooms/",
            );
            return Array.isArray(data) ? data : data.results;
        },
    });
    const zones = useZones();
    const scheme = useZoneScheme(zoneId === "" ? null : zoneId);

    const roomZones = (zones.data ?? []).filter((z) => z.room === roomId);

    return (
        <Card>
            <CardContent>
                <Typography variant="h3" component="h2" sx={{ mb: 2 }}>
                    Зоны напольного хранения
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mb: 2, flexWrap: "wrap", rowGap: 2 }}>
                    <TextField
                        select
                        label="Комната"
                        value={roomId}
                        sx={{ minWidth: 180 }}
                        onChange={(e) => {
                            setRoomId(e.target.value === "" ? "" : Number(e.target.value));
                            setZoneId("");
                        }}
                    >
                        {(rooms.data ?? []).map((r) => (
                            <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>
                        ))}
                    </TextField>
                    <TextField
                        select
                        label="Зона"
                        value={zoneId}
                        sx={{ minWidth: 180 }}
                        onChange={(e) => setZoneId(e.target.value === "" ? "" : Number(e.target.value))}
                    >
                        {roomZones.map((z) => (
                            <MenuItem key={z.id} value={z.id}>{z.code}</MenuItem>
                        ))}
                    </TextField>
                </Stack>
                {scheme.isLoading ? (
                    <Typography color="text.secondary">Загрузка схемы…</Typography>
                ) : scheme.data ? (
                    <ZoneScheme scheme={scheme.data} />
                ) : (
                    <Typography color="text.secondary">Выберите комнату и зону.</Typography>
                )}
            </CardContent>
        </Card>
    );
}