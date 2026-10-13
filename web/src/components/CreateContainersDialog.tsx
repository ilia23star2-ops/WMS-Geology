/**
 * Диалог создания партии тары-заготовок.
 *
 * Создаёт N тар одним запросом `POST /storage/containers/bulk-create/`.
 * `container_number` не задаётся — присваивается позже, при
 * заполнении пробами (см. DECISIONS 1.60).
 *
 * Draft-поля (участок, ТИ, Н/З) сохраняются на каждой таре и
 * используются для предзаполнения формы «Заполнить тару пробами».
 */
import { useState } from "react";
import {
    Alert,
    Button,
    Checkbox,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    FormControlLabel,
    Grid,
    InputLabel,
    MenuItem,
    Select,
    TextField,
} from "@mui/material";

import {
    useBulkCreateContainers,
    useContainerTypes,
    useResearchTypes,
    useSites,
} from "../api";

interface CreateContainersDialogProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (count: number) => void;
}

const MAX_COUNT = 100;

export default function CreateContainersDialog({
    open,
    onClose,
    onSuccess,
}: CreateContainersDialogProps) {
    // Селекты работают со строковыми значениями (MUI + TS требуют
    // единый тип для value и onChange). Пустая строка = «не выбрано».
    const [siteId, setSiteId] = useState<string>("");
    const [workOrderCoded, setWorkOrderCoded] = useState("");
    const [hasIncoming, setHasIncoming] = useState(false);
    const [workOrderIncoming, setWorkOrderIncoming] = useState("");
    const [researchTypeId, setResearchTypeId] = useState<string>("");
    const [containerTypeId, setContainerTypeId] = useState<string>("");
    const [count, setCount] = useState<number>(1);
    const [error, setError] = useState<string | null>(null);

    const sites = useSites();
    const researchTypes = useResearchTypes();
    const containerTypes = useContainerTypes();
    const createMutation = useBulkCreateContainers();

    function reset() {
        setSiteId("");
        setWorkOrderCoded("");
        setHasIncoming(false);
        setWorkOrderIncoming("");
        setResearchTypeId("");
        setContainerTypeId("");
        setCount(1);
        setError(null);
    }

    function handleClose() {
        if (createMutation.isPending) return;
        reset();
        onClose();
    }

    async function handleConfirm() {
        setError(null);

        if (containerTypeId === "") {
            setError("Выберите тип тары.");
            return;
        }

        const n = Number(count);
        if (!Number.isFinite(n) || n < 1 || n > MAX_COUNT) {
            setError(`Количество тары — от 1 до ${MAX_COUNT}.`);
            return;
        }

        const coded = workOrderCoded.trim();
        if (!coded) {
            setError("Укажите зашифрованный Н/З.");
            return;
        }

        const incoming = hasIncoming ? workOrderIncoming.trim() : "";

        try {
            const result = await createMutation.mutateAsync({
                containers: Array.from({ length: n }, () => ({
                    container_type_id: Number(containerTypeId),
                })),
                draft_site_id: siteId === "" ? null : Number(siteId),
                draft_research_type_id:
                    researchTypeId === "" ? null : Number(researchTypeId),
                draft_work_order_coded: coded,
                draft_work_order_incoming: incoming,
            });
            onSuccess(result.total_containers);
            reset();
            onClose();
        } catch {
            setError(
                "Не удалось создать тару. Проверьте данные и попробуйте ещё раз.",
            );
        }
    }

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Создать тару</DialogTitle>
            <DialogContent>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={2} sx={{ mt: 0 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="create-site-label">
                                Участок
                            </InputLabel>
                            <Select
                                labelId="create-site-label"
                                label="Участок"
                                value={siteId}
                                onChange={(e) =>
                                    setSiteId(String(e.target.value))
                                }
                            >
                                <MenuItem value="">— не указан —</MenuItem>
                                {(sites.data ?? []).map((s) => (
                                    <MenuItem key={s.id} value={String(s.id)}>
                                        {s.name} ({s.code})
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel id="create-rt-label">
                                Тип исследования
                            </InputLabel>
                            <Select
                                labelId="create-rt-label"
                                label="Тип исследования"
                                value={researchTypeId}
                                onChange={(e) =>
                                    setResearchTypeId(String(e.target.value))
                                }
                            >
                                <MenuItem value="">— не указан —</MenuItem>
                                {(researchTypes.data ?? []).map((rt) => (
                                    <MenuItem
                                        key={rt.id}
                                        value={String(rt.id)}
                                    >
                                        {rt.code} — {rt.name}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <TextField
                            label="Н/З (зашифрованный)"
                            size="small"
                            fullWidth
                            required
                            value={workOrderCoded}
                            onChange={(e) =>
                                setWorkOrderCoded(e.target.value)
                            }
                            helperText="Например: TST0001"
                        />
                    </Grid>

                    <Grid size={{ xs: 12 }}>
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={hasIncoming}
                                    onChange={(e) =>
                                        setHasIncoming(e.target.checked)
                                    }
                                />
                            }
                            label="Есть входящий Н/З"
                        />
                        {hasIncoming && (
                            <TextField
                                label="Н/З (входящий)"
                                size="small"
                                fullWidth
                                sx={{ mt: 1 }}
                                value={workOrderIncoming}
                                onChange={(e) =>
                                    setWorkOrderIncoming(e.target.value)
                                }
                                helperText="Например: 02-Тест001"
                            />
                        )}
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <FormControl fullWidth size="small" required>
                            <InputLabel id="create-ct-label">
                                Тип тары
                            </InputLabel>
                            <Select
                                labelId="create-ct-label"
                                label="Тип тары"
                                value={containerTypeId}
                                onChange={(e) =>
                                    setContainerTypeId(String(e.target.value))
                                }
                            >
                                <MenuItem value="">— выберите —</MenuItem>
                                {(containerTypes.data ?? []).map((t) => (
                                    <MenuItem
                                        key={t.id}
                                        value={String(t.id)}
                                    >
                                        {t.name}
                                        {t.laboratory_name
                                            ? ` (${t.laboratory_name})`
                                            : ""}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                            label="Количество тары"
                            type="number"
                            size="small"
                            fullWidth
                            required
                            value={count}
                            onChange={(e) =>
                                setCount(Number(e.target.value) || 0)
                            }
                            helperText={`От 1 до ${MAX_COUNT}`}
                        />
                    </Grid>
                </Grid>

                <Alert severity="info" sx={{ mt: 2 }}>
                    Тара создаётся без номера. Номера присваиваются
                    на шаге заполнения пробами.
                </Alert>
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={handleClose}
                    disabled={createMutation.isPending}
                >
                    Отмена
                </Button>
                <Button
                    onClick={() => void handleConfirm()}
                    variant="contained"
                    disabled={createMutation.isPending}
                >
                    {createMutation.isPending ? "Создаём..." : "Создать"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}