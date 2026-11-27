/**
 * Сетка стопки ряда зоны (zones-stack-ui).
 * Стопки (места) — колонки, ярусы — строки снизу вверх.
 * Клетка = одна тара: подпись Н/З · ТИ · номер; «+» на вершине стопки.
 */
import { Box, Stack, Typography } from "@mui/material";

import { stackGridRows } from "../../utils/zoneScheme";
import type { StackRowInput } from "../../utils/zoneScheme";

const CELL_W = 132;

export default function RowStackGrid({ row }: { row: StackRowInput }) {
    const lines = stackGridRows(row);
    if (lines.length === 0) {
        return <Typography color="text.secondary">В ряду пока нет мест.</Typography>;
    }
    return (
        <Stack spacing={0.75}>
            {lines.map((line) => (
                <Stack
                    key={line.level}
                    direction="row"
                    spacing={0.75}
                    sx={{ alignItems: "center" }}
                >
                    <Box sx={{ width: 64, fontSize: 12, color: "text.secondary" }}>
                        {`Ярус ${line.level} · ${line.count}`}
                    </Box>
                    {line.cells.map((cell) => (
                        <Box
                            key={cell.placeId}
                            title={
                                cell.container
                                    ? `Место ${cell.placeCode}, ярус ${cell.level}`
                                    : `Место ${cell.placeCode}: пусто`
                            }
                            sx={{
                                width: CELL_W,
                                height: 34,
                                borderRadius: 1,
                                bgcolor: cell.container
                                    ? "#2EB84C"
                                    : cell.isNext ? "#E3F2FD" : "#BDBDBD",
                                color: cell.container ? "#fff" : "text.secondary",
                                fontSize: 11,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                px: 0.5,
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {cell.container
                                ? `${cell.container.nz || "Без Н/З"} · ${cell.container.research || "Без ТИ"} · ${cell.container.number ?? ""}`
                                : cell.isNext ? "+" : ""}
                        </Box>
                    ))}
                </Stack>
            ))}
            <Stack direction="row" spacing={0.75}>
                <Box sx={{ width: 64 }} />
                {row.places.map((p) => (
                    <Box
                        key={p.id}
                        sx={{
                            width: CELL_W,
                            fontSize: 11,
                            color: "text.secondary",
                            textAlign: "center",
                        }}
                    >
                        {`Место ${p.code}`}
                    </Box>
                ))}
            </Stack>
        </Stack>
    );
}