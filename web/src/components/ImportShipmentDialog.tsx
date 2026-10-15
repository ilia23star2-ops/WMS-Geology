/**
 * Диалог импорта рейса из Excel.
 *
 * Загружает файл, дату и опциональные параметры.
 * При статусе ERROR в ответе — не закрывает диалог, показывает ошибки
 * списком, сгруппированным по коду.
 * При успехе (APPLIED / PARSED) — вызывает onSuccess и закрывается.
 */
import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { AxiosError } from "axios";

import {
    useImportShipment,
    useLaboratories,
    type ImportShipmentResponse,
} from "../api";

interface ImportShipmentDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (result: ImportShipmentResponse) => void;
}

/**
 * Формат тела ошибки DRF / нашего backend.
 * `error` может быть строкой или объектом с `message`.
 */
interface BackendErrorBody {
    error?: string | { message?: string };
    message?: string;
    detail?: string;
    [key: string]: unknown;
}

/** Извлекает человекочитаемое сообщение из ошибки axios. */
function extractErrorMessage(err: AxiosError<BackendErrorBody>): string {
    const data = err.response?.data;

    if (!data) {
        return err.message || "Проверьте соединение.";
    }

    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error === "object" && data.error.message) {
        return data.error.message;
    }
    if (data.message) return data.message;
    if (data.detail) return data.detail;

    return JSON.stringify(data);
}

/** Группирует ошибки по коду и возвращает Map<код, ошибки>. */
function groupErrors(
    errors: {
        code?: string;
        error?: string;
        sheet?: string;
        row?: number;
        column?: number;
    }[],
) {
    const groups = new Map<string, typeof errors>();
    for (const e of errors) {
        const key = e.code ?? "OTHER";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(e);
    }
    return groups;
}

const ERROR_TITLES: Record<string, string> = {
    UNKNOWN_RESEARCH_TYPE: "Неизвестный тип исследования",
    MISSING_CONTAINER_TYPE: "Не указан тип тары",
};

function ErrorList({
    errors,
}: {
    errors: ImportShipmentResponse["parse_errors"];
}) {
    const groups = groupErrors(errors);

    return (
        <Box sx={{ maxHeight: 300, overflow: "auto" }}>
            {Array.from(groups.entries()).map(([code, items]) => (
                <Box key={code} sx={{ mb: 1.5 }}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                        {ERROR_TITLES[code] ?? code} ({items.length})
                    </Typography>
                    <Box
                        component="ul"
                        sx={{
                            m: 0,
                            pl: 2,
                            "& li": { mb: 0.25, fontSize: "0.85rem" },
                        }}
                    >
                        {items.map((e, i) => (
                            <li key={i}>
                                {e.sheet && `Лист «${e.sheet}»`}
                                {e.row !== undefined && `, строка ${e.row}`}
                                {e.column !== undefined &&
                                    `, колонка ${e.column}`}
                                {e.error ? ` — ${e.error}` : ""}
                            </li>
                        ))}
                    </Box>
                </Box>
            ))}
        </Box>
    );
}

export default function ImportShipmentDialog({
    open,
    onClose,
    onSuccess,
}: ImportShipmentDialogProps) {
    const [file, setFile] = useState<File | null>(null);
    const [targetDate, setTargetDate] = useState("");
    const [shipmentNumber, setShipmentNumber] = useState("");
    const [laboratoryId, setLaboratoryId] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [parseErrors, setParseErrors] = useState<
        ImportShipmentResponse["parse_errors"] | null
    >(null);

    const laboratories = useLaboratories();
    const importMutation = useImportShipment();

    function reset() {
        setFile(null);
        setTargetDate("");
        setShipmentNumber("");
        setLaboratoryId("");
        setError(null);
        setParseErrors(null);
    }

    function handleClose() {
        if (importMutation.isPending) return;
        reset();
        onClose();
    }

    async function handleConfirm() {
        setError(null);
        setParseErrors(null);

        if (!file) {
            setError("Выберите файл Excel.");
            return;
        }

        if (!targetDate) {
            setError("Укажите дату рейса.");
            return;
        }

        try {
            const result = await importMutation.mutateAsync({
                file,
                target_date: targetDate,
                shipment_number: shipmentNumber.trim() || undefined,
                laboratory_id: laboratoryId
                    ? Number(laboratoryId)
                    : undefined,
            });

            if (result.status === "ERROR") {
                if (result.parse_errors && result.parse_errors.length > 0) {
                    setParseErrors(result.parse_errors);
                } else {
                    setError("Ошибка импорта данных.");
                }
                return;
            }

            onSuccess(result);
            reset();
            onClose();
        } catch (err) {
            const message =
                err instanceof AxiosError
                    ? extractErrorMessage(err)
                    : "Не удалось импортировать рейс.";
            setError(message);
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Импортировать рейс</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
                        {error}
                    </Alert>
                )}

                {parseErrors && parseErrors.length > 0 && (
                    <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                            Найдено {parseErrors.length} проблем в файле:
                        </Typography>
                        <ErrorList errors={parseErrors} />
                    </Alert>
                )}

                <Stack spacing={2} sx={{ mt: 1 }}>
                    {/* MUI 9: alignItems через sx, не проп */}
                    <Stack
                        direction="row"
                        spacing={2}
                        sx={{ alignItems: "center" }}
                    >
                        <Button
                            variant="outlined"
                            component="label"
                            disabled={importMutation.isPending}
                        >
                            Выбрать файл
                            <input
                                type="file"
                                hidden
                                accept=".xlsx,.xlsm"
                                onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    setFile(f);
                                    setError(null);
                                    setParseErrors(null);
                                }}
                            />
                        </Button>
                        <Typography variant="body2" color="text.secondary">
                            {file ? file.name : "Файл не выбран"}
                        </Typography>
                    </Stack>

                    {/* MUI 9: InputLabelProps убран, shrink через sx */}
                    <TextField
                        label="Дата рейса *"
                        type="date"
                        size="small"
                        fullWidth
                        required
                        value={targetDate}
                        onChange={(e) => {
                            setTargetDate(e.target.value);
                            setError(null);
                            setParseErrors(null);
                        }}
                        sx={{
                            "& .MuiInputLabel-root": {
                                transform:
                                    "translate(14px, -9px) scale(0.75)",
                            },
                        }}
                        disabled={importMutation.isPending}
                    />

                    <TextField
                        label="Номер рейса (опционально)"
                        size="small"
                        fullWidth
                        value={shipmentNumber}
                        onChange={(e) => setShipmentNumber(e.target.value)}
                        placeholder="Автогенерация, если пусто"
                        disabled={importMutation.isPending}
                    />

                    <FormControl
                        fullWidth
                        size="small"
                        disabled={importMutation.isPending}
                    >
                        <InputLabel id="import-lab-label">
                            Лаборатория (опционально)
                        </InputLabel>
                        <Select
                            labelId="import-lab-label"
                            label="Лаборатория (опционально)"
                            value={laboratoryId}
                            onChange={(e) =>
                                setLaboratoryId(String(e.target.value))
                            }
                        >
                            <MenuItem value="">— не указана —</MenuItem>
                            {(laboratories.data ?? []).map((lab) => (
                                <MenuItem key={lab.id} value={String(lab.id)}>
                                    {lab.name} ({lab.code})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={handleClose}
                    disabled={importMutation.isPending}
                >
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleConfirm()}
                    variant="contained"
                    disabled={
                        importMutation.isPending || !file || !targetDate
                    }
                >
                    {importMutation.isPending
                        ? "Импортируем..."
                        : "Импортировать"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}