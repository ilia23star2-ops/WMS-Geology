/**
 * Диалог создания тары-заготовки в ячейке (2f-12b).
 * Только создаёт пустую тару. Заполнение пробами делегируется
 * в FillContainerDialog.
 *
 * 2f-15: кнопка «Предпросмотр» — макет этикетки до создания
 * (LocalPreviewDialog с previewData, QR — плейсхолдер).
 */
import { useState } from "react";
import {
    Alert,
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

import {
    useBulkCreateContainers,
    useContainerTypes,
    useResearchTypes,
    useSites,
    type Cell,
    type Container,
} from "../api";
import LocalPreviewDialog from "./LocalPreviewDialog";

interface CreateInCellDialogProps {
    open: boolean;
    cell: Cell;
    onClose: () => void;
    onSuccess: (container: Container) => void;
}

export default function CreateInCellDialog({
    open,
    cell,
    onClose,
    onSuccess,
}: CreateInCellDialogProps) {
    const [containerTypeId, setContainerTypeId] = useState<string>("");
    const [siteId, setSiteId] = useState<string>("");
    const [workOrderCoded, setWorkOrderCoded] = useState("");
    const [workOrderIncoming, setWorkOrderIncoming] = useState("");
    const [researchTypeId, setResearchTypeId] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);

    const containerTypes = useContainerTypes();
    const sites = useSites();
    const researchTypes = useResearchTypes();
    const createMutation = useBulkCreateContainers();

    function handleClose() {
        if (createMutation.isPending) return;
        setError(null);
        onClose();
    }

    async function handleSubmit() {
        setError(null);

        if (!containerTypeId) {
            setError("Выберите тип тары.");
            return;
        }

        try {
            const result = await createMutation.mutateAsync({
                containers: [{ container_type_id: Number(containerTypeId) }],
                draft_site_id: siteId === "" ? null : Number(siteId),
                draft_research_type_id: researchTypeId === "" ? null : Number(researchTypeId),
                draft_work_order_coded: workOrderCoded.trim(),
                draft_work_order_incoming: workOrderIncoming.trim(),
            });

            const newContainer = result.created_containers[0];
            onSuccess(newContainer);
            onClose();

            // Очистка
            setContainerTypeId("");
            setSiteId("");
            setWorkOrderCoded("");
            setWorkOrderIncoming("");
            setResearchTypeId("");
        } catch (err) {
            const anyErr = err as { response?: { data?: { error?: string; detail?: string } } };
            const msg = anyErr?.response?.data?.error ?? anyErr?.response?.data?.detail ?? "Не удалось создать тару.";
            setError(msg);
        }
    }

    if (!open) return null;

    // 2f-15: mock-данные для предпросмотра из полей формы.
    const previewSiteName =
        sites.data?.find((s) => String(s.id) === siteId)?.name ?? null;
    const previewResearchTypeName =
        researchTypes.data?.find((rt) => String(rt.id) === researchTypeId)?.name ?? null;

    return (
        <>
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>Создать тару (шаг 1 из 2)</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Ячейка: <b>{cell.full_address}</b>
                    </Typography>

                    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                    <Stack spacing={2}>
                        <FormControl fullWidth size="small" required>
                            <InputLabel>Тип тары</InputLabel>
                            <Select
                                label="Тип тары"
                                value={containerTypeId}
                                onChange={(e) => setContainerTypeId(e.target.value)}
                            >
                                {(containerTypes.data ?? []).map((t) => (
                                    <MenuItem key={t.id} value={String(t.id)}>
                                        {t.name} {t.laboratory_name ? `(${t.laboratory_name})` : ""}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Stack direction="row" spacing={2}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Участок</InputLabel>
                                <Select
                                    label="Участок"
                                    value={siteId}
                                    onChange={(e) => setSiteId(e.target.value)}
                                >
                                    <MenuItem value="">— не указан —</MenuItem>
                                    {(sites.data ?? []).map((s) => (
                                        <MenuItem key={s.id} value={String(s.id)}>{s.name}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl fullWidth size="small">
                                <InputLabel>Тип исследования</InputLabel>
                                <Select
                                    label="Тип исследования"
                                    value={researchTypeId}
                                    onChange={(e) => setResearchTypeId(e.target.value)}
                                >
                                    <MenuItem value="">— не указан —</MenuItem>
                                    {(researchTypes.data ?? []).map((rt) => (
                                        <MenuItem key={rt.id} value={String(rt.id)}>
                                            {rt.code} — {rt.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Stack>

                        <TextField
                            label="Н/З (текущий)"
                            size="small"
                            fullWidth
                            value={workOrderCoded}
                            onChange={(e) => setWorkOrderCoded(e.target.value)}
                            placeholder="Sev00544"
                        />
                        <TextField
                            label="Н/З (входящий)"
                            size="small"
                            fullWidth
                            value={workOrderIncoming}
                            onChange={(e) => setWorkOrderIncoming(e.target.value)}
                            placeholder="02-Тест001"
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose} disabled={createMutation.isPending}>Отмена</Button>
                    <Button
                        onClick={() => setPreviewOpen(true)}
                        disabled={createMutation.isPending}
                    >
                        Предпросмотр
                    </Button>
                    <Button onClick={() => void handleSubmit()} variant="contained" disabled={createMutation.isPending}>
                        {createMutation.isPending ? "Создаём..." : "Далее (к пробам)"}
                    </Button>
                </DialogActions>
            </Dialog>

            <LocalPreviewDialog
                open={previewOpen}
                previewData={{
                    site_name: previewSiteName,
                    work_order_coded: workOrderCoded,
                    work_order_incoming: workOrderIncoming,
                    research_type_name: previewResearchTypeName,
                    container_number: null,
                    container_id: null,
                }}
                onClose={() => setPreviewOpen(false)}
            />
        </>
    );
}