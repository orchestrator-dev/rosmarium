import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';

export default function MergePage() {
    const { id } = useParams();
    const navigate = useNavigate();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [diffData, setDiffData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [resolvedData] = useState<Record<string, Record<string, unknown>>>({});

    useEffect(() => {
        const fetchDiff = async () => {
            try {
                // Fetch bypassing branch header
                const res = await fetch(`/api/branches/${id}/diff`, { headers: { 'X-Branch-Id': '' } });
                const data = await res.json();
                setDiffData(data);
            } catch (err: unknown) {
                if (err instanceof Error) setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchDiff();
    }, [id]);

    const handleMerge = async () => {
        try {
            const res = await fetch(`/api/branches/${id}/merge`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Branch-Id': '' },
                body: JSON.stringify({ resolvedData })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || 'Failed to merge');
            navigate('/settings/branches');
            window.location.reload(); // reset branch
        } catch (err: unknown) {
            if (err instanceof Error) setError(err.message);
        }
    };

    if (loading) return <Typography>Loading diff...</Typography>;

    return (
        <Box>
            <Typography variant="h4" sx={{ mb: 2 }}>Merge Branch Review</Typography>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            
            {diffData?.conflicts?.length > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    Merge conflicts detected! You must resolve them before merging.
                </Alert>
            )}

            <TableContainer component={Paper} sx={{ mb: 4 }}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Entry ID</TableCell>
                            <TableCell>Action</TableCell>
                            <TableCell>Diff Info</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        {diffData?.diffs?.map((diff: any) => (
                            <TableRow key={diff.entryId}>
                                <TableCell>{diff.entryId}</TableCell>
                                <TableCell>{diff.action}</TableCell>
                                <TableCell>
                                    {diff.conflicts?.length > 0 ? (
                                        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                                        <Typography color="error">Conflicts in: {diff.conflicts.map((c: any) => c.field).join(', ')}</Typography>
                                    ) : (
                                        <Typography color="success.main">Clean merge</Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                        {diffData?.diffs?.length === 0 && (
                            <TableRow><TableCell colSpan={3}>No changes found.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <Button variant="contained" color="primary" onClick={handleMerge} disabled={diffData?.conflicts?.length > 0 && Object.keys(resolvedData).length === 0}>
                Confirm Merge
            </Button>
            <Button variant="outlined" sx={{ ml: 2 }} onClick={() => navigate('/settings/branches')}>
                Cancel
            </Button>
        </Box>
    );
}
