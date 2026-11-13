/**
 * Корневой компонент: роутинг + bootstrap auth + QueryClient.
 * ТД-21: Code-splitting (lazy-загрузка страниц).
 */
import { lazy, Suspense, useEffect } from "react";
import { Box, CircularProgress } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import MainLayout from "./components/layout/MainLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import { useAuthStore } from "./stores/authStore";
import OcrReviewPage from "./pages/OcrReviewPage";
import OcrBatchesPage from "./pages/OcrBatchesPage";
import OcrBatchDetailPage from "./pages/OcrBatchDetailPage";

// Ленивая загрузка страниц
const LoginPage = lazy(() => import("./pages/LoginPage"));
const HomePage = lazy(() => import("./pages/HomePage"));
const PoolPage = lazy(() => import("./pages/PoolPage"));
const ContainersPage = lazy(() => import("./pages/ContainersPage"));
const SamplesPage = lazy(() => import("./pages/SamplesPage"));
const ShipmentsPage = lazy(() => import("./pages/ShipmentsPage"));
const ShipmentDetailPage = lazy(() => import("./pages/ShipmentDetailPage"));
const ReceivingPage = lazy(() => import("./pages/ReceivingPage"));
const ReceiptCheckPage = lazy(() => import("./pages/ReceiptCheckPage"));
const PrintBatchesPage = lazy(() => import("./pages/PrintBatchesPage"));
const PrintBatchDetailPage = lazy(() => import("./pages/PrintBatchDetailPage"));
const TopologyPage = lazy(() => import("./pages/TopologyPage"));
const CatalogsPage = lazy(() => import("./pages/CatalogsPage"));
const WorkOrdersPage = lazy(() => import("./pages/WorkOrdersPage"));
const AccessTokensPage = lazy(() => import("./pages/AccessTokensPage"));
const OfflineImportPage = lazy(() => import("./pages/OfflineImportPage"));
const ActualizationPage = lazy(() => import("./pages/ActualizationPage"));

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
        <Suspense
            fallback={
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
            }
        >
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<ProtectedRoute />}>
                    <Route element={<MainLayout />}>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/pool" element={<PoolPage />} />
                        <Route path="/containers" element={<ContainersPage />} />
                        <Route path="/ocr/review/:id" element={<OcrReviewPage />} />
                        <Route path="/ocr/batches" element={<OcrBatchesPage />} />
                        <Route path="/ocr/batches/:id" element={<OcrBatchDetailPage />} />
                        <Route path="/samples" element={<SamplesPage />} />
                        <Route path="/shipments" element={<ShipmentsPage />} />
                        <Route
                            path="/shipments/:id"
                            element={<ShipmentDetailPage />}
                        />
                        <Route path="/receiving" element={<ReceivingPage />} />
                        <Route
                            path="/receiving/:id"
                            element={<ShipmentDetailPage />}
                        />
                        <Route
                            path="/receiving/:id/check"
                            element={<ReceiptCheckPage />}
                        />
                        <Route path="/print" element={<PrintBatchesPage />} />
                        <Route path="/print/:id" element={<PrintBatchDetailPage />} />
                        <Route path="/topology" element={<TopologyPage />} />
                        <Route path="/catalogs" element={<CatalogsPage />} />
                        <Route path="/work-orders" element={<WorkOrdersPage />} />
                        <Route path="/settings/access-tokens" element={<AccessTokensPage />} />
                        <Route path="/offline-import" element={<OfflineImportPage />} />
                        <Route path="/actualization" element={<ActualizationPage />} />
                    </Route>
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
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