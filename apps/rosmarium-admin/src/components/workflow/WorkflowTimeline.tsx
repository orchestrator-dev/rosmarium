import React, { useEffect, useState } from 'react';
import { Typography, CircularProgress, Paper } from '@mui/material';
import Timeline from '@mui/lab/Timeline';
import TimelineItem, { timelineItemClasses } from '@mui/lab/TimelineItem';
import TimelineSeparator from '@mui/lab/TimelineSeparator';
import TimelineConnector from '@mui/lab/TimelineConnector';
import TimelineContent from '@mui/lab/TimelineContent';
import TimelineDot from '@mui/lab/TimelineDot';

interface WorkflowHistoryItem {
    id: string;
    fromState: string | null;
    toState: string;
    transitionLabel: string | null;
    comment: string | null;
    performedBy: string;
    performedAt: string;
}

interface WorkflowTimelineProps {
    entryId: string;
}

export const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({ entryId }) => {
    const [history, setHistory] = useState<WorkflowHistoryItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        const fetchHistory = async () => {
            try {
                const res = await fetch(`/api/workflow/history/${entryId}`);
                if (!res.ok) throw new Error("Failed to load workflow history");
                const data = await res.json();
                if (!cancelled) setHistory(data.data ?? []);
            } catch (err) {
                if (!cancelled) setError(err instanceof Error ? err.message : "Error");
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        if (entryId) fetchHistory();
        return () => { cancelled = true; };
    }, [entryId]);

    if (loading) return <CircularProgress size={24} />;
    if (error) return <Typography color="error" variant="body2">{error}</Typography>;
    if (history.length === 0) return <Typography variant="body2" color="text.secondary">No workflow history yet.</Typography>;

    return (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>Workflow History</Typography>
            <Timeline sx={{
                [`& .${timelineItemClasses.root}:before`]: {
                    flex: 0,
                    padding: 0,
                },
            }}>
                {history.map((item, index) => (
                    <TimelineItem key={item.id}>
                        <TimelineSeparator>
                            <TimelineDot color={index === 0 ? "primary" : "grey"} />
                            {index < history.length - 1 && <TimelineConnector />}
                        </TimelineSeparator>
                        <TimelineContent>
                            <Typography variant="body2">
                                Changed to <strong>{item.toState}</strong> via <em>{item.transitionLabel || 'Manual'}</em>
                            </Typography>
                            {item.comment && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    "{item.comment}"
                                </Typography>
                            )}
                            <Typography variant="caption" color="text.disabled">
                                {new Date(item.performedAt).toLocaleString()}
                            </Typography>
                        </TimelineContent>
                    </TimelineItem>
                ))}
            </Timeline>
        </Paper>
    );
};
