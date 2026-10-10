/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite-конфиг: сборка + dev-сервер + Vitest.
// Proxy /api → backend (localhost:8000) для локальной разработки.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
            },
        },
    },
    test: {
        globals: true,
        environment: "node",
        setupFiles: [],
    },
});