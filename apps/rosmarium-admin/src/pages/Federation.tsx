import React, { useState, useEffect } from "react";
import { 
    Box, Typography, Button, Paper, Table, TableBody, 
    TableCell, TableContainer, TableHead, TableRow, Chip
} from "@mui/material";

export const Federation = () => {
    const [sources, setSources] = useState<any[]>([]);

    useEffect(() => {
        fetch("/api/federation/sources")
            .then(res => res.json())
            .then(data => setSources(data))
            .catch(console.error);
    }, []);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h4" component="h1">
                    Content Federation
                </Typography>
                <Button variant="contained" color="primary">
                    Add Remote Source
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Endpoint</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sources.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    No remote sources configured.
                                </TableCell>
                            </TableRow>
                        ) : (
                            sources.map((source) => (
                                <TableRow key={source.id}>
                                    <TableCell font-weight="bold">{source.name}</TableCell>
                                    <TableCell>
                                        <Chip label={source.type} size="small" />
                                    </TableCell>
                                    <TableCell>{source.endpoint}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={source.status} 
                                            color={source.status === 'active' ? 'success' : 'default'}
                                            size="small" 
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Button size="small">Edit</Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

export default Federation;
