/**
 * Диалог создания / редактирования записи справочника (пачка 2f-3a).
 *
 * Один компонент на три справочника: `research-types`, `sites`,
 * `laboratories`. Различия в спец. полях:
 * - `Site` — `match_patterns: string[]`;
 * - `Laboratory` — `prefixes: string[]`.
 *
 * Массивы строк редактируются через `TextField` с запятыми.
 */
import { useEffect, useState } from "react";
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    TextField,
} from "@mui/material";

import {
    useCreateCatalog,
    useUpdateCatalog,
    type CatalogKind,
    type CatalogPayload,
} from "../api";

export interface CatalogEntityInitial {
    id: number;
    code: string;
    name: string;
    description: string;
    sort_order: number;
    is_active: boolean;
    match_patterns?: string[];
    prefixes?: string[];
}

interface CatalogEntityDialogProps {
    open: boolean;
    kind: CatalogKind;
    title: string;
    /** null — создание, объект — редактирование. */
    initial: CatalogEntityInitial | null;
    onClose: () => void;
    onSuccess: (message: string) => void;
}

interface FormState {
    code: string;
    name: string;
    description: string;
    sortOrder: string;
    isActive: boolean;
    /** Только для `Site`. */
    matchPatternsText: string;
    /** Только для `Laboratory`. */
    prefixesText: string;
}

const EMPTY_FORM: FormState = {
    code: "",
    name: "",
    description: "",
    sortOrder: "100",
    isActive: true,
    matchPatternsText: "",
    prefixesText: "",
};

function formFrom(initial: CatalogEntityInitial | null): FormState {
    if (!initial) return EMPTY_FORM;
    return {
        code: initial.code,
        name: initial.name,
        description: initial.description ?? "",
        sortOrder: String(initial.sort_order ?? 100),
        isActive: initial.is_active,
        matchPatternsText: (initial.match_patterns ?? []).join(", "),
        prefixesText: (initial.prefixes ?? []).join(", "),
    };
}

/** Разбивает строку через запятую, чистит пустые. */
function parseList(text: string): string[] {
    return text
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

function extractError(err: unknown): string | null {
    const anyErr = err as {
        response?: { data?: { error?: string; detail?: string } };
    };
    return (
        anyErr?.response?.data?.error
        ?? anyErr?.response?.data?.detail
        ?? null
    );
}

export default function CatalogEntityDialog({
    open,
    kind,
    title,
    initial,
    onClose,
    onSuccess,
}: CatalogEntityDialogProps) {
    const createMutation = useCreateCatalog(kind);
    const updateMutation = useUpdateCatalog(kind);

    const [form, setForm] = useState<FormState>(EMPTY_FORM);
    const [error, setError] = useState<string | null>(null);

    const isEdit = initial !== null;
    const busy = createMutation.isPending || updateMutation.isPending;

    useEffect(() => {
        if (open) {
            setForm(formFrom(initial));
            setError(null);
        }
    }, [open, initial]);

    const canSave =
        form.code.trim().length > 0
        && form.name.trim().length > 0
        && !busy;

    async function handleSave() {
        setError(null);
        const payload: CatalogPayload = {
            code: form.code.trim(),
            name: form.name.trim(),
            description: form.description,
            sort_order: Number(form.sortOrder) || 0,
            is_active: form.isActive,
        };
        if (kind === "sites") {
            payload.match_patterns = parseList(form.matchPatternsText);
        }
        if (kind === "laboratories") {
            payload.prefixes = parseList(form.prefixesText);
        }

        try {
            if (isEdit && initial) {
                await updateMutation.mutateAsync({
                    id: initial.id,
                    payload,
                });
                onSuccess(`«${payload.name}» сохранено.`);
            } else {
                await createMutation.mutateAsync(payload);
                onSuccess(`«${payload.name}» создано.`);
            }
            onClose();
        } catch (err) {
            setError(
                extractError(err) ?? "Не удалось сохранить запись.",
            );
        }
    }

    return (
        <Dialog
            open={open}
            onClose={busy ? undefined : onClose}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                {isEdit ? `Редактировать: ${title}` : `Создать: ${title}`}
            </DialogTitle>

            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Код"
                        size="small"
                        fullWidth
                        value={form.code}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                code: e.target.value,
                            }))
                        }
                        helperText="Короткое уникальное обозначение (например, ШЛ)."
                    />

                    <TextField
                        label="Название"
                        size="small"
                        fullWidth
                        value={form.name}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                name: e.target.value,
                            }))
                        }
                    />

                    <TextField
                        label="Описание"
                        size="small"
                        fullWidth
                        multiline
                        minRows={2}
                        value={form.description}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                description: e.target.value,
                            }))
                        }
                    />

                    {kind === "sites" && (
                        <TextField
                            label="Паттерны распознавания"
                            size="small"
                            fullWidth
                            value={form.matchPatternsText}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    matchPatternsText: e.target.value,
                                }))
                            }
                            helperText="Через запятую. Например: TST, Тест."
                        />
                    )}

                    {kind === "laboratories" && (
                        <TextField
                            label="Префиксы"
                            size="small"
                            fullWidth
                            value={form.prefixesText}
                            onChange={(e) =>
                                setForm((prev) => ({
                                    ...prev,
                                    prefixesText: e.target.value,
                                }))
                            }
                            helperText="Через запятую. Например: TAA-A, TAA-B."
                        />
                    )}

                    <TextField
                        label="Порядок сортировки"
                        size="small"
                        type="number"
                        fullWidth
                        value={form.sortOrder}
                        onChange={(e) =>
                            setForm((prev) => ({
                                ...prev,
                                sortOrder: e.target.value,
                            }))
                        }
                        helperText="Меньше — выше в списке."
                    />

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={form.isActive}
                                onChange={(e) =>
                                    setForm((prev) => ({
                                        ...prev,
                                        isActive: e.target.checked,
                                    }))
                                }
                            />
                        }
                        label="Активен"
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} disabled={busy}>
                    Отмена
                </Button>
                <Button
                    variant="contained"
                    onClick={() => void handleSave()}
                    disabled={!canSave}
                >
                    {busy ? "Сохраняем..." : "Сохранить"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}