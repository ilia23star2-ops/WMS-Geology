/**
 * Универсальный Autocomplete с режимом freeSolo и фильтрацией по вхождению.
 *
 * MUI v9: у `AutocompleteRenderInputParams` нет `InputProps`/`inputProps`.
 * Loading indicator вынесен под поле, чтобы не лезть в пропсы TextField.
 *
 * c-2.x-smart-input-bundle-2: `appendOnSelect` — при выборе подсказки
 * автоматически дописывается символ (например, "-"), чтобы пользователь
 * сразу ввёл диапазон (TAA-A34076001-031). При ручном вводе не добавляется.
 */
import { Autocomplete, TextField, Typography } from "@mui/material";
import React from "react";

interface SmartAutocompleteProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    loading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    required?: boolean;
    error?: boolean;
    helperText?: React.ReactNode;
    onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
    appendOnSelect?: string;
}

export default function SmartAutocomplete({
    label,
    value,
    onChange,
    options,
    loading = false,
    disabled = false,
    placeholder,
    required,
    error,
    helperText,
    onKeyDown,
    appendOnSelect,
}: SmartAutocompleteProps) {
    return (
        <>
            <Autocomplete
                freeSolo
                options={options}
                loading={loading}
                disabled={disabled}
                value={value}
                onChange={(_, newValue) => {
                    // onChange вызывается только при выборе подсказки (клик/Enter на опции).
                    if (
                        typeof newValue === "string" &&
                        appendOnSelect &&
                        !newValue.endsWith(appendOnSelect)
                    ) {
                        onChange(newValue + appendOnSelect);
                    } else {
                        onChange(newValue || "");
                    }
                }}
                onInputChange={(_, newInputValue) => {
                    // Свободный ввод — без appendOnSelect.
                    onChange(newInputValue);
                }}
                filterOptions={(opts, { inputValue }) => {
                    const filtered = opts.filter((option) =>
                        option.toLowerCase().includes(inputValue.toLowerCase()),
                    );
                    if (inputValue && !filtered.includes(inputValue)) {
                        return [...filtered, inputValue];
                    }
                    return filtered;
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        placeholder={placeholder}
                        required={required}
                        size="small"
                        fullWidth
                        error={error}
                        helperText={helperText}
                        onKeyDown={onKeyDown}
                    />
                )}
            />
            {loading && (
                <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5, ml: 1.5 }}
                >
                    Загрузка подсказок…
                </Typography>
            )}
        </>
    );
}