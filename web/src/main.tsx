/**
 * Точка входа приложения.
 *
 * - Обёртка MUI ThemeProvider (тема из theme/theme.ts).
 * - CssBaseline для сброса стилей браузера.
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";

import App from "./App";
import { theme } from "./theme/theme";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <App />
        </ThemeProvider>
    </React.StrictMode>,
);