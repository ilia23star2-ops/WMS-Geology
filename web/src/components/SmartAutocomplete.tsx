/**
 * Универсальный Autocomplete с режимом freeSolo и фильтрацией по вхождению.
 * Используется для Н/З, ТИ, префиксов проб.
 */
import { Autocomplete, TextField } from "@mui/material";

interface SmartAutocompleteProps {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: string[];
    loading?: boolean;
    disabled?: boolean;
    placeholder?: string;
    required?: boolean;
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
}: SmartAutocompleteProps) {
    return (
        <Autocomplete
            freeSolo
            options={options}
            loading={loading}
            disabled={disabled}
            value={value}
            onChange={(_, newValue) => {
                onChange(newValue || "");
            }}
            onInputChange={(_, newInputValue) => {
                onChange(newInputValue);
            }}
            filterOptions={(opts, { inputValue }) => {
                // Сортировка и фильтрация: если пусто — показываем всё,
                // иначе ищем совпадения без учета регистра.
                const filtered = opts.filter((option) =>
                    option.toLowerCase().includes(inputValue.toLowerCase()),
                );
                // Если введенное значение уникально и его нет в списке, добавим его в конец
                if (
                    inputValue &&
                    !filtered.includes(inputValue)
                ) {
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
                    InputProps={{
                        ...params.InputProps,
                        endAdornment: (
                            <>
                                {loading ? <span style={{ marginRight: 8 }}>...</span> : null}
                                {params.InputProps.endAdornment}
                            </>
                        ),
                    }}
                />
            )}
        />
    );
}