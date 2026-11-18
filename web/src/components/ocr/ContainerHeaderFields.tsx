/**
 * Шапка тары: участок, тип исследования, Н/З текущий и входящий, тип тары,
 * номер тары (вынесено из OcrReviewPage, 6e-2-web-fix5).
 * Подсветка активного поля и фокус-обработчики — как на странице;
 * значения, options/loading и сеттеры передаются пропсами.
 */
import { Box, TextField, Typography } from "@mui/material";

import SmartAutocomplete from "../SmartAutocomplete";

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
    onFocusField: (name: string) => void;
    onBlurField: () => void;
}) {
    const fieldSx = (name: string) => ({
        bgcolor: activeField === name ? "rgba(255, 152, 0, 0.1)" : "transparent",
        transition: "background-color 200ms",
        borderRadius: 1,
    });

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
                    helperText={
                        siteId === null && researchTypeId === null
                            ? "Выбери участок или ТИ — появятся подсказки"
                            : workOrderOptions.length
                                ? `Подсказок: ${workOrderOptions.length}`
                                : "Подсказок нет — введи вручную"
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

            <Box sx={fieldSx("container_type")}>
                <SmartAutocomplete
                    label="Тип тары"
                    value={containerTypeName}
                    onChange={onContainerTypeNameChange}
                    options={containerTypeOptions}
                    loading={containerTypesLoading}
                    required
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
                    error={containerNumber.trim() === ""}
                    helperText={
                        containerNumber.trim() === ""
                            ? "Обязательно — например 1 или T-001"
                            : undefined
                    }
                />
            </Box>
        </>
    );
}
