/**
 * Страница логина.
 *
 * Форма MUI: username + password. По сабмиту — authStore.login().
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
    TextField,
    Typography,
} from "@mui/material";

import { useAuthStore } from "../stores/authStore";

interface LocationState {
    from?: string;
}

export default function LoginPage() {
    const navigate = useNavigate();
    const location = useLocation();
    const state = location.state as LocationState | null;
    const from = state?.from ?? "/";

    const { login, isLoading, error, clearError } = useAuthStore();

    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");

    async function handleSubmit(event: FormEvent) {
        event.preventDefault();
        clearError();
        try {
            await login(username, password);
            navigate(from, { replace: true });
        } catch {
            // Ошибка уже в сторе.
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
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        Вход в систему
                    </Typography>

                    <form onSubmit={handleSubmit}>
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
                </CardContent>
            </Card>
        </Box>
    );
}