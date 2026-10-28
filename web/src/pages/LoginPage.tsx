/**
 * Страница логина.
 *
 * Две вкладки:
 * - «Пароль» — username + password → authStore.login().
 * - «По коду» — одноразовый код (web_login) → codeLogin() → bootstrap().
 *
 * После успеха — редирект на "/" (или на from, если был редирект).
 */
import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Stack,
    Tab,
    Tabs,
    TextField,
    Typography,
} from "@mui/material";

import { useAuthStore } from "../stores/authStore";
import { codeLogin } from "../api";

interface LocationState {
    from?: string;
}

type TabKey = "password" | "code";

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState | null;
    const from = state?.from ?? "/";

    const { login, bootstrap, isLoading, error, clearError } = useAuthStore();

    const [tab, setTab] = useState<TabKey>("password");

    // Вкладка «Пароль»
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    // Вкладка «По коду»
    const [code, setCode] = useState("");
    const [codeError, setCodeError] = useState<string | null>(null);
    const [codeLoading, setCodeLoading] = useState(false);

    function handleTabChange(_e: React.SyntheticEvent, value: TabKey) {
        setTab(value);
        clearError();
        setCodeError(null);
    }

    async function handleSubmitPassword(event: FormEvent) {
        event.preventDefault();
        clearError();
        try {
            await login(username, password);
            navigate(from, { replace: true });
        } catch {
            // Ошибка уже в сторе.
        }
    }

    async function handleSubmitCode(event: FormEvent) {
        event.preventDefault();
        setCodeError(null);
        setCodeLoading(true);
        try {
            await codeLogin(code.trim());
            // codeLogin сохранил JWT в tokenStorage — bootstrap подхватит
            await bootstrap();
            navigate(from, { replace: true });
        } catch (err) {
            const anyErr = err as { response?: { data?: { error?: string; detail?: string } } };
            const msg =
                anyErr?.response?.data?.error
                ?? anyErr?.response?.data?.detail
                ?? "Не удалось войти по коду.";
            setCodeError(msg);
        } finally {
            setCodeLoading(false);
        }
    }

    return (
        <Box
            sx={{
                minHeight: "100vh",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "background.default",
            }}
        >
            <Card sx={{ width: 400 }}>
                <CardContent>
                    <Typography variant="h3" component="h1" gutterBottom>
                        WMS Geology
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
                        Вход в систему
                    </Typography>

                    <Tabs
                        value={tab}
                        onChange={handleTabChange}
                        sx={{ mb: 2, borderBottom: 1, borderColor: "divider" }}
                        variant="fullWidth"
                    >
                        <Tab value="password" label="Пароль" />
                        <Tab value="code" label="По коду" />
                    </Tabs>

                    {tab === "password" && (
                        <form onSubmit={handleSubmitPassword}>
                            <Stack spacing={2}>
                                <TextField
                                    label="Логин"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    autoFocus
                                    required
                                    fullWidth
                                    disabled={isLoading}
                                />
                                <TextField
                                    label="Пароль"
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    fullWidth
                                    disabled={isLoading}
                                />

                                {error && <Alert severity="error">{error}</Alert>}

                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={isLoading || !username || !password}
                                    startIcon={
                                        isLoading ? <CircularProgress size={18} color="inherit" /> : null
                                    }
                                >
                                    {isLoading ? "Входим..." : "Войти"}
                                </Button>
                            </Stack>
                        </form>
                    )}

                    {tab === "code" && (
                        <form onSubmit={handleSubmitCode}>
                            <Stack spacing={2}>
                                <Typography variant="body2" color="text.secondary">
                                    Введите одноразовый код, сгенерированный в разделе
                                    «Коды доступа». Код действует 15 минут.
                                </Typography>
                                <TextField
                                    label="Код"
                                    value={code}
                                    onChange={(e) => { setCode(e.target.value); setCodeError(null); }}
                                    autoFocus
                                    required
                                    fullWidth
                                    disabled={codeLoading}
                                    placeholder="41b0655c92f6be6afb91..."
                                    helperText="64 hex-символа (можно вставить целиком)"
                                    slotProps={{ htmlInput: { style: { fontFamily: "monospace", fontSize: 13 } } }}
                                />

                                {codeError && <Alert severity="error">{codeError}</Alert>}

                                <Button
                                    type="submit"
                                    variant="contained"
                                    size="large"
                                    disabled={codeLoading || !code.trim()}
                                    startIcon={
                                        codeLoading ? <CircularProgress size={18} color="inherit" /> : null
                                    }
                                >
                                    {codeLoading ? "Проверяем..." : "Войти по коду"}
                                </Button>
                            </Stack>
                        </form>
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}