import React, { useState } from "react";
import { Box, IconButton, Popover, Badge } from "@mui/material";
import { ChatBubbleOutlined as ChatBubbleOutlineIcon } from "@mui/icons-material";
import { CommentThread, Comment } from "./CommentThread.js";

export interface InlineCommentProps {
    fieldId: string;
    comments: Comment[];
    onAddComment: (content: string) => void;
    onResolve: (commentId: string) => void;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const InlineComment: React.FC<InlineCommentProps> = ({ comments, onAddComment, onResolve }) => {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);
    const unresolvedCount = comments.filter(c => !c.resolved).length;

    return (
        <Box sx={{ display: 'inline-flex', ml: 1, verticalAlign: 'middle' }}>
            <IconButton size="small" onClick={handleClick}>
                <Badge badgeContent={unresolvedCount} color="error">
                    <ChatBubbleOutlineIcon fontSize="small" />
                </Badge>
            </IconButton>
            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
            >
                <Box sx={{ width: 300 }}>
                    <CommentThread comments={comments} onAddComment={onAddComment} onResolve={onResolve} />
                </Box>
            </Popover>
        </Box>
    );
};
