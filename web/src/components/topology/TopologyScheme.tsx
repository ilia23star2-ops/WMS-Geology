/**
 * Интерактивная схема стеллажа/секции (topology-scheme).
 * Строки = ярусы (D→A), колонки = ячейки (1..N); цвет = заполненность
 * (серый/зелёный/жёлтый/красный), текущая ячейка в синей рамке.
 * Клик по квадрату = выбрать ячейку (переход к её ярусу/карточке).
 * Группы = секции (для схемы всего стеллажа).
 */
import { Box, Stack, Typography } from "@mui/material";
import type { Cell } from "../../api";
import { occupancyColor, OCCUPANCY_COLORS } from "../../utils/cellOrder";
import type { SchemeRow } from "../../utils/schemeRows";

export interface SchemeGroup {
    label: string;
    rows: SchemeRow[];
}

export default function TopologyScheme({
    groups,
    currentCellId,
    onPickCell,
}: {
    groups: SchemeGroup[];
    currentCellId: number | null;
    onPickCell: (cell: Cell) => void;
}) {
    return (
        <Stack direction="row" spacing={3} sx={{ flexWrap: "wrap", columnGap: 3, rowGap: 2 }}>
            {groups.map((g, gi) => (
                <Box key={g.label || `group-${gi}`}>
                    {g.label && (
                        <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                            {g.label}
                        </Typography>
                    )}
                    <Stack spacing={0.75}>
                        {g.rows.map((row) => (
                            <Stack key={row.tierId} direction="row" spacing={0.75} sx={{ alignItems: "center" }}>
                                <Typography variant="body2" color="text.secondary" sx={{ width: 28 }}>
                                    {row.label}
                                </Typography>
                                {row.cells.map((c) => (
                                    <Box
                                        key={c.id}
                                        onClick={() => onPickCell(c)}
                                        title={`Ячейка ${c.code}: ${c.containers_count} тар (клик — открыть)`}
                                        sx={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: 1,
                                            cursor: "pointer",
                                            bgcolor: OCCUPANCY_COLORS[occupancyColor(c.containers_count)],
                                            border: c.id === currentCellId ? "2px solid" : "2px solid transparent",
                                            borderColor: c.id === currentCellId ? "primary.main" : "transparent",
                                            "&:hover": { opacity: 0.85 },
                                        }}
                                    />
                                ))}
                            </Stack>
                        ))}
                    </Stack>
                </Box>
            ))}
        </Stack>
    );
}