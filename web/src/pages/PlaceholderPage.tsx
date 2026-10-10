/**
 * Заглушка для разделов, которые появятся в следующих заходах.
 */
import { Box, Typography } from "@mui/material";

interface PlaceholderPageProps {
    title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
    return (
        <Box>
            <Typography variant="h2" component="h1" gutterBottom>
                {title}
            </Typography>
            <Typography variant="body1" color="text.secondary">
                Раздел в разработке.
            </Typography>
        </Box>
    );
}