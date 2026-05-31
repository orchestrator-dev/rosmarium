import React, { useState, useEffect } from 'react';
import { Select, MenuItem, SelectChangeEvent, FormControl, CircularProgress } from '@mui/material';

export const BranchSwitcher: React.FC = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [branches, setBranches] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentBranch, setCurrentBranch] = useState<string>('');

    useEffect(() => {
        const fetchBranches = async () => {
            try {
                // Fetch bypassing branch header to avoid circular logic, but it's safe anyway
                const res = await fetch('/api/branches');
                if (res.ok) {
                    const data = await res.json();
                    setBranches(data);
                }
            } catch (err) {
                console.error("Failed to fetch branches", err);
            } finally {
                setLoading(false);
            }
        };

        fetchBranches();
        
        const active = localStorage.getItem("rosmarium_branch_id") || "main";
        setCurrentBranch(active);
    }, []);

    const handleChange = (e: SelectChangeEvent) => {
        const val = e.target.value;
        if (val === "main") {
            localStorage.removeItem("rosmarium_branch_id");
        } else {
            localStorage.setItem("rosmarium_branch_id", val);
        }
        setCurrentBranch(val);
        // Reload to apply new branch context globally
        window.location.reload();
    };

    if (loading) return <CircularProgress size={20} />;

    return (
        <FormControl size="small" sx={{ minWidth: 120, ml: 2 }}>
            <Select
                value={currentBranch}
                onChange={handleChange}
                variant="outlined"
                sx={{ 
                    color: 'white', 
                    '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.3)' },
                    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'white' },
                    '.MuiSvgIcon-root': { color: 'white' }
                }}
            >
                <MenuItem value="main">
                    <em>main</em>
                </MenuItem>
                {branches.filter(b => b.status === "active").map((b) => (
                    <MenuItem key={b.id} value={b.id}>
                        {b.name}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );
};
