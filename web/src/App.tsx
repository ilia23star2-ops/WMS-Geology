/**
 * Корневой компонент приложения.
 *
 * Пока — заглушка. Роутинг, layout, sidebar — в следующих заходах.
 */
import { Box, Container, Typography } from "@mui/material";

export default function App() {
    return (
        <Container maxWidth="md">
            <Box sx={{ mt: 8, textAlign: "center" }}>
                <Typography variant="h1" component="h1" gutterBottom>
                    WMS Geology
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Веб-приложение. Стартовая страница.
                </Typography>
            </Box>
        </Container>
    );
}