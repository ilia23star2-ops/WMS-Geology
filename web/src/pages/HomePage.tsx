/**
 * Домашняя страница — дашборд (пока заглушка).
 */
import { Box, Card, CardContent, Typography } from "@mui/material";

import { useAuthStore } from "../stores/authStore";

export default function HomePage() {
    const user = useAuthStore((s) => s.user);

    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>
                Дашборд
            </Typography>
            <Card>
                <CardContent>
                    <Typography variant="body1" gutterBottom>
                        Привет, {user?.full_name || user?.username}!
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        {user?.role ? `Роль: ${user.role}.` : "Роль не назначена."}
                    </Typography>
                </CardContent>
            </Card>
        </Box>
    );
}