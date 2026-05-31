import React from "react";
import { Avatar, AvatarGroup, Tooltip } from "@mui/material";
import type { PresenceUser } from "./usePresence.js";

export interface PresenceAvatarsProps {
    users: PresenceUser[];
    max?: number;
}

export const PresenceAvatars: React.FC<PresenceAvatarsProps> = ({ users, max = 4 }) => {
    if (users.length === 0) return null;

    return (
        <AvatarGroup max={max} sx={{ '& .MuiAvatar-root': { width: 32, height: 32, fontSize: '0.875rem' } }}>
            {users.map((user) => (
                <Tooltip key={user.userId} title={user.name}>
                    <Avatar alt={user.name} src={user.avatarUrl}>
                        {user.name.charAt(0).toUpperCase()}
                    </Avatar>
                </Tooltip>
            ))}
        </AvatarGroup>
    );
};
