import React from 'react';
import { Box, Typography, Chip, IconButton } from '@mui/material';
import { DragIndicator as DragIcon, FolderOpen as FolderIcon, InsertDriveFile as FileIcon } from '@mui/icons-material';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface HierarchyNode {
    id: string;
    contentTypeId: string;
    data: Record<string, unknown>;
    children: HierarchyNode[];
}

interface TreeNodeProps {
    node: HierarchyNode;
    depth: number;
}

export function TreeNode({ node, depth }: TreeNodeProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: node.id, data: { node } });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const hasChildren = node.children && node.children.length > 0;
    const title = String(node.data?.title || node.data?.name || 'Untitled');

    return (
        <Box sx={{ pl: depth * 4, mb: 1 }}>
            <Box
                ref={setNodeRef}
                style={style}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    p: 1,
                    bgcolor: 'background.paper',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 1,
                    '&:hover': { bgcolor: 'action.hover' },
                }}
            >
                <IconButton
                    size="small"
                    {...attributes}
                    {...listeners}
                    sx={{ cursor: 'grab', mr: 1, color: 'text.secondary' }}
                >
                    <DragIcon fontSize="small" />
                </IconButton>
                {hasChildren ? <FolderIcon sx={{ mr: 1, color: 'primary.main' }} fontSize="small" /> : <FileIcon sx={{ mr: 1, color: 'text.secondary' }} fontSize="small" />}
                <Typography variant="body2" sx={{ flexGrow: 1, fontWeight: hasChildren ? 'bold' : 'normal' }}>
                    {title}
                </Typography>
                <Chip label={node.id.substring(0, 8)} size="small" variant="outlined" sx={{ mr: 1 }} />
            </Box>
            
            {hasChildren && (
                <Box sx={{ mt: 1 }}>
                    {node.children.map((child) => (
                        <TreeNode key={child.id} node={child} depth={depth + 1} />
                    ))}
                </Box>
            )}
        </Box>
    );
}
