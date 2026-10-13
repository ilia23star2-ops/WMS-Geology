/**
 * Форма создания партии тары с пробами.
 *
 * Один запрос = одна партия: общие Н/З + тип + участок,
 * внутри — список тар, в каждой — группы проб (диапазоны).
 */
import { useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Checkbox,
    Divider,
    FormControl,
    FormControlLabel,
    Grid,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate } from "react-router-dom";

import {
    useContainerTypes,
    useCreateContainers,
    useResearchTypes,
    useSites,
    type BulkContainer,
    type BulkSampleGroup,
} from "../api";

interface SampleGroupRow {
    /** Внутренний ключ для React. */
    key: number;
    prefix: string;
    middle: string;
    sequence_from: number;
    sequence_to: number;
    sequence_digits: number;
    well_name: string;
}

interface ContainerRow {
    key: number;
    container_number: string;
    container_type_id: number | "";
    sample_groups: SampleGroupRow[];
}

let _nextKey = 1;
function nextKey(): number {
    return _nextKey++;
}

function emptySampleGroup(): SampleGroupRow {
    return {
        key: nextKey(),
        prefix: "",
        middle: "",
        sequence_from: 1,
        sequence_to: 1,
        sequence_digits: 3,
        well_name: "",
    };
}

function emptyContainer(): ContainerRow {
    return {
        key: nextKey(),
        container_number: "",
        container_type_id: "",
        sample_groups: [emptySampleGroup()],
    };
}

export default function CreateContainersPage() {
    const navigate = useNavigate();

    const researchTypes = useResearchTypes();
    const sites = useSites();
    const containerTypes = useContainerTypes();
    const createMutation = useCreateContainers();

    const [workOrderCoded, setWorkOrderCoded] = useState("");
    const [hasIncoming, setHasIncoming] = useState(false);
    const [workOrderIncoming, setWorkOrderIncoming] = useState("");
    const [researchTypeId, setResearchTypeId] = useState<number | "">("");
    const [siteId, setSiteId] = useState<number | "">("");
    const [containers, setContainers] = useState<ContainerRow[]>([
        emptyContainer(),
    ]);
    const [error, setError] = useState<string | null>(null);

    // ---- Тары ----
    function addContainer() {
        setContainers((prev) => [...prev, emptyContainer()]);
    }

    function removeContainer(index: number) {
        setContainers((prev) => prev.filter((_, i) => i !== index));
    }

    function updateContainer(
        index: number,
        patch: Partial<ContainerRow>,
    ) {
        setContainers((prev) =>
            prev.map((c, i) => (i === index ? { ...c, ...patch } : c)),
        );
    }

    // ---- Группы проб ----
    function addSampleGroup(containerIndex: number) {
        setContainers((prev) =>
            prev.map((c, i) =>
                i === containerIndex
                    ? { ...c, sample_groups: [...c.sample_groups, emptySampleGroup()] }
                    : c,
            ),
        );
    }

    function removeSampleGroup(containerIndex: number, groupIndex: number) {
        setContainers((prev) =>
            prev.map((c, i) =>
                i === containerIndex
                    ? {
                        ...c,
                        sample_groups: c.sample_groups.filter(
                            (_, gi) => gi !== groupIndex,
                        ),
                    }
                    : c,
            ),
        );
    }

    function updateSampleGroup(
        containerIndex: number,
        groupIndex: number,
        patch: Partial<SampleGroupRow>,
    ) {
        setContainers((prev) =>
            prev.map((c, i) =>
                i === containerIndex
                    ? {
                        ...c,
                        sample_groups: c.sample_groups.map((g, gi) =>
                            gi === groupIndex ? { ...g, ...patch } : g,
                        ),
                    }
                    : c,
            ),
        );
    }

    // ---- Отправка ----
    async function handleSubmit() {
        setError(null);

        if (!workOrderCoded.trim()) {
            setError("Укажите зашифрованный Н/З.");
            return;
        }
        if (hasIncoming && !workOrderIncoming.trim()) {
            setError("Укажите входящий Н/З или снимите галочку.");
            return;
        }
        if (researchTypeId === "") {
            setError("Выберите тип исследования.");
            return;
        }
        if (containers.length === 0) {
            setError("Добавьте хотя бы одну тару.");
            return;
        }

        const payloadContainers: BulkContainer[] = [];
        for (let i = 0; i < containers.length; i++) {
            const c = containers[i];
            if (!c.container_number.trim()) {
                setError(`Тара #${i + 1}: не указан номер.`);
                return;
            }
            if (c.container_type_id === "") {
                setError(`Тара #${i + 1}: не выбран тип.`);
                return;
            }
            if (c.sample_groups.length === 0) {
                setError(`Тара #${i + 1}: нет ни одной группы проб.`);
                return;
            }

            const groups: BulkSampleGroup[] = [];
            for (let gi = 0; gi < c.sample_groups.length; gi++) {
                const g = c.sample_groups[gi];
                if (!g.prefix.trim() || !g.middle.trim()) {
                    setError(
                        `Тара #${i + 1}, группа #${gi + 1}: заполните префикс и middle.`,
                    );
                    return;
                }
                if (g.sequence_from > g.sequence_to) {
                    setError(
                        `Тара #${i + 1}, группа #${gi + 1}: от > до.`,
                    );
                    return;
                }
                groups.push({
                    prefix: g.prefix.trim(),
                    middle: g.middle.trim(),
                    sequence_from: g.sequence_from,
                    sequence_to: g.sequence_to,
                    sequence_digits: g.sequence_digits,
                    well_name: g.well_name.trim() || null,
                });
            }

            payloadContainers.push({
                container_number: c.container_number.trim(),
                container_type_id: Number(c.container_type_id),
                sample_groups: groups,
            });
        }

        try {
            const result = await createMutation.mutateAsync({
                work_order_coded: workOrderCoded.trim(),
                work_order_incoming: hasIncoming
                    ? workOrderIncoming.trim()
                    : "",
                research_type_id: Number(researchTypeId),
                site_id: siteId === "" ? null : Number(siteId),
                containers: payloadContainers,
            });
            // Редирект в реестр тары.
            navigate("/containers", { state: { created: result } });
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : "Не удалось создать партию.";
            setError(msg);
        }
    }

    const isSaving = createMutation.isPending;

    return (
        <Box>
            <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate("/containers")}
                sx={{ mb: 2 }}
            >
                К реестру тары
            </Button>

            <Typography variant="h2" component="h1" gutterBottom>
                Создание тары с пробами
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                Один запрос создаёт партию: все тары с пробами внутри.
            </Typography>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {/* ---- Общие реквизиты партии ---- */}
            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Typography variant="h3" sx={{ mb: 2 }}>
                        Партия
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <TextField
                                label="Н/З (зашифрованный) *"
                                value={workOrderCoded}
                                onChange={(e) => setWorkOrderCoded(e.target.value)}
                                fullWidth
                                size="small"
                                disabled={isSaving}
                            />
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={hasIncoming}
                                        onChange={(e) =>
                                            setHasIncoming(e.target.checked)
                                        }
                                        disabled={isSaving}
                                    />
                                }
                                label="Указать входящий Н/З"
                                sx={{ mt: 0.5 }}
                            />
                            {hasIncoming && (
                                <TextField
                                    label="Н/З (входящий)"
                                    value={workOrderIncoming}
                                    onChange={(e) =>
                                        setWorkOrderIncoming(e.target.value)
                                    }
                                    fullWidth
                                    size="small"
                                    disabled={isSaving}
                                    sx={{ mt: 1 }}
                                />
                            )}
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="rt-label">
                                    Тип исследования *
                                </InputLabel>
                                <Select
                                    labelId="rt-label"
                                    label="Тип исследования *"
                                    value={researchTypeId}
                                    onChange={(e) =>
                                        setResearchTypeId(
                                            e.target.value === ""
                                                ? ""
                                                : Number(e.target.value),
                                        )
                                    }
                                    disabled={isSaving}
                                >
                                    <MenuItem value="">— выберите —</MenuItem>
                                    {(researchTypes.data ?? []).map((rt) => (
                                        <MenuItem key={rt.id} value={rt.id}>
                                            {rt.code} — {rt.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel id="site-label">Участок</InputLabel>
                                <Select
                                    labelId="site-label"
                                    label="Участок"
                                    value={siteId}
                                    onChange={(e) =>
                                        setSiteId(
                                            e.target.value === ""
                                                ? ""
                                                : Number(e.target.value),
                                        )
                                    }
                                    disabled={isSaving}
                                >
                                    <MenuItem value="">— не указан —</MenuItem>
                                    {(sites.data ?? []).map((s) => (
                                        <MenuItem key={s.id} value={s.id}>
                                            {s.code} — {s.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* ---- Тары ---- */}
            {containers.map((container, ci) => (
                <Card key={container.key} sx={{ mb: 2 }}>
                    <CardContent>
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                mb: 2,
                            }}
                        >
                            <Typography variant="h3">
                                Тара #{ci + 1}
                            </Typography>
                            <IconButton
                                onClick={() => removeContainer(ci)}
                                disabled={containers.length === 1 || isSaving}
                                title="Удалить тару"
                            >
                                <DeleteIcon />
                            </IconButton>
                        </Box>

                        <Grid container spacing={2} sx={{ mb: 2 }}>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <TextField
                                    label="Номер тары *"
                                    value={container.container_number}
                                    onChange={(e) =>
                                        updateContainer(ci, {
                                            container_number: e.target.value,
                                        })
                                    }
                                    fullWidth
                                    size="small"
                                    disabled={isSaving}
                                />
                            </Grid>
                            <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                                <FormControl fullWidth size="small">
                                    <InputLabel id={`ct-label-${ci}`}>
                                        Тип тары *
                                    </InputLabel>
                                    <Select
                                        labelId={`ct-label-${ci}`}
                                        label="Тип тары *"
                                        value={container.container_type_id}
                                        onChange={(e) =>
                                            updateContainer(ci, {
                                                container_type_id:
                                                    e.target.value === ""
                                                        ? ""
                                                        : Number(e.target.value),
                                            })
                                        }
                                        disabled={isSaving}
                                    >
                                        <MenuItem value="">— выберите —</MenuItem>
                                        {(containerTypes.data ?? []).map((t) => (
                                            <MenuItem key={t.id} value={t.id}>
                                                {t.name}
                                                {t.laboratory_name
                                                    ? ` (${t.laboratory_name})`
                                                    : ""}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>

                        <Divider sx={{ my: 2 }} />
                        <Typography variant="h4" sx={{ mb: 1 }}>
                            Пробы
                        </Typography>

                        {container.sample_groups.map((group, gi) => (
                            <Grid
                                key={group.key}
                                container
                                spacing={1}
                                sx={{ mb: 1, alignItems: "center" }}
                            >
                                <Grid size={{ xs: 12, sm: 2 }}>
                                    <TextField
                                        label="Префикс *"
                                        value={group.prefix}
                                        onChange={(e) =>
                                            updateSampleGroup(ci, gi, {
                                                prefix: e.target.value,
                                            })
                                        }
                                        fullWidth
                                        size="small"
                                        disabled={isSaving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 2 }}>
                                    <TextField
                                        label="Middle *"
                                        value={group.middle}
                                        onChange={(e) =>
                                            updateSampleGroup(ci, gi, {
                                                middle: e.target.value,
                                            })
                                        }
                                        fullWidth
                                        size="small"
                                        disabled={isSaving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 6, sm: 1 }}>
                                    <TextField
                                        label="От *"
                                        type="number"
                                        value={group.sequence_from}
                                        onChange={(e) =>
                                            updateSampleGroup(ci, gi, {
                                                sequence_from:
                                                    Number(e.target.value) || 1,
                                            })
                                        }
                                        fullWidth
                                        size="small"
                                        disabled={isSaving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 6, sm: 1 }}>
                                    <TextField
                                        label="До *"
                                        type="number"
                                        value={group.sequence_to}
                                        onChange={(e) =>
                                            updateSampleGroup(ci, gi, {
                                                sequence_to:
                                                    Number(e.target.value) || 1,
                                            })
                                        }
                                        fullWidth
                                        size="small"
                                        disabled={isSaving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 6, sm: 1 }}>
                                    <TextField
                                        label="Знаков"
                                        type="number"
                                        value={group.sequence_digits}
                                        onChange={(e) =>
                                            updateSampleGroup(ci, gi, {
                                                sequence_digits:
                                                    Number(e.target.value) || 3,
                                            })
                                        }
                                        fullWidth
                                        size="small"
                                        disabled={isSaving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 3 }}>
                                    <TextField
                                        label="Скважина (опц.)"
                                        value={group.well_name}
                                        onChange={(e) =>
                                            updateSampleGroup(ci, gi, {
                                                well_name: e.target.value,
                                            })
                                        }
                                        fullWidth
                                        size="small"
                                        disabled={isSaving}
                                    />
                                </Grid>
                                <Grid size={{ xs: 12, sm: 2 }}>
                                    <IconButton
                                        onClick={() => removeSampleGroup(ci, gi)}
                                        disabled={
                                            container.sample_groups.length === 1 ||
                                            isSaving
                                        }
                                        title="Удалить группу"
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </Grid>
                            </Grid>
                        ))}

                        <Button
                            startIcon={<AddIcon />}
                            onClick={() => addSampleGroup(ci)}
                            disabled={isSaving}
                            sx={{ mt: 1 }}
                        >
                            Добавить группу проб
                        </Button>
                    </CardContent>
                </Card>
            ))}

            <Stack direction="row" spacing={2} sx={{ mb: 4 }}>
                <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addContainer}
                    disabled={isSaving}
                >
                    Добавить тару
                </Button>
                <Button
                    variant="contained"
                    startIcon={<SaveIcon />}
                    onClick={() => void handleSubmit()}
                    disabled={isSaving}
                >
                    {isSaving ? "Создаём..." : "Создать партию"}
                </Button>
                <Button
                    variant="text"
                    onClick={() => navigate("/containers")}
                    disabled={isSaving}
                >
                    Отмена
                </Button>
            </Stack>

            <Snackbar
                open={false}
                autoHideDuration={6000}
                onClose={() => undefined}
                message=""
            />
        </Box>
    );
}