import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Stack, CircularProgress } from '@mui/material';
import { WorkflowBuilder } from '../../components/workflow/WorkflowBuilder';

export function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<Array<{ id: string; name: string; isDefault: boolean; definition: { states: unknown[]; transitions: unknown[] } }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchWorkflows = async () => {
            try {
                const res = await fetch('/api/workflow');
                if (res.ok) {
                    const data = await res.json();
                    setWorkflows(data.data ?? data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchWorkflows();
    }, []);

    if (loading) return <CircularProgress />;

    return (
        <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                <Typography variant="h4">Workflows</Typography>
                <Button variant="contained" color="primary">Create Workflow</Button>
            </Box>

            {workflows.length === 0 ? (
                <Typography color="text.secondary">No workflows defined yet. Create one to get started.</Typography>
            ) : (
                <Stack spacing={4}>
                    {workflows.map(wf => (
                        <Paper key={wf.id} sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ mb: 2 }}>{wf.name} {wf.isDefault && "(Default)"}</Typography>
                            <Box sx={{ flex: 1 }}>
                                <WorkflowBuilder 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    initialStates={(wf.definition?.states as any) || []} 
                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                    initialTransitions={(wf.definition?.transitions as any) || []} 
                                />
                            </Box>
                        </Paper>
                    ))}
                </Stack>
            )}
        </Box>
    );
}
