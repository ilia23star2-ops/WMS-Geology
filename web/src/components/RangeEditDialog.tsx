/**
 * Диалог редактирования диапазона проб.
 * 
 * Одно поле для ввода полной строки (например, Sev0054401-34),
 * а также поля для пропущенных и выбранных проб.
 */
import { useEffect, useState } from "react";
import {
    Alert,
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
    initialRaw: string;
    initialSkipped: string;
    initialSelected: string;
    onClose: () => void;
    onSave: (raw: string, skipped: number[], selected: number[]) => void;
}

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

export default function RangeEditDialog({
    open,
    initialRaw,
    initialSkipped,
    initialSelected,
    onClose,
    onSave,
}: RangeEditDialogProps) {
    const [rawInput, setRawInput] = useState("");
    const [skippedInput, setSkippedInput] = useState("");
    const [selectedInput, setSelectedInput] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        setRawInput(initialRaw);
        setSkippedInput(initialSkipped);
        setSelectedInput(initialSelected);
        setError(null);
    }, [open, initialRaw, initialSkipped, initialSelected]);

    function handleSave() {
        setError(null);

        const trimmedRaw = rawInput.trim();
        if (!trimmedRaw) {
            setError("Строка не может быть пустой.");
            return;
        }

        const skipped = parseSeqsInput(skippedInput);
        const selected = parseSeqsInput(selectedInput);

        // Проверка на пересечение
        const skippedSet = new Set(skipped);
        for (const s of selected) {
            if (skippedSet.has(s)) {
                setError(`Номер ${s} не может быть одновременно пропущенным и выбранным.`);
                return;
            }
        }

        onSave(trimmedRaw, skipped, selected);
        onClose();
    }

    if (!open) return null;

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Редактировать запись</DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Можно полностью изменить ввод. Например: <b>Sev0054401-34</b>.
                </Typography>

                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={2}>
                    <TextField
                        label="Диапазон (полная строка)"
                        size="small"
                        fullWidth
                        value={rawInput}
                        onChange={(e) => setRawInput(e.target.value)}
                        helperText="Пример: TST124001-005 или Sev0054401-34"
                    />

                    <TextField
                        label="Пропущенные пробы"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={skippedInput}
                        onChange={(e) => setSkippedInput(e.target.value)}
                        placeholder="1 2 12"
                        helperText="Этих проб нет физически (они не создаются)."
                    />

                    <TextField
                        label="Выбранные пробы"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={selectedInput}
                        onChange={(e) => setSelectedInput(e.target.value)}
                        placeholder="17-20"
                        helperText="Эти пробы будут созданы со статусом «Выбрана»."
                    />
                </Stack>
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