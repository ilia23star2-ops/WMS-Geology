/**
 * Боковое меню (Drawer).
 *
 * Десктоп (md+): постоянный Drawer.
 * Мобильный (< md): временный (temporary) Drawer, открывается
 * кнопкой-гамбургером в Header.
 *
 * Активный пункт: явная подсветка через sx — primary.main + белый
 * текст, потому что MUI default (action.selected) слишком бледный.
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
import DashboardIcon from "@mui/icons-material/Dashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import BiotechIcon from "@mui/icons-material/Biotech";
import PrintIcon from "@mui/icons-material/Print";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import { type ReactElement } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export const DRAWER_WIDTH = 240;

interface MenuItem {
    label: string;
    path: string;
    icon: ReactElement;
}

const MENU: MenuItem[] = [
    { label: "Дашборд", path: "/", icon: <DashboardIcon /> },
    { label: "Тара", path: "/containers", icon: <Inventory2Icon /> },
    { label: "Пробы", path: "/samples", icon: <BiotechIcon /> },
    { label: "Печать", path: "/print", icon: <PrintIcon /> },
    { label: "Справочники", path: "/catalogs", icon: <MenuBookIcon /> },
];

interface SidebarProps {
    mobileOpen: boolean;
    onMobileClose: () => void;
}

function DrawerContent() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <>
            <Toolbar>
                <Typography variant="h3" component="div" sx={{ fontWeight: 700 }}>
                    WMS Geology
                </Typography>
            </Toolbar>
            <Box sx={{ overflow: "auto" }}>
                <List>
                    {MENU.map((item) => {
                        const selected =
                            item.path === "/"
                                ? location.pathname === "/"
                                : location.pathname.startsWith(item.path);
                        return (
                            <ListItemButton
                                key={item.path}
                                selected={selected}
                                onClick={() => navigate(item.path)}
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

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
    return (
        <Box
            component="nav"
            sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}
        >
            {/* Мобильный temporary Drawer */}
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
                <DrawerContent />
            </Drawer>

            {/* Десктопный постоянный Drawer */}
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
                <DrawerContent />
            </Drawer>
        </Box>
    );
}