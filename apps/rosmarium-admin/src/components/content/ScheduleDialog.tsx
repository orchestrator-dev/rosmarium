import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Box,
    Typography
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

interface ScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    onSchedule: (date: Date, action: 'publish' | 'unpublish') => void;
    action: 'publish' | 'unpublish';
}

export const ScheduleDialog: React.FC<ScheduleDialogProps> = ({
    open,
    onClose,
    onSchedule,
    action
}) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());

    const handleConfirm = () => {
        if (selectedDate) {
            onSchedule(selectedDate, action);
            onClose();
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
            <DialogTitle>Schedule {action === 'publish' ? 'Publication' : 'Unpublication'}</DialogTitle>
            <DialogContent>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Select the exact date and time when this content should automatically be {action === 'publish' ? 'published' : 'unpublished'}.
                    </Typography>
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateTimePicker
                            label="Scheduled Time"
                            value={selectedDate}
                            onChange={(newValue) => setSelectedDate(newValue)}
                            sx={{ width: '100%' }}
                            disablePast
                        />
                    </LocalizationProvider>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button 
                    onClick={handleConfirm} 
                    variant="contained" 
                    disabled={!selectedDate || selectedDate < new Date()}
                >
                    Schedule
                </Button>
            </DialogActions>
        </Dialog>
    );
};
