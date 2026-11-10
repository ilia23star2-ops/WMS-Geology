/**
 * Верхняя панель (AppBar).
 */
import {
    AppBar,
    Badge,
    Box,
    Button,
    IconButton,
    Toolbar,
    Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import ShoppingCartIcon from "@mui/icons-material/ShoppingCart";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../../stores/authStore";
import { usePool } from "../../api/pool";
import { DRAWER_WIDTH } from "./Sidebar";

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const { data: pool } = usePool();

    async function handleLogout() {
        await logout();
        navigate("/login", { replace: true });
    }

    return (
        <AppBar
            position="fixed"
            sx={{
                width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                ml: { md: `${DRAWER_WIDTH}px` },
            }}
        >
            <Toolbar>
                <IconButton
                    color="inherit"
                    edge="start"
                    onClick={onMenuClick}
                    sx={{ mr: 2, display: { md: "none" } }}
                    aria-label="Открыть меню"
                >
                    <MenuIcon />
                </IconButton>

                <Typography
                    variant="h3"
                    component="div"
                    sx={{ flexGrow: 1, fontWeight: 600 }}
                >
                    WMS Geology
                </Typography>

                <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <IconButton color="inherit" onClick={() => navigate("/pool")} title="Перейти в Пул (Корзина)">
                        <Badge badgeContent={pool?.items_count || 0} color="error">
                            <ShoppingCartIcon />
                        </Badge>
                    </IconButton>

                    {user && (
                        <Typography
                            variant="body1"
                            sx={{ display: { xs: "none", sm: "block" } }}
                        >
                            {user.full_name || user.username}
                            {user.role ? ` · ${user.role}` : ""}
                        </Typography>
                    )}
                    <Button
                        color="inherit"
                        onClick={() => void handleLogout()}
                        startIcon={<LogoutIcon />}
                    >
                        Выйти
                    </Button>
                </Box>
            </Toolbar>
        </AppBar>
    );
}