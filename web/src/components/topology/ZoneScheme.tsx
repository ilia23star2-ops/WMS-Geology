/**
 * Схема зоны напольного хранения (zones-web + zones-web-crud).
 * Ряды — полосами по ориентации; места — квадраты со счётчиком стопки.
 * Кнопки «+ ряд» и «+ место» — создание через ZoneEntityDialog.
 */
import { Box, Button, Stack, Typography } from "@mui/material";

import type { ZoneScheme as ZoneSchemeType } from "../../api/zones";
import { placeTone, rowIsVertical, schemeTotal } from "../../utils/zoneScheme";

const TONE_COLORS = { empty: "#BDBDBD", filled: "#2EB84C" } as const;

export default function ZoneScheme({
    scheme,
    onCreateRow,
    onCreatePlace,
}: {
    scheme: ZoneSchemeType;
    onCreateRow?: () => void;
    onCreatePlace?: (rowId: number) => void;
}) {
    const allPlaces = scheme.rows.flatMap((r) => r.places);
    return (
        <Stack spacing={1.5}>
            <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
                <Typography variant="body2" color="text.secondary">
                    {`Тары в зоне: ${schemeTotal(allPlaces)}`}
                </Typography>
                {onCreateRow && (
                    <Button size="small" onClick={onCreateRow}>+ ряд</Button>
                )}
            </Stack>
            <Stack direction="row" spacing={2} sx={{ flexWrap: "wrap", rowGap: 2 }}>
                {scheme.rows.map((row) => (
                    <Box key={row.id}>
                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                            <Typography variant="subtitle2">{`Ряд ${row.code}`}</Typography>
                            {onCreatePlace && (
                                <Button size="small" onClick={() => onCreatePlace(row.id)}>+ место</Button>
                            )}
                        </Stack>
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