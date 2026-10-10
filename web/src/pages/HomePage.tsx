/**
 * Главная страница — 4 карточки со счётчиками.
 */
import {
    Card,
    CardActionArea,
    CardContent,
    Grid,
    Typography,
} from "@mui/material";
import { useNavigate } from "react-router-dom";

import {
    useContainersCount,
    usePendingPlacementCount,
    usePrintBatchesCount,
    useSamplesCount,
} from "../api/dashboard";
import { useAuthStore } from "../stores/authStore";

interface StatCardProps {
    title: string;
    value: number | undefined;
    isLoading: boolean;
    hint?: string;
    onClick?: () => void;
}

function StatCard({ title, value, isLoading, hint, onClick }: StatCardProps) {
    const content = (
        <CardContent>
            <Typography variant="body1" color="text.secondary" gutterBottom>
                {title}
            </Typography>
            <Typography variant="h1" component="div" sx={{ fontWeight: 600 }}>
                {isLoading ? "—" : (value ?? 0)}
            </Typography>
            {hint && (
                <Typography variant="caption" color="text.secondary">
                    {hint}
                </Typography>
            )}
        </CardContent>
    );

    return (
        <Card>
            {onClick ? <CardActionArea onClick={onClick}>{content}</CardActionArea> : content}
        </Card>
    );
}

export default function HomePage() {
    const user = useAuthStore((s) => s.user);
    const navigate = useNavigate();

    const containers = useContainersCount();
    const samples = useSamplesCount();
    const pending = usePendingPlacementCount();
    const batches = usePrintBatchesCount();

    return (
        <>
            <Typography variant="h2" component="h1" gutterBottom>
                Здравствуйте, {user?.full_name || user?.username}!
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                {user?.role ? `Роль: ${user.role}.` : "Роль не назначена."}
            </Typography>

            <Grid container spacing={3}>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="Тара"
                        value={containers.data}
                        isLoading={containers.isLoading}
                        onClick={() => navigate("/containers")}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="Пробы"
                        value={samples.data}
                        isLoading={samples.isLoading}
                        onClick={() => navigate("/samples")}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="Ожидает размещения"
                        value={pending.data}
                        isLoading={pending.isLoading}
                        onClick={() => navigate("/containers")}
                    />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <StatCard
                        title="Партии печати"
                        value={batches.data}
                        isLoading={batches.isLoading}
                        onClick={() => navigate("/print")}
                    />
                </Grid>
            </Grid>
        </>
    );
}