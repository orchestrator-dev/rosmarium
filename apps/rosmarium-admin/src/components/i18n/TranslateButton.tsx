import React, { useState } from 'react';
import { Button, CircularProgress, Menu, MenuItem } from '@mui/material';
import TranslateIcon from '@mui/icons-material/Translate';

interface TranslateButtonProps {
    textToTranslate: string;
    onTranslated: (newText: string) => void;
}

export const TranslateButton: React.FC<TranslateButtonProps> = ({ textToTranslate, onTranslated }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [loading, setLoading] = useState(false);

    const languages = [
        { code: 'es', name: 'Spanish' },
        { code: 'fr', name: 'French' },
        { code: 'de', name: 'German' },
        { code: 'ja', name: 'Japanese' }
    ];

    const handleTranslate = async (lang: string) => {
        setAnchorEl(null);
        setLoading(true);
        try {
            const res = await fetch("/api/ai/translate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: textToTranslate, targetLanguage: lang })
            });
            if (!res.ok) throw new Error("Translation failed");
            const data = await res.json();
            onTranslated(data.result);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Button
                variant="outlined"
                startIcon={loading ? <CircularProgress size={20} /> : <TranslateIcon />}
                onClick={(e) => setAnchorEl(e.currentTarget)}
                disabled={loading || !textToTranslate}
            >
                Translate
            </Button>
            <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
                {languages.map(lang => (
                    <MenuItem key={lang.code} onClick={() => handleTranslate(lang.name)}>
                        Translate to {lang.name}
                    </MenuItem>
                ))}
            </Menu>
        </>
    );
};
