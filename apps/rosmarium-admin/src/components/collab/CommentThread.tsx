import React, { useState } from "react";
import { Box, Typography, Button, TextField, List, ListItem, ListItemText, ListItemAvatar, Avatar } from "@mui/material";

export interface Comment {
    id: string;
    content: string;
    authorId: string;
    createdAt: string;
    resolved: boolean;
}

export interface CommentThreadProps {
    comments: Comment[];
    onAddComment: (content: string) => void;
    onResolve: (commentId: string) => void;
}

export const CommentThread: React.FC<CommentThreadProps> = ({ comments, onAddComment, onResolve }) => {
    const [newComment, setNewComment] = useState("");

    const handleSubmit = () => {
        if (!newComment.trim()) return;
        onAddComment(newComment);
        setNewComment("");
    };

    return (
        <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Typography variant="h6" gutterBottom>Comments</Typography>
            <List>
                {comments.map(c => (
                    <ListItem key={c.id} alignItems="flex-start" sx={{ px: 0 }}>
                        <ListItemAvatar>
                            <Avatar />
                        </ListItemAvatar>
                        <ListItemText 
                            primary={<Typography variant="body2" sx={{ fontWeight: 'bold' }}>User {c.authorId}</Typography>} 
                            secondary={
                                <React.Fragment>
                                    <Typography variant="body2" color="text.primary">{c.content}</Typography>
                                    <Typography variant="caption" color="text.secondary">{new Date(c.createdAt).toLocaleString()}</Typography>
                                </React.Fragment>
                            } 
                        />
                        {!c.resolved && (
                            <Button size="small" onClick={() => onResolve(c.id)}>Resolve</Button>
                        )}
                    </ListItem>
                ))}
            </List>
            <Box sx={{ mt: 2, display: 'flex', gap: 1 }}>
                <TextField 
                    size="small" 
                    fullWidth 
                    value={newComment} 
                    onChange={e => setNewComment(e.target.value)} 
                    placeholder="Add a comment..." 
                    onKeyPress={e => e.key === "Enter" && handleSubmit()}
                />
                <Button variant="contained" onClick={handleSubmit}>Send</Button>
            </Box>
        </Box>
    );
};
