/**
 * Страница офлайн-импорта (3.x-offline-sync-d-1).
 *
 * Загрузить JSON-файл от mobile → POST /offline-imports/ →
 * результат: applied / conflicts / tasks_created / errors.
 */
import { useRef, useState } from "react";
import {
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Divider,
    Stack,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";

import {
    useOfflineImport,
    type OfflineExport,
    type OfflineImportResponse,
} from "../api";

export default function OfflineImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [payload, setPayload] = useState<OfflineExport | null>(null);
    const [parseError, setParseError] = useState<string | null>(null);
    const [result, setResult] = useState<OfflineImportResponse | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const importMutation = useOfflineImport();

    function reset() {
        setFile(null);
        setPayload(null);
        setParseError(null);
        setResult(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        setParseError(null);
        setPayload(null);
        setResult(null);
        const f = e.target.files?.[0] ?? null;
        setFile(f);
        if (!f) return;

        try {
            const text = await f.text();
            const json = JSON.parse(text) as OfflineExport;
            setPayload(json);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "Невалидный JSON.";
            setParseError(`Не удалось прочитать файл: ${msg}`);
        }
    }

    async function handleImport() {
        if (!payload) return;
        setResult(null);
        setParseError(null);
        try {
            const data = await importMutation.mutateAsync(payload);
            setResult(data);
        } catch (err) {
            const anyErr = err as {
                response?: { data?: { error?: string; detail?: string } };
            };
            const msg =
                anyErr?.response?.data?.error
                ?? anyErr?.response?.data?.detail
                ?? "Не удалось применить импорт.";
            setParseError(msg);
        }
    }

    return (
        <Box>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
                <Typography variant="h2" component="h1">
                    Офлайн-импорт
                </Typography>
                {(file || result || parseError) && (
                    <Button startIcon={<RefreshIcon />} onClick={reset}>
                        Сбросить
                    </Button>
                )}
            </Box>

            <Alert severity="info" sx={{ mb: 2 }}>
                Загрузите JSON-файл, экспортированный с мобильного устройства
                (офлайн-режим). Сервер применит операции и создаст задачи на
                актуализацию при расхождениях.
            </Alert>

            <Card sx={{ mb: 2 }}>
                <CardContent>
                    <Stack spacing={2}>
                        <Box>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".json,application/json"
                                style={{ display: "none" }}
                                onChange={(e) => void handleFileChange(e)}
                            />
                            <Button
                                variant="outlined"
                                startIcon={<UploadFileIcon />}
                                onClick={() => fileInputRef.current?.click()}
                                disabled={importMutation.isPending}
                            >
                                Выбрать файл
                            </Button>
                            {file && (
                                <Typography
                                    variant="body2"
                                    component="span"
                                    sx={{ ml: 2, color: "text.secondary" }}
                                >
                                    {file.name} ({Math.round(file.size / 1024)} KB)
                                </Typography>
                            )}
                        </Box>

                        {parseError && <Alert severity="error">{parseError}</Alert>}

                        {payload && !parseError && (
                            <Alert severity="success">
                                Файл прочитан. Формат: <b>{payload.format}</b>,
                                версия: <b>{payload.version}</b>, операций:{" "}
                                <b>{payload.operations.length}</b>
                                {payload.device_id && `, устройство: ${payload.device_id}`}
                            </Alert>
                        )}

                        <Box>
                            <Button
                                variant="contained"
                                startIcon={
                                    importMutation.isPending
                                        ? <CircularProgress size={18} color="inherit" />
                                        : <PlayArrowIcon />
                                }
                                disabled={!payload || importMutation.isPending}
                                onClick={() => void handleImport()}
                            >
                                {importMutation.isPending ? "Импортируем..." : "Импортировать"}
                            </Button>
                        </Box>
                    </Stack>
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardContent>
                        <Typography variant="h3" component="h2" gutterBottom>
                            Результат импорта
                        </Typography>

                        <Stack direction="row" spacing={3} sx={{ mb: 2, flexWrap: "wrap", rowGap: 1 }}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <CheckCircleIcon color="success" />
                                <Typography>
                                    Принято операций: <b>{result.applied}</b>
                                </Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <WarningAmberIcon color={result.conflicts > 0 ? "warning" : "disabled"} />
                                <Typography>
                                    Конфликтов: <b>{result.conflicts}</b>
                                </Typography>
                            </Box>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <WarningAmberIcon color={result.tasks_created > 0 ? "warning" : "disabled"} />
                                <Typography>
                                    Создано задач на актуализацию: <b>{result.tasks_created}</b>
                                </Typography>
                            </Box>
                        </Stack>

                        {result.tasks_created > 0 && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                Созданы задачи на актуализацию. Перейдите в раздел
                                «Актуализация», чтобы разобрать расхождения.
                            </Alert>
                        )}

                        {result.errors.length > 0 && (
                            <>
                                <Divider sx={{ my: 2 }} />
                                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                                    Ошибки ({result.errors.length})
                                </Typography>
                                <TableContainer sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}>
                                    <Table size="small">
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ width: 200 }}>op_id</TableCell>
                                                <TableCell>Ошибка</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {result.errors.map((e, idx) => (
                                                <TableRow key={`${e.op_id ?? "?"}-${idx}`}>
                                                    <TableCell sx={{ fontFamily: "monospace", fontSize: 12 }}>
                                                        {e.op_id ?? "—"}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: 13 }}>
                                                        {e.error}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </>
                        )}

                        {result.errors.length === 0 && result.conflicts === 0 && (
                            <Alert severity="success">
                                Все операции применены без конфликтов.
                            </Alert>
                        )}
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}