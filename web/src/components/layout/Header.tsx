/**
 * Верхняя панель (AppBar).
 *
 * Содержит: кнопку-гамбургер (моб.), название системы,
 * имя пользователя и кнопку выхода.
 */
import {
    AppBar,
    Box,
    Button,
    IconButton,
    Toolbar,
    Typography,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import LogoutIcon from "@mui/icons-material/Logout";
import { useNavigate } from "react-router-dom";

import { useAuthStore } from "../../stores/authStore";
import { DRAWER_WIDTH } from "./Sidebar";

interface HeaderProps {
    onMenuClick: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
    const navigate = useNavigate();
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);

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