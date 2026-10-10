/**
 * Домашняя страница (заглушка). После bundle-4 — дашборд.
 */
import { Box, Button, Container, Stack, Typography } from "@mui/material";

import { useAuthStore } from "../stores/authStore";

export default function HomePage() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

    return (
        <Container maxWidth="md">
            <Box sx={{ mt: 8 }}>
                <Stack spacing={2}>
                    <Typography variant="h1" component="h1">
                        WMS Geology
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Привет, {user?.full_name || user?.username}!{" "}
                        {user?.role ? `Роль: ${user.role}.` : "Роль не назначена."}
                    </Typography>
                    <Box>
                        <Button variant="outlined" onClick={() => void logout()}>
                            Выйти
                        </Button>
                    </Box>
                </Stack>
            </Box>
        </Container>
    );
}