import React, { useState } from 'react';
import { Paper, Typography, TextField, Button, CircularProgress } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

interface AIAssistantProps {
    onGenerate: (content: string) => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({ onGenerate }) => {
    const [prompt, setPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleGenerate = async () => {
        if (!prompt) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/ai/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, stream: false })
            });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            onGenerate(data.result);
            setPrompt("");
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper elevation={3} sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2, borderRadius: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AutoAwesomeIcon color="primary" /> AI Assistant
            </Typography>
            <TextField 
                label="Ask AI to generate content..." 
                multiline 
                rows={3} 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                variant="outlined"
                fullWidth
            />
            {error && <Typography color="error" variant="body2">{error}</Typography>}
            <Button 
                variant="contained" 
                color="primary" 
                onClick={handleGenerate} 
                disabled={loading || !prompt}
                startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesomeIcon />}
            >
                Generate
            </Button>
        </Paper>
    );
};
