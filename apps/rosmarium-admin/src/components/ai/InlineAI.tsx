import React, { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText, CircularProgress, Typography } from '@mui/material';
import ShortTextIcon from '@mui/icons-material/ShortText';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import EditIcon from '@mui/icons-material/Edit';

interface InlineAIProps {
    anchorEl: HTMLElement | null;
    open: boolean;
    onClose: () => void;
    selectedText: string;
    onReplace: (newText: string) => void;
}

export const InlineAI: React.FC<InlineAIProps> = ({ anchorEl, open, onClose, selectedText, onReplace }) => {
    const [loading, setLoading] = useState(false);

    const handleRewrite = async (style: string) => {
        setLoading(true);
        try {
            const res = await fetch("/api/ai/rewrite", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: selectedText, style, stream: true })
            });
            
            const reader = res.body?.getReader();
            if (!reader) throw new Error("No readable stream");
            const decoder = new TextDecoder();
            let fullText = "";
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                const lines = chunk.split("\n").filter(line => line.startsWith("data: "));
                for (const line of lines) {
                    const dataStr = line.replace("data: ", "");
                    if (dataStr === "[DONE]") break;
                    try {
                        const data = JSON.parse(dataStr);
                        if (data.chunk) {
                            fullText += data.chunk;
                        }
                    } catch (e) {}
                }
            }
            onReplace(fullText);
            onClose();
        } catch (err: any) {
            console.error("AI rewrite error", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Menu anchorEl={anchorEl} open={open} onClose={onClose}>
            <MenuItem disabled={loading} onClick={() => handleRewrite('formal')}>
                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Make Formal</ListItemText>
            </MenuItem>
            <MenuItem disabled={loading} onClick={() => handleRewrite('casual')}>
                <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Make Casual</ListItemText>
            </MenuItem>
            <MenuItem disabled={loading} onClick={() => handleRewrite('expand')}>
                <ListItemIcon><FormatAlignJustifyIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Expand</ListItemText>
            </MenuItem>
            <MenuItem disabled={loading} onClick={() => handleRewrite('compress')}>
                <ListItemIcon><ShortTextIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Compress</ListItemText>
            </MenuItem>
            {loading && (
                <MenuItem disabled>
                    <CircularProgress size={20} sx={{ mr: 2 }} />
                    <Typography variant="body2">AI is thinking...</Typography>
                </MenuItem>
            )}
        </Menu>
    );
};
