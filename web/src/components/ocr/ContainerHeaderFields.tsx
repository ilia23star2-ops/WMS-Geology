/**
 * Шапка тары: участок, тип исследования, Н/З текущий и входящий, тип тары,
 * номер тары (вынесено из OcrReviewPage, 6e-2-web-fix5).
 * fix7: подсказки готовности показываются inline под каждым полем —
 * расхождение номера с фото видно сразу, без прокрутки к итоговому блоку.
 */
import type { ReactNode } from "react";
import { Box, TextField, Typography } from "@mui/material";

import SmartAutocomplete from "../SmartAutocomplete";
import type { ReadinessItem } from "../../utils/ocrReadiness";

const ERROR_COLOR = "#C62828";
const WARNING_COLOR = "#EF6C00";
const OK_COLOR = "#2E7D32";

export default function ContainerHeaderFields({
    siteName,
    onSiteNameChange,
    researchTypeName,
    onResearchTypeNameChange,
    workOrderCoded,
    onWorkOrderCodedChange,
    workOrderIncoming,
    onWorkOrderIncomingChange,
    containerTypeName,
    onContainerTypeNameChange,
    containerNumber,
    onContainerNumberChange,
    siteOptions,
    sitesLoading,
    researchTypeOptions,
    researchTypesLoading,
    containerTypeOptions,
    containerTypesLoading,
    workOrderOptions,
    workOrderIncomingOptions,
    suggestionsLoading,
    siteId,
    researchTypeId,
    activeField,
    issues,
    onFocusField,
    onBlurField,
}: {
    siteName: string;
    onSiteNameChange: (value: string) => void;
    researchTypeName: string;
    onResearchTypeNameChange: (value: string) => void;
    workOrderCoded: string;
    onWorkOrderCodedChange: (value: string) => void;
    workOrderIncoming: string;
    onWorkOrderIncomingChange: (value: string) => void;
    containerTypeName: string;
    onContainerTypeNameChange: (value: string) => void;
    containerNumber: string;
    onContainerNumberChange: (value: string) => void;
    siteOptions: string[];
    sitesLoading: boolean;
    researchTypeOptions: string[];
    researchTypesLoading: boolean;
    containerTypeOptions: string[];
    containerTypesLoading: boolean;
    workOrderOptions: string[];
    workOrderIncomingOptions: string[];
    suggestionsLoading: boolean;
    siteId: number | null;
    researchTypeId: number | null;
    activeField: string | null;
    issues: Record<string, ReadinessItem>;
    onFocusField: (name: string) => void;
    onBlurField: () => void;
}) {
    const fieldSx = (name: string) => ({
        bgcolor: activeField === name ? "rgba(255, 152, 0, 0.1)" : "transparent",
        transition: "background-color 200ms",
        borderRadius: 1,
    });

    /** Проблема пункта готовности → цветная подсказка под полем. */
    const problem = (key: string): ReactNode | null => {
        const it = issues[key];
        if (!it || it.ok) return null;
        const color = it.required ? ERROR_COLOR : WARNING_COLOR;
        return (
            <span style={{ color }}>
                {it.required ? "✗ " : "⚠ "}
                {it.hint}
            </span>
        );
    };

    const isBad = (key: string): boolean => {
        const it = issues[key];
        return !!it && !it.ok && it.required;
    };

    const okHint = (text: string): ReactNode => (
        <span style={{ color: OK_COLOR }}>✓ {text}</span>
    );

    const cnProblem = problem("container_number");
    const photoProblem = problem("container_number_photo");
    const photoItem = issues.container_number_photo;

    return (
        <>
            <Typography variant="subtitle1">Шапка тары</Typography>

            <Box sx={fieldSx("site")} onFocus={() => onFocusField("site")} onBlur={onBlurField}>
                <SmartAutocomplete
                    label="Участок"
                    value={siteName}
                    onChange={onSiteNameChange}
                    options={siteOptions}
                    loading={sitesLoading}
                    helperText={problem("site")}
                />
            </Box>

            <Box sx={fieldSx("research_type")} onFocus={() => onFocusField("research_type")} onBlur={onBlurField}>
                <SmartAutocomplete
                    label="Тип исследования"
                    value={researchTypeName}
                    onChange={onResearchTypeNameChange}
                    options={researchTypeOptions}
                    loading={researchTypesLoading}
                    required
                    error={isBad("research_type")}
                    helperText={problem("research_type")}
                />
            </Box>

            <Box sx={fieldSx("work_order_coded")} onFocus={() => onFocusField("work_order_coded")} onBlur={onBlurField}>
                <SmartAutocomplete
                    label="Н/З (текущий)"
                    value={workOrderCoded}
                    onChange={onWorkOrderCodedChange}
                    options={workOrderOptions}
                    loading={suggestionsLoading}
                    required
                    error={isBad("work_order_coded")}
                    helperText={
                        problem("work_order_coded") ??
                        (siteId === null && researchTypeId === null
                            ? "Выбери участок или ТИ — появятся подсказки"
                            : workOrderOptions.length
                                ? `Подсказок: ${workOrderOptions.length}`
                                : "Подсказок нет — введи вручную")
                    }
                />
            </Box>

            <Box sx={fieldSx("work_order_incoming")} onFocus={() => onFocusField("work_order_incoming")} onBlur={onBlurField}>
                <SmartAutocomplete
                    label="Н/З (входящий)"
                    value={workOrderIncoming}
                    onChange={onWorkOrderIncomingChange}
                    options={workOrderIncomingOptions}
                    loading={suggestionsLoading}
                    helperText={
                        workOrderIncoming.trim() !== ""
                            ? "Заполнено — пробы считаются шифрованными (без скважины)"
                            : "Не заполнено — проба нешифрованная (скважина = middle)"
                    }
                />
            </Box>

            <Box sx={fieldSx("container_type")} onFocus={() => onFocusField("container_type")} onBlur={onBlurField}>
                <SmartAutocomplete
                    label="Тип тары"
                    value={containerTypeName}
                    onChange={onContainerTypeNameChange}
                    options={containerTypeOptions}
                    loading={containerTypesLoading}
                    required
                    error={isBad("container_type")}
                    helperText={problem("container_type")}
                />
            </Box>

            <Box sx={fieldSx("container_number")} onFocus={() => onFocusField("container_number")} onBlur={onBlurField}>
                <TextField
                    label="Номер тары"
                    value={containerNumber}
                    onChange={(e) => onContainerNumberChange(e.target.value)}
                    fullWidth
                    size="small"
                    required
                    error={isBad("container_number")}
                    helperText={
                        cnProblem ??
                        photoProblem ??
                        (photoItem && photoItem.ok ? okHint("совпадает с фото") : undefined)
                    }
                />
            </Box>
        </>
    );
}