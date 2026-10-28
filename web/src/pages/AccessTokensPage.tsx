/**
 * Страница управления токенами доступа (3.x-offline-auth-c).
 *
 * - Список токенов (свои + созданные мной).
 * - Создание `web_login` (15 мин, одноразовый) / `offline` (14 часов).
 * - После создания — модалка с QR (`qr_svg` от backend) и raw токеном
 *   (показывается один раз).
 * - Отзыв активных токенов.
 */
import { useMemo, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    Snackbar,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Tooltip,
    Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import KeyIcon from "@mui/icons-material/VpnKey";
import BlockIcon from "@mui/icons-material/Block";

import {
    useAccessTokens,
    useCreateAccessToken,
    useRevokeAccessToken,
    type AccessToken,
    type AccessTokenCreateResponse,
    type AccessTokenPurpose,
} from "../api";

function formatDate(value: string | null): string {
    if (!value) return "—";
    try {
        return new Date(value).toLocaleString("ru-RU", {
            dateStyle: "short",
            timeStyle: "short",
        });
    } catch {
        return value;
    }
}

function statusChip(token: AccessToken) {
    if (token.revoked_at) return <Chip size="small" label="Отозван" color="error" variant="outlined" />;
    if (token.purpose === "web_login" && token.used_at) return <Chip size="small" label="Использован" color="default" variant="outlined" />;
    if (!token.is_active) return <Chip size="small" label="Истёк" color="warning" variant="outlined" />;
    return <Chip size="small" label="Активен" color="success" variant="outlined" />;
}

function purposeLabel(p: AccessTokenPurpose): string {
    return p === "web_login" ? "Вход в web" : "Офлайн";
}

export default function AccessTokensPage() {
    const tokensQuery = useAccessTokens();
    const createMutation = useCreateAccessToken();
    const revokeMutation = useRevokeAccessToken();

    const [createOpen, setCreateOpen] = useState(false);
    const [purpose, setPurpose] = useState<AccessTokenPurpose>("web_login");
    const [userId, setUserId] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);

    const [result, setResult] = useState<AccessTokenCreateResponse | null>(null);
    const [copyMessage, setCopyMessage] = useState<string | null>(null);

    const tokens = useMemo(() => tokensQuery.data ?? [], [tokensQuery.data]);

    function openCreate() {
        setPurpose("web_login");
        setUserId("");
        setCreateError(null);
        setCreateOpen(true);
    }

    async function handleCreate() {
        setCreateError(null);
        try {
            const created = await createMutation.mutateAsync({
                purpose,
                user_id: userId.trim() === "" ? null : Number(userId),
            });
            setCreateOpen(false);
            setResult(created);
        } catch (err) {
            const anyErr = err as { response?: { data?: { error?: string; detail?: string } } };
            const msg =
                anyErr?.response?.data?.error
                ?? anyErr?.response?.data?.detail
                ?? "Не удалось создать токен.";
            setCreateError(msg);
        }
    }

    async function handleRevoke(id: number) {
        const ok = window.confirm("Отозвать этот токен? Он перестанет работать сразу.");
        if (!ok) return;
        try {
            await revokeMutation.mutateAsync(id);
        } catch {
            alert("Не удалось отозвать токен.");
        }
    }

    async function copyToClipboard(text: string, label: string) {
        try {
            await navigator.clipboard.writeText(text);
            setCopyMessage(`${label} скопирован в буфер обмена.`);
        } catch {
            setCopyMessage("Не удалось скопировать — выделите вручную.");
        }
    }

    function handleCloseResult() {
        setResult(null);
    }

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h2" component="h1">
                    Коды доступа
                </Typography>
                <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
                    Создать токен
                </Button>
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
                <b>Вход в web</b> — одноразовый код на 15 минут (ввести на странице входа → вкладка «По коду»).
                <br />
                <b>Офлайн</b> — временный токен на 14 часов (одна смена) для мобильного приложения (сканировать QR в mobile).
            </Alert>

            {tokensQuery.isError && (
                <Alert severity="error" sx={{ mb: 2 }}>Не удалось загрузить список.</Alert>
            )}

            <Card>
                <CardContent sx={{ p: 0 }}>
                    {tokensQuery.isLoading ? (
                        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
                            <CircularProgress size={24} />
                        </Box>
                    ) : tokens.length === 0 ? (
                        <Box sx={{ p: 3 }}>
                            <Typography variant="body2" color="text.secondary">
                                Токенов пока нет. Нажмите «Создать токен».
                            </Typography>
                        </Box>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Пользователь</TableCell>
                                        <TableCell>Назначение</TableCell>
                                        <TableCell>Статус</TableCell>
                                        <TableCell>Создан</TableCell>
                                        <TableCell>Истекает</TableCell>
                                        <TableCell>Устройство</TableCell>
                                        <TableCell align="right">Действия</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {tokens.map((t) => (
                                        <TableRow key={t.id} hover>
                                            <TableCell>{t.username}</TableCell>
                                            <TableCell>{purposeLabel(t.purpose)}</TableCell>
                                            <TableCell>{statusChip(t)}</TableCell>
                                            <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(t.created_at)}</TableCell>
                                            <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(t.expires_at)}</TableCell>
                                            <TableCell>
                                                {t.device_id || <Typography variant="caption" color="text.disabled">—</Typography>}
                                            </TableCell>
                                            <TableCell align="right">
                                                {t.is_active && (
                                                    <Tooltip title="Отозвать">
                                                        <IconButton
                                                            size="small"
                                                            color="error"
                                                            disabled={revokeMutation.isPending}
                                                            onClick={() => void handleRevoke(t.id)}
                                                        >
                                                            <BlockIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Модалка создания */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                        <KeyIcon color="action" />
                        <span>Создать токен</span>
                    </Stack>
                </DialogTitle>
                <DialogContent>
                    {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}

                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Назначение</InputLabel>
                            <Select
                                label="Назначение"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value as AccessTokenPurpose)}
                            >
                                <MenuItem value="web_login">Вход в web (15 мин, одноразовый)</MenuItem>
                                <MenuItem value="offline">Офлайн (14 часов, mobile)</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            label="ID пользователя (опционально)"
                            size="small"
                            fullWidth
                            type="number"
                            value={userId}
                            onChange={(e) => setUserId(e.target.value)}
                            helperText="Пусто = для себя. Для других — только admin/manager."
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
                        Отмена
                    </Button>
                    <Button
                        variant="contained"
                        onClick={() => void handleCreate()}
                        disabled={createMutation.isPending}
                    >
                        {createMutation.isPending ? "Создаём..." : "Создать"}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Модалка результата — QR + raw_token один раз */}
            <Dialog open={result !== null} onClose={handleCloseResult} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {result?.purpose === "offline" ? "Офлайн-токен создан" : "Код для входа создан"}
                </DialogTitle>
                <DialogContent>
                    {result && (
                        <Stack spacing={2}>
                            <Alert severity="warning">
                                <b>Это единственный раз, когда показывается токен.</b>{" "}
                                Скопируйте или отсканируйте QR сейчас. Если потеряете — генерируйте новый.
                            </Alert>

                            <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                                <Box
                                    sx={{ width: 260, height: 260, "& svg": { width: "100%", height: "100%" } }}
                                    dangerouslySetInnerHTML={{ __html: result.qr_svg }}
                                />
                            </Box>

                            <Box>
                                <Typography variant="caption" color="text.secondary">
                                    Токен (raw):
                                </Typography>
                                <Stack direction="row" spacing={1} sx={{ alignItems: "flex-start", mt: 0.5 }}>
                                    <TextField
                                        value={result.raw_token}
                                        fullWidth
                                        size="small"
                                        slotProps={{
                                            htmlInput: {
                                                readOnly: true,
                                                style: { fontFamily: "monospace", fontSize: 12 },
                                            },
                                        }}
                                    />
                                    <Tooltip title="Скопировать">
                                        <IconButton
                                            onClick={() => void copyToClipboard(result.raw_token, "Токен")}
                                        >
                                            <ContentCopyIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Stack>
                            </Box>

                            <Typography variant="caption" color="text.secondary">
                                Для пользователя <b>{result.username}</b>. Истекает: {formatDate(result.expires_at)}.
                            </Typography>
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseResult} variant="contained">Готово</Button>
                </DialogActions>
            </Dialog>

            <Snackbar
                open={copyMessage !== null}
                autoHideDuration={3000}
                onClose={() => setCopyMessage(null)}
                message={copyMessage ?? ""}
            />
        </Box>
    );
}