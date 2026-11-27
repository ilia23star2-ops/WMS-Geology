/**
 * Схема зоны напольного хранения (zones-web).
 * Ряды — полосами по ориентации; места — квадраты со счётчиком стопки.
 */
import { Box, Stack, Typography } from "@mui/material";

import type { ZoneScheme as ZoneSchemeType } from "../../api/zones";
import { placeTone, rowIsVertical, schemeTotal } from "../../utils/zoneScheme";

const TONE_COLORS = { empty: "#BDBDBD", filled: "#2EB84C" } as const;

export default function ZoneScheme({ scheme }: { scheme: ZoneSchemeType }) {
    const allPlaces = scheme.rows.flatMap((r) => r.places);
    return (
        <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
                {`Тары в зоне: ${schemeTotal(allPlaces)}`}
            </Typography>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 2 }}>
                {scheme.rows.map((row) => (
                    <Box key={row.id}>
                        <Typography variant="subtitle2">{`Ряд ${row.code}`}</Typography>
                        <Stack
                            direction={rowIsVertical(row.orientation) ? "column" : "row"}
                            spacing={0.75}
                            sx={{ mt: 0.5 }}
                        >
                            {row.places.map((p) => (
                                <Box
                                    key={p.id}
                                    title={`Место ${p.code}: ${p.count} тар`}
                                    sx={{
                                        width: 26,
                                        height: 26,
                                        borderRadius: 1,
                                        bgcolor: TONE_COLORS[placeTone(p.count)],
                                        color: "#fff",
                                        fontSize: 12,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    {p.count > 0 ? p.count : ""}
                                </Box>
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Stack>
        </Stack>
    );
}