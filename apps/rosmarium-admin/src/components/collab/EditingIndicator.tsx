import React from "react";
import { Box, Typography } from "@mui/material";
import type { PresenceUser } from "./usePresence.js";

export interface EditingIndicatorProps {
    users: PresenceUser[];
    fieldId: string;
}

export const EditingIndicator: React.FC<EditingIndicatorProps> = ({ users, fieldId }) => {
    const editors = users.filter((u) => u.fieldId === fieldId);

    if (editors.length === 0) return null;

    return (
        <Box
            sx={{
                position: "absolute",
                top: -12,
                right: 8,
                backgroundColor: "warning.main",
                color: "warning.contrastText",
                px: 1,
                py: 0.25,
                borderRadius: 1,
                fontSize: "0.75rem",
                fontWeight: "bold",
                zIndex: 10,
                boxShadow: 1,
            }}
        >
            <Typography variant="caption">
                {editors.map((u) => u.name).join(", ")} {editors.length > 1 ? "are" : "is"} editing
            </Typography>
        </Box>
    );
};
