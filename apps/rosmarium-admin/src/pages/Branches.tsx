import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from '@mui/material';

export default function Branches() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [branches, setBranches] = useState<any[]>([]);
    const [createOpen, setCreateOpen] = useState(false);
    const [newBranchName, setNewBranchName] = useState('');

    const fetchBranches = async () => {
        try {
            const res = await fetch('/api/branches');
            const data = await res.json();
            setBranches(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchBranches();
    }, []);

    const handleCreate = async () => {
        if (!newBranchName) return;
        try {
            const res = await fetch('/api/branches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newBranchName })
            });
            if (res.ok) {
                setCreateOpen(false);
                setNewBranchName('');
                fetchBranches();
            }
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
                <Typography variant="h4">Content Branches</Typography>
                <Button variant="contained" color="primary" onClick={() => setCreateOpen(true)}>
                    New Branch
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell>Merged At</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {branches.map(branch => (
                            <TableRow key={branch.id}>
                                <TableCell>{branch.name}</TableCell>
                                <TableCell>
                                    <Chip 
                                        label={branch.status} 
                                        color={branch.status === 'active' ? 'primary' : branch.status === 'merged' ? 'success' : 'default'}
                                    />
                                </TableCell>
                                <TableCell>{new Date(branch.createdAt).toLocaleString()}</TableCell>
                                <TableCell>{branch.mergedAt ? new Date(branch.mergedAt).toLocaleString() : '-'}</TableCell>
                                <TableCell>
                                    {branch.status === 'active' && (
                                        <Button size="small" onClick={() => window.location.href=`/settings/branches/${branch.id}/merge`}>
                                            Review & Merge
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Dialog open={createOpen} onClose={() => setCreateOpen(false)}>
                <DialogTitle>Create New Branch</DialogTitle>
                <DialogContent>
                    <TextField 
                        autoFocus
                        margin="dense"
                        label="Branch Name"
                        fullWidth
                        value={newBranchName}
                        onChange={(e) => setNewBranchName(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreate} color="primary" variant="contained">Create</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
