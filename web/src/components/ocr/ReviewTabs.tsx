/**
 * Вкладки экрана проверки OCR (вынесено из OcrReviewPage, 6e-2-web-2).
 * Бейджи показывают число проблем: жёлтый — замечания, красный — дубли.
 */
import { Chip, Stack, Tab, Tabs } from "@mui/material";

export type ReviewTab = "header" | "samples";

export default function ReviewTabs({
    value,
    onChange,
    rangesCount,
    headerProblems,
    sampleProblems,
    hasDuplicates,
}: {
    value: ReviewTab;
    onChange: (tab: ReviewTab) => void;
    rangesCount: number;
    headerProblems: number;
    sampleProblems: number;
    hasDuplicates: boolean;
}) {
    return (
        <Tabs
            value={value}
            onChange={(_, v) => onChange(v)}
            sx={{ mb: 2, minHeight: 40 }}
            variant="fullWidth"
        >
            <Tab
                value="header"
                sx={{ minHeight: 40, textTransform: "none" }}
                label={
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <span>Шапка тары</span>
                        {headerProblems > 0 && (
                            <Chip
                                size="small"
                                color="warning"
                                label={headerProblems}
                                sx={{ height: 18, fontSize: 11 }}
                            />
                        )}
                    </Stack>
                }
            />
            <Tab
                value="samples"
                sx={{ minHeight: 40, textTransform: "none" }}
                label={
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                        <span>Пробы ({rangesCount})</span>
                        {sampleProblems > 0 && (
                            <Chip
                                size="small"
                                color={hasDuplicates ? "error" : "warning"}
                                label={sampleProblems}
                                sx={{ height: 18, fontSize: 11 }}
                            />
                        )}
                    </Stack>
                }
            />
        </Tabs>
    );
}