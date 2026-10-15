/**
 * Диалог импорта рейса из Excel.
 *
 * Загружает файл, дату и опциональные параметры.
 * При статусе ERROR в ответе — не закрывает диалог, показывает
 * компактную сводку + раскрываемый список ошибок по группам.
 * При успехе (APPLIED / PARSED) — вызывает onSuccess и закрывается.
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Collapse,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { AxiosError } from "axios";

import {
    useImportShipment,
    useLaboratories,
    type ImportError,
    type ImportShipmentResponse,
} from "../api";

interface ImportShipmentDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (result: ImportShipmentResponse) => void;
}

/** Формат тела ошибки DRF / нашего backend. */
interface BackendErrorBody {
    error?: string | { message?: string };
    message?: string;
    detail?: string;
    [key: string]: unknown;
}

function extractErrorMessage(err: AxiosError<BackendErrorBody>): string {
    const data = err.response?.data;
    if (!data) return err.message || "Проверьте соединение.";
    if (typeof data.error === "string") return data.error;
    if (data.error && typeof data.error === "object" && data.error.message) {
        return data.error.message;
    }
    if (data.message) return data.message;
    if (data.detail) return data.detail;
    return JSON.stringify(data);
}

/**
 * Русские заголовки для групп ошибок.
 * `title` (приходит с backend) — приоритетно;
 * эти — fallback по `code`.
 */
const CODE_TITLES: Record<string, string> = {
    NEEDS_CONFIRMATION: "Требует уточнения",
    TARGET_DATE_MISSING: "Нет данных на дату",
    UNKNOWN_RESEARCH_TYPE: "Неизвестный тип исследования",
    MISSING_CONTAINER_TYPE: "Не указан тип тары",
    MISSING_WORK_ORDER_COLUMN: "Не найдена колонка Н/З",
    DUPLICATE_DATE: "Дубль даты",
};

const OTHER_TITLE = "Прочие ошибки";

/** Возвращает отображаемый заголовок ошибки. */
function getTitle(e: ImportError): string {
    const explicit = (e as { title?: string }).title;
    if (explicit) return explicit;
    return CODE_TITLES[e.code ?? ""] ?? OTHER_TITLE;
}

/** Короткая однострочная сводка по одной ошибке. */
function shortLine(e: ImportError): string {
    const parts: string[] = [];
    if (e.sheet) parts.push(`Лист «${e.sheet}»`);
    if (e.row !== undefined) parts.push(`строка ${e.row}`);
    if (e.column !== undefined) parts.push(`колонка ${e.column}`);
    const wo = (e as { work_order?: string }).work_order;
    if (wo) parts.push(`Н/З ${wo}`);
    const prefix = parts.length ? `${parts.join(", ")} — ` : "";
    const msg =
        e.error
        ?? (e as { message?: string }).message
        ?? "Проблема в данных.";
    return `${prefix}${msg}`;
}

const MAX_PER_GROUP = 5;

interface GroupedErrorsProps {
    errors: ImportError[];
}

function GroupedErrors({ errors }: GroupedErrorsProps) {
    const groups = useMemo(() => {
        const map = new Map<string, ImportError[]>();
        for (const e of errors) {
            const key = getTitle(e);
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(e);
        }
        return Array.from(map.entries());
    }, [errors]);

    return (
        <Stack spacing={2}>
            {groups.map(([title, items]) => (
                <Box key={title}>
                    <Typography
                        variant="subtitle2"
                        sx={{ mb: 0.5, fontWeight: 600 }}
                    >
                        {title} — {items.length}
                    </Typography>
                    <Box
                        component="ul"
                        sx={{
                            m: 0,
                            pl: 2,
                            "& li": {
                                mb: 0.25,
                                fontSize: "0.85rem",
                                color: "text.secondary",
                            },
                        }}
                    >
                        {items.slice(0, MAX_PER_GROUP).map((e, i) => (
                            <li key={i}>{shortLine(e)}</li>
                        ))}
                        {items.length > MAX_PER_GROUP && (
                            <li>
                                … и ещё {items.length - MAX_PER_GROUP}{" "}
                                {items.length - MAX_PER_GROUP === 1
                                    ? "запись"
                                    : "записей"}
                            </li>
                        )}
                    </Box>
                </Box>
            ))}
        </Stack>
    );
}

interface ErrorSummaryProps {
    errors: ImportError[];
}

function ErrorSummary({ errors }: ErrorSummaryProps) {
    const [expanded, setExpanded] = useState(false);

    /** Сводка по типам: `[title, count]` без раскрытия. */
    const summary = useMemo(() => {
        const map = new Map<string, number>();
        for (const e of errors) {
            const key = getTitle(e);
            map.set(key, (map.get(key) ?? 0) + 1);
        }
        return Array.from(map.entries());
    }, [errors]);

    return (
        <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Найдено проблем: {errors.length}
            </Typography>
            <Box
                component="ul"
                sx={{ m: 0, pl: 2, "& li": { fontSize: "0.85rem" } }}
            >
                {summary.map(([title, count]) => (
                    <li key={title}>
                        {title} — {count}
                    </li>
                ))}
            </Box>

            <Button
                size="small"
                endIcon={
                    expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />
                }
                onClick={() => setExpanded((v) => !v)}
                sx={{ mt: 1 }}
            >
                {expanded ? "Скрыть подробности" : "Показать подробности"}
            </Button>
            <Collapse in={expanded} unmountOnExit>
                <Box
                    sx={{
                        mt: 1,
                        maxHeight: 320,
                        overflow: "auto",
                        pr: 1,
                    }}
                >
                    <GroupedErrors errors={errors} />
                </Box>
            </Collapse>
        </Alert>
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
                    setError("Импорт завершился с ошибкой.");
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
                    <ErrorSummary errors={parseErrors} />
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