/**
 * MUI-тема проекта.
 *
 * Цвета — из docs/UI.md (Material 3, seedColor = #1E3A5F).
 * Шрифты: Inter (основной), JetBrains Mono (моно).
 * Отступы: шаг 8 px (MUI theme.spacing по умолчанию).
 */
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
    palette: {
        primary: {
            main: "#1E3A5F",
        },
        secondary: {
            main: "#4A6572",
        },
        success: {
            main: "#2E7D32",
        },
        warning: {
            main: "#F57C00",
        },
        error: {
            main: "#C62828",
        },
        info: {
            main: "#0288D1",
        },
        background: {
            default: "#F5F5F5",
            paper: "#FFFFFF",
        },
        text: {
            primary: "#212121",
            secondary: "#757575",
        },
    },
    typography: {
        fontFamily: [
            "Inter",
            "Roboto",
            "-apple-system",
            "BlinkMacSystemFont",
            "Segoe UI",
            "sans-serif",
        ].join(","),
        h1: { fontSize: "28px", fontWeight: 600 },
        h2: { fontSize: "22px", fontWeight: 600 },
        h3: { fontSize: "18px", fontWeight: 600 },
        body1: { fontSize: "14px" },
        caption: { fontSize: "12px" },
    },
    shape: {
        borderRadius: 4,
    },
});