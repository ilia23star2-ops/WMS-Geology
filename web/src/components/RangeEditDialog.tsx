/**
 * Диалог редактирования диапазона проб.
 *
 * Принимает ТОЛЬКО порядковые номера (sequence).
 * Два поля ввода (через пробел, с поддержкой диапазонов):
 * - «Пропущенные пробы» — те, которых нет физически;
 * - «Выбранные пробы» — те, что нужно создать (если пусто —
 *   берутся все, кроме пропущенных).
 */
import { useEffect, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
    TextField,
    Typography,
} from "@mui/material";

interface RangeEditDialogProps {
    open: boolean;
    series: string; // "TST124" для отображения в заголовке
    sequenceDigits: number; // 3
    allSeqs: number[]; // [15, 16, 17, ..., 20]
    initialSelectedSeqs: number[];
    onClose: () => void;
    onSave: (selectedSeqs: number[]) => void;
}

/**
 * Парсит строку вида "001 003 005-007" в массив чисел.
 */
function parseSeqsInput(input: string): number[] {
    const result: number[] = [];
    if (!input.trim()) return result;
    const tokens = input.trim().split(/\s+/);
    for (const token of tokens) {
        if (token.includes("-")) {
            const [aStr, bStr] = token.split("-");
            const a = parseInt(aStr, 10);
            const b = parseInt(bStr, 10);
            if (!Number.isNaN(a) && !Number.isNaN(b) && a <= b) {
                for (let i = a; i <= b; i++) result.push(i);
            }
        } else {
            const n = parseInt(token, 10);
            if (!Number.isNaN(n)) result.push(n);
        }
    }
    return result;
}

/**
 * Превращает массив чисел в строку вида "001 003 005-007".
 */
function formatSeqsOutput(seqs: number[], digits: number): string {
    if (seqs.length === 0) return "";
    const sorted = [...seqs].sort((a, b) => a - b);
    const pad = (n: number) => String(n).padStart(digits, "0");
    const parts: string[] = [];
    let start = sorted[0];
    let prev = sorted[0];
    for (let i = 1; i < sorted.length; i++) {
        if (sorted[i] === prev + 1) {
            prev = sorted[i];
        } else {
            parts.push(start === prev ? pad(start) : `${pad(start)}-${pad(prev)}`);
            start = sorted[i];
            prev = sorted[i];
        }
    }
    parts.push(start === prev ? pad(start) : `${pad(start)}-${pad(prev)}`);
    return parts.join(" ");
}

export default function RangeEditDialog({
    open,
    series,
    sequenceDigits,
    allSeqs,
    initialSelectedSeqs,
    onClose,
    onSave,
}: RangeEditDialogProps) {
    const [passedInput, setPassedInput] = useState("");
    const [selectedInput, setSelectedInput] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        const selectedSet = new Set(initialSelectedSeqs);
        const passedSeqs = allSeqs.filter((s) => !selectedSet.has(s));
        const chosenSeqs = allSeqs.filter((s) => selectedSet.has(s));

        setPassedInput(formatSeqsOutput(passedSeqs, sequenceDigits));
        setSelectedInput(formatSeqsOutput(chosenSeqs, sequenceDigits));
        setError(null);
    }, [open, initialSelectedSeqs, allSeqs, sequenceDigits]);

    function handleSave() {
        setError(null);
        const passed = new Set(parseSeqsInput(passedInput));
        const selectedParsed = parseSeqsInput(selectedInput);

        const allSet = new Set(allSeqs);

        // Если выбранные заданы — берём их, иначе — все
        let chosenSeqs: number[];
        if (selectedParsed.length > 0) {
            chosenSeqs = selectedParsed.filter((s) => allSet.has(s));
        } else {
            chosenSeqs = [...allSeqs];
        }

        // Убираем пропущенные
        chosenSeqs = chosenSeqs.filter((s) => !passed.has(s));

        if (chosenSeqs.length === 0) {
            setError("Нельзя сохранить пустой диапазон. Все пробы пропущены.");
            return;
        }

        onSave(chosenSeqs.sort((a, b) => a - b));
        onClose();
    }

    if (!open) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Редактировать диапазон: <b>{series}</b>
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Ввод через пробел. Можно указывать диапазоны через дефис
                    (например: <b>001 003 005-007</b>).
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={2}>
                    <TextField
                        label="Пропущенные пробы"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={passedInput}
                        onChange={(e) => setPassedInput(e.target.value)}
                        placeholder="001 003 005-007"
                        helperText="Эти номера будут исключены из диапазона."
                    />

                    <TextField
                        label="Выбранные пробы"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={selectedInput}
                        onChange={(e) => setSelectedInput(e.target.value)}
                        placeholder="001-005 008 010-012"
                        helperText="Если оставить пустым — берутся все, кроме пропущенных."
                    />
                </Stack>

                <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                        Всего номеров в диапазоне: {allSeqs.length}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Отмена</Button>
                <Button variant="contained" onClick={handleSave}>
                    Сохранить
                </Button>
            </DialogActions>
        </Dialog>
    );
}