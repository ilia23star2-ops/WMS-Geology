/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite-конфиг: сборка + dev-сервер + Vitest.
// Proxy /api и /media → backend (localhost:8000).
//
// c-3.x-migration-5b: добавлен /media, иначе <img src="/media/...">
// на странице OCR-проверки уходит в 404 на 5173.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:8000",
                changeOrigin: true,
            },
            "/media": {
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