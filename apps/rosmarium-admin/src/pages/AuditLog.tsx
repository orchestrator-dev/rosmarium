import React, { useEffect, useState } from "react";
import { Box, Typography, Button, CircularProgress, Table, TableHead, TableRow, TableCell, TableBody, Paper, TableContainer } from "@mui/material";

export function AuditLogPage() {
    const [logs, setLogs] = useState<Array<{ id: string; createdAt: string; userId: string; action: string; resourceId: string }>>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/audit")
            .then(res => res.json())
            .then(data => {
                if (Array.isArray(data)) setLogs(data);
            })
            .finally(() => setLoading(false));
    }, []);

    const handleExport = () => {
        window.open("/api/audit/export?format=csv", "_blank");
    };

    if (loading) return <Box sx={{ p: 4 }}><CircularProgress /></Box>;

    return (
        <Box sx={{ p: 4 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 4 }}>
                <Typography variant="h4">Audit Log</Typography>
                <Button variant="contained" onClick={handleExport}>Export CSV</Button>
            </Box>
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Time</TableCell>
                            <TableCell>User ID</TableCell>
                            <TableCell>Action</TableCell>
                            <TableCell>Resource ID</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {logs.map((log) => (
                            <TableRow key={log.id}>
                                <TableCell>{new Date(log.createdAt).toLocaleString()}</TableCell>
                                <TableCell>{log.userId || "System"}</TableCell>
                                <TableCell>{log.action}</TableCell>
                                <TableCell>{log.resourceId || "N/A"}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
