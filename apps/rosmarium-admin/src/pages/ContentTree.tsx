import React, { useEffect, useState } from 'react';
import { Box, Typography, Paper, CircularProgress, Alert } from '@mui/material';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TreeNode, type HierarchyNode } from '../components/content/TreeNode';

export function ContentTreePage() {
    const [treeData, setTreeData] = useState<HierarchyNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const fetchTree = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/content/hierarchy');
            if (res.ok) {
                const json = await res.json() as { data: HierarchyNode[] };
                setTreeData(json.data || []);
            } else {
                setError('Failed to fetch hierarchy tree.');
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Network error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchTree();
    }, []);

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            // Determine logic to move node 'active.id' to be a child of 'over.id'
            // For simplicity in UI, we move it as a child. In a real system, you might place it before/after or inside.
            try {
                const res = await fetch('/api/content/hierarchy/move', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        entryId: active.id,
                        newParentId: over.id
                    })
                });

                if (res.ok) {
                    await fetchTree(); // refresh after moving
                } else {
                    setError('Failed to move item.');
                }
            } catch {
                setError('Error moving item.');
            }
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return <Alert severity="error">{error}</Alert>;
    }

    // Flatten top level ids for the SortableContext
    const items = treeData.map(t => t.id);

    return (
        <Paper variant="outlined" sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
                Content Hierarchy
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Drag and drop items to reorder and structure your content. Drop an item onto another to make it a child.
            </Typography>

            <DndContext 
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={(e) => void handleDragEnd(e)}
            >
                <SortableContext 
                    items={items}
                    strategy={verticalListSortingStrategy}
                >
                    <Box sx={{ maxWidth: 800 }}>
                        {treeData.length === 0 ? (
                            <Typography color="text.secondary">No hierarchy data available.</Typography>
                        ) : (
                            treeData.map(node => (
                                <TreeNode key={node.id} node={node} depth={0} />
                            ))
                        )}
                    </Box>
                </SortableContext>
            </DndContext>
        </Paper>
    );
}
