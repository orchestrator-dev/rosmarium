import React, { useState } from 'react';
import { Box, Paper, Button, Stack, Typography, CircularProgress, IconButton, Tooltip, Collapse, Snackbar, Alert } from '@mui/material';
import { Publish as PublishIcon, Delete as DeleteIcon, Archive as ArchiveIcon, AutoAwesome as AutoAwesomeIcon, Undo as UndoIcon, Close as CloseIcon } from '@mui/icons-material';

interface BulkActionBarProps {
    selectedIds: string[];
    onClearSelection: () => void;
    onActionComplete: () => void;
}

export function BulkActionBar({ selectedIds, onClearSelection, onActionComplete }: BulkActionBarProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (selectedIds.length === 0) return null;

    const handleAction = async (action: string) => {
        if (action === 'delete' && !window.confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`/api/content/bulk/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ entryIds: selectedIds }),
            });
            const data = await res.json() as { data?: { successCount: number; errors: string[] }, error?: string };
            
            if (res.ok && data.data && data.data.errors.length === 0) {
                onClearSelection();
                onActionComplete();
            } else {
                setError(data.error || data.data?.errors.join(', ') || 'Failed to complete action');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Collapse in={selectedIds.length > 0}>
                <Paper
                    elevation={4}
                    sx={{
                        position: 'fixed',
                        bottom: 32,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        px: 3,
                        py: 2,
                        borderRadius: 3,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        zIndex: 1200,
                        backgroundColor: 'background.paper',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            {selectedIds.length} selected
                        </Typography>
                        <Tooltip title="Clear selection">
                            <IconButton size="small" onClick={onClearSelection} disabled={loading}>
                                <CloseIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Box>
                    <Box sx={{ width: 1, height: 24, bgcolor: 'divider', mx: 1 }} />
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <Button
                            size="small"
                            variant="text"
                            color="success"
                            startIcon={<PublishIcon />}
                            onClick={() => void handleAction('publish')}
                            disabled={loading}
                        >
                            Publish
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            color="warning"
                            startIcon={<UndoIcon />}
                            onClick={() => void handleAction('unpublish')}
                            disabled={loading}
                        >
                            Unpublish
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            color="info"
                            startIcon={<ArchiveIcon />}
                            onClick={() => void handleAction('archive')}
                            disabled={loading}
                        >
                            Archive
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            color="secondary"
                            startIcon={<AutoAwesomeIcon />}
                            onClick={() => void handleAction('tag')}
                            disabled={loading}
                        >
                            Auto-Tag
                        </Button>
                        <Button
                            size="small"
                            variant="text"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => void handleAction('delete')}
                            disabled={loading}
                        >
                            Delete
                        </Button>
                        {loading && <CircularProgress size={20} sx={{ ml: 2 }} />}
                    </Stack>
                </Paper>
            </Collapse>
            
            <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError(null)}>
                <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
                    {error}
                </Alert>
            </Snackbar>
        </>
    );
}
