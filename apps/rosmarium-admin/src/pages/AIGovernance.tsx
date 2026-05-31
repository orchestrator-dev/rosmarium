import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, Grid, CircularProgress, Alert } from '@mui/material';

interface GovernanceMetrics {
    operationType: string;
    count: number;
    avgLatency: number;
    totalInputTokens: number;
    totalOutputTokens: number;
}

interface Budget {
    usage: number;
    budget: number;
    remaining: number;
    isExceeded: boolean;
    isWarning: boolean;
}

export const AIGovernance: React.FC = () => {
    const [metrics, setMetrics] = useState<GovernanceMetrics[]>([]);
    const [budget, setBudget] = useState<Budget | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await fetch("/api/ai/governance/dashboard");
                if (res.ok) {
                    const data = await res.json();
                    setMetrics(data.metrics || []);
                    setBudget(data.budget || null);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, []);

    if (loading) {
        return <Box sx={{ p: 4, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ p: 4 }}>
            <Typography variant="h4" gutterBottom>AI Governance Dashboard</Typography>
            
            {budget && (
                <Box sx={{ mb: 4 }}>
                    {budget.isExceeded && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            Tenant Token Budget Exceeded ({budget.usage} / {budget.budget})
                        </Alert>
                    )}
                    {budget.isWarning && !budget.isExceeded && (
                        <Alert severity="warning" sx={{ mb: 2 }}>
                            Token Usage Warning: 80% of budget reached.
                        </Alert>
                    )}
                    <Paper elevation={2} sx={{ p: 3 }}>
                        <Typography variant="h6">Token Budget</Typography>
                        <Typography variant="body1">Usage: {budget.usage} tokens</Typography>
                        <Typography variant="body1">Limit: {budget.budget} tokens</Typography>
                        <Typography variant="body1">Remaining: {budget.remaining} tokens</Typography>
                    </Paper>
                </Box>
            )}

            <Typography variant="h5" sx={{ mb: 2 }}>Operation Metrics</Typography>
            <Grid container spacing={3}>
                {metrics.map((m) => (
                    <Grid size={{ xs: 12, md: 4 }} key={m.operationType}>
                        <Paper elevation={2} sx={{ p: 3, height: '100%' }}>
                            <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                                {m.operationType}
                            </Typography>
                            <Box sx={{ mt: 2 }}>
                                <Typography variant="body2">Requests: {m.count}</Typography>
                                <Typography variant="body2">Input Tokens: {m.totalInputTokens || 0}</Typography>
                                <Typography variant="body2">Output Tokens: {m.totalOutputTokens || 0}</Typography>
                                <Typography variant="body2">Avg Latency: {Number(m.avgLatency).toFixed(2)}ms</Typography>
                            </Box>
                        </Paper>
                    </Grid>
                ))}
                {metrics.length === 0 && (
                    <Grid size={{ xs: 12 }}>
                        <Typography color="textSecondary">No AI operations logged yet.</Typography>
                    </Grid>
                )}
            </Grid>
        </Box>
    );
};
