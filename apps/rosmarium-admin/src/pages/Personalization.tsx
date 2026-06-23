import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';

export function Personalization() {
    const [segments, setSegments] = useState<any[]>([]);

    useEffect(() => {
        fetch('/api/personalization/segments')
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setSegments(data);
            })
            .catch(err => console.error(err));
    }, []);

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4">Personalization Segments</Typography>
                <Button variant="contained" color="primary">Create Segment</Button>
            </Box>

            <TableContainer component={Paper} variant="outlined">
                <Table>
                    <TableHead sx={{ bgcolor: 'rgba(0,0,0,0.02)' }}>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Conditions</TableCell>
                            <TableCell>Logic</TableCell>
                            <TableCell align="right">Priority</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {segments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                    <Typography color="text.secondary">No segments found. Create one to start personalizing content.</Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            segments.map((segment) => (
                                <TableRow key={segment.id} hover>
                                    <TableCell sx={{ fontWeight: 500 }}>{segment.name}</TableCell>
                                    <TableCell>{segment.description}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                            {segment.conditions?.map((c: any, i: number) => (
                                                <Chip key={i} size="small" label={`${c.trait} ${c.operator} ${c.value}`} />
                                            ))}
                                        </Box>
                                    </TableCell>
                                    <TableCell>{segment.logic.toUpperCase()}</TableCell>
                                    <TableCell align="right">{segment.priority}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}

export default Personalization;
