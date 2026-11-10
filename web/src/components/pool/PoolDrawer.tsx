import {
    Box, Button, Divider, Drawer, IconButton, List, ListItem,
    ListItemIcon, ListItemText, Typography, Stack
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ScienceIcon from "@mui/icons-material/Science";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";

import { usePool, useClearPool } from "../../api/pool";

interface PoolDrawerProps {
    open: boolean;
    onClose: () => void;
}

export default function PoolDrawer({ open, onClose }: PoolDrawerProps) {
    const { data: pool, isLoading } = usePool();
    const clearMutation = useClearPool();

    const items = pool?.items ?? [];
    const containers = items.filter((i) => i.container !== null);
    const samples = items.filter((i) => i.sample !== null);

    async function handleClear() {
        if (window.confirm("Очистить пул?")) {
            await clearMutation.mutateAsync();
        }
    }

    return (
        <Drawer anchor="right" open={open} onClose={onClose}>
            <Box sx={{ width: 350, display: "flex", flexDirection: "column", height: "100%" }}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", p: 2, bgcolor: "primary.main", color: "primary.contrastText" }}>
                    <Typography variant="h6">Пул (Корзина)</Typography>
                    <IconButton onClick={onClose} color="inherit">
                        <CloseIcon />
                    </IconButton>
                </Box>

                <Box sx={{ flexGrow: 1, overflowY: "auto", p: 2 }}>
                    {isLoading && <Typography>Загрузка...</Typography>}
                    {!isLoading && items.length === 0 && (
                        <Typography color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
                            Пул пуст. Добавьте тары или пробы на страницах реестров.
                        </Typography>
                    )}

                    {containers.length > 0 && (
                        <>
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Тары ({containers.length})</Typography>
                            <List dense disablePadding>
                                {containers.map((item) => {
                                    const label = [
                                        item.draft_work_order_coded || "Без Н/З",
                                        item.draft_research_type_name || "Без ТИ",
                                        item.container_number ? `№ ${item.container_number}` : `#${item.container}`
                                    ].join(" · ");
                                    return (
                                        <ListItem key={`c-${item.id}`}>
                                            <ListItemIcon><Inventory2Icon color="action" /></ListItemIcon>
                                            <ListItemText primary={label} />
                                        </ListItem>
                                    );
                                })}
                            </List>
                        </>
                    )}

                    {samples.length > 0 && (
                        <>
                            <Divider sx={{ my: 2 }} />
                            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>Пробы ({samples.length})</Typography>
                            <List dense disablePadding>
                                {samples.map((item) => (
                                    <ListItem key={`s-${item.id}`}>
                                        <ListItemIcon><ScienceIcon color="action" /></ListItemIcon>
                                        <ListItemText primary={item.sample_number || `Проба #${item.sample}`} />
                                    </ListItem>
                                ))}
                            </List>
                        </>
                    )}
                </Box>

                <Divider />
                <Stack spacing={2} sx={{ p: 2, bgcolor: "background.paper" }}>
                    {/* Место для будущих действий (выпадающий список действий) */}
                    <Button variant="contained" fullWidth disabled={items.length === 0}>
                        Применить действие
                    </Button>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteSweepIcon />}
                        onClick={() => void handleClear()}
                        disabled={items.length === 0 || clearMutation.isPending}
                    >
                        Очистить пул
                    </Button>
                </Stack>
            </Box>
        </Drawer>
    );
}