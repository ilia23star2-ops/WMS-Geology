/**
 * Боковое меню (Drawer).
 *
 * Активный пункт: подсветка primary.main + белый текст.
 * На мобильном — закрывается после выбора пункта.
 *
 * c-2.x-shipments-1b: добавлен пункт «Отправка».
 * c-2.x-lab-portal-3: настройка видимости пунктов по ролям (ROLE_MENU_ACCESS).
 */
import {
    Box,
    Drawer,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Toolbar,
    Typography,
} from "@mui/material";
import HomeIcon from "@mui/icons-material/Home";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import BiotechIcon from "@mui/icons-material/Biotech";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SendIcon from "@mui/icons-material/Send";
import PrintIcon from "@mui/icons-material/Print";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentIcon from "@mui/icons-material/Assignment";
import VpnKeyIcon from "@mui/icons-material/VpnKey";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import { type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuthStore } from "../../stores/authStore";

export const DRAWER_WIDTH = 240;

interface MenuItem {
    label: string;
    path: string;
    icon: ReactElement;
}

const MENU: MenuItem[] = [
    { label: "Главная", path: "/", icon: <HomeIcon /> },
    { label: "Тара", path: "/containers", icon: <Inventory2Icon /> },
    { label: "Пробы", path: "/samples", icon: <BiotechIcon /> },
    { label: "Наряд-заказы", path: "/work-orders", icon: <AssignmentIcon /> },
    { label: "Отправка", path: "/shipments", icon: <SendIcon /> },
    { label: "Приёмка", path: "/receiving", icon: <LocalShippingIcon /> },
    { label: "Печать", path: "/print", icon: <PrintIcon /> },
    { label: "Топология", path: "/topology", icon: <AccountTreeIcon /> },
    { label: "Справочники", path: "/catalogs", icon: <MenuBookIcon /> },
    { label: "Коды доступа", path: "/settings/access-tokens", icon: <VpnKeyIcon /> },
    { label: "Офлайн-импорт", path: "/offline-import", icon: <CloudUploadIcon /> },
    { label: "Актуализация", path: "/actualization", icon: <FactCheckIcon /> },
];

/**
 * Настройка видимости пунктов меню по ролям.
 * Если роли нет в конфиге — показываются ВСЕ пункты.
 * Если роль есть — показываются только перечисленные пути.
 */
const ROLE_MENU_ACCESS: Record<string, string[]> = {
    lab_worker: [
        "/",
        "/containers",
        "/samples",
        "/work-orders",
        "/shipments",
        "/print"
    ],
    worker: [
        "/", 
        "/containers", 
        "/samples", 
        "/receiving", 
        "/shipments", 
        "/print", 
        "/topology",
        "/actualization"
    ]
};

interface DrawerContentProps {
    onNavigate: () => void;
}

function DrawerContent({ onNavigate }: DrawerContentProps) {
    const navigate = useNavigate();
    const location = useLocation();
    const user = useAuthStore((state) => state.user);
    const role = user?.role ?? "";

    const allowedPaths = ROLE_MENU_ACCESS[role];

    const visibleMenu = MENU.filter((item) => {
        if (!allowedPaths) return true; // если роли нет в конфиге — показываем всё
        return allowedPaths.includes(item.path);
    });

    function handleClick(path: string) {
        navigate(path);
        onNavigate();
    }

    return (
        <>
            <Toolbar>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700 }}>
                    WMS Geology
                </Typography>
            </Toolbar>
            <Box sx={{ overflow: "auto" }}>
                <List>
                    {visibleMenu.map((item) => {
                        const selected =
                            item.path === "/"
                                ? location.pathname === "/"
                                : location.pathname.startsWith(item.path);
                        return (
                            <ListItemButton
                                key={item.path}
                                selected={selected}
                                onClick={() => handleClick(item.path)}
                                sx={{
                                    "&.Mui-selected": {
                                        bgcolor: "primary.main",
                                        color: "primary.contrastText",
                                        "& .MuiListItemIcon-root": {
                                            color: "primary.contrastText",
                                        },
                                        "&:hover": {
                                            bgcolor: "primary.dark",
                                        },
                                    },
                                }}
                            >
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.label} />
                            </ListItemButton>
                        );
                    })}
                </List>
            </Box>
        </>
    );
}

interface SidebarProps {
    mobileOpen: boolean;
    onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
    return (
        <Box
            component="nav"
            sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        >
            <Drawer
                variant="temporary"
                open={mobileOpen}
                onClose={onMobileClose}
                ModalProps={{ keepMounted: true }}
                sx={{
                    display: { xs: "block", md: "none" },
                    "& .MuiDrawer-paper": {
                        boxSizing: "border-box",
                        width: DRAWER_WIDTH,
                    },
                }}
            >
                <DrawerContent onNavigate={onMobileClose} />
            </Drawer>

            <Drawer
                variant="permanent"
                open
                sx={{
                    display: { xs: "none", md: "block" },
                    "& .MuiDrawer-paper": {
                        boxSizing: "border-box",
                        width: DRAWER_WIDTH,
                    },
                }}
            >
                <DrawerContent onNavigate={() => { }} />
            </Drawer>
        </Box>
    );
}