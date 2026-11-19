/**
 * Ввод диапазона проб: поле с подсказками + кнопка «Добавить».
 * Вынесено из OcrReviewPage (6e-2-web-fix5), поведение прежнее.
 */
import { Box, Button } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";

import SmartAutocomplete from "../SmartAutocomplete";

interface Props {
    value: string;
    onChange: (v: string) => void;
    options: string[];
    loading: boolean;
    error: string | null;
    onAdd: () => void;
    onFocus: () => void;
    onBlur: () => void;
}

export default function SampleInputBar({
    value,
    onChange,
    options,
    loading,
    error,
    onAdd,
    onFocus,
    onBlur,
}: Props) {
    return (
        <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Box sx={{ flexGrow: 1 }} onFocus={onFocus} onBlur={onBlur}>
                <SmartAutocomplete
                    label="Диапазон проб"
                    value={value}
                    onChange={onChange}
                    options={options}
                    loading={loading}
                    appendOnSelect="-"
                    error={Boolean(error)}
                    helperText={
                        error ??
                        "Выбери базу из подсказок (клик → «-») или введи вручную: TAA-A34076001-031"
                    }
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            onAdd();
                        }
                    }}
                />
            </Box>
            <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={onAdd}
                sx={{ whiteSpace: "nowrap", height: 40 }}
            >
                Добавить
            </Button>
        </Box>
    );
}