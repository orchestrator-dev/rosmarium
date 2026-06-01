import React, { useEffect, useState } from "react";
import { Box, Typography, Card, CardContent, CircularProgress, Chip, Stack } from "@mui/material";

export function GovernancePage() {
    const [stats, setStats] = useState<{ freshnessScore: number; outdatedCount: number; total: number } | null>(null);
    const [rotItems, setRotItems] = useState<Array<{ id: string; reasons: string[] }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch("/api/governance/stats").then(res => res.json()),
            fetch("/api/governance/rot").then(res => res.json())
        ]).then(([statsRes, rotRes]) => {
            setStats(statsRes);
            setRotItems(Array.isArray(rotRes) ? rotRes : []);
        }).finally(() => setLoading(false));
    }, []);

    if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

    return (
        <Box sx={{ p: 4 }}>
            <Typography variant="h4" sx={{ mb: 4 }}>Content Governance Dashboard</Typography>

            <Stack direction="row" spacing={3} sx={{ mb: 4 }}>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography color="textSecondary" gutterBottom>Freshness Score</Typography>
                        <Typography variant="h3">{stats?.freshnessScore?.toFixed(1) || 0}%</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography color="textSecondary" gutterBottom>Outdated Content</Typography>
                        <Typography variant="h3">{stats?.outdatedCount || 0}</Typography>
                    </CardContent>
                </Card>
                <Card sx={{ flex: 1 }}>
                    <CardContent>
                        <Typography color="textSecondary" gutterBottom>Total Content</Typography>
                        <Typography variant="h3">{stats?.total || 0}</Typography>
                    </CardContent>
                </Card>
            </Stack>

            <Typography variant="h5" sx={{ mb: 2 }}>ROT Content (Redundant, Outdated, Trivial)</Typography>
            <Stack spacing={2}>
                {rotItems.length === 0 ? (
                    <Typography>No ROT content found. Great job!</Typography>
                ) : (
                    rotItems.map((item) => (
                        <Card key={item.id}>
                            <CardContent>
                                <Typography variant="h6">Entry ID: {item.id}</Typography>
                                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                                    {item.reasons.map((r: string) => (
                                        <Chip key={r} label={r} color="warning" size="small" />
                                    ))}
                                </Stack>
                            </CardContent>
                        </Card>
                    ))
                )}
            </Stack>
        </Box>
    );
}
