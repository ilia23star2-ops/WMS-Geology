/**
 * Основной layout: sidebar + header + область контента (Outlet).
 */
import { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import { Outlet } from "react-router-dom";

import Header from "./Header";
import Sidebar, { DRAWER_WIDTH } from "./Sidebar";

export default function MainLayout() {
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <Box sx={{ display: "flex", minHeight: "100vh" }}>
            <Header onMenuClick={() => setMobileOpen((v) => !v)} />
            <Sidebar
                mobileOpen={mobileOpen}
                onMobileClose={() => setMobileOpen(false)}
            />
            <Box
                component="main"
                sx={{
                    flexGrow: 1,
                    p: 3,
                    width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
                    bgcolor: "background.default",
                    minHeight: "100vh",
                }}
            >
                <Toolbar />
                <Outlet />
            </Box>
        </Box>
    );
}