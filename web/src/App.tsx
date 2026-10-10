/**
 * Корневой компонент: роутинг + bootstrap auth + QueryClient.
 */
import { useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import ContainersPage from "./pages/ContainersPage";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import PlaceholderPage from "./pages/PlaceholderPage";
import { useAuthStore } from "./stores/authStore";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
        },
    },
});

function AppRoutes() {
    const bootstrap = useAuthStore((s) => s.bootstrap);
    const isBootstrapping = useAuthStore((s) => s.isBootstrapping);

    useEffect(() => {
        void bootstrap();
    }, [bootstrap]);

    if (isBootstrapping) {
        return (
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
                <Route element={<MainLayout />}>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/containers" element={<ContainersPage />} />
                    <Route path="/samples" element={<PlaceholderPage title="Пробы" />} />
                    <Route path="/print" element={<PlaceholderPage title="Печать" />} />
                    <Route
                        path="/catalogs"
                        element={<PlaceholderPage title="Справочники" />}
                    />
                </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                <AppRoutes />
            </BrowserRouter>
        </QueryClientProvider>
    );
}