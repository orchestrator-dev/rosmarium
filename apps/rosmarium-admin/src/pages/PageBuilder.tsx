import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Drawer, List, ListItem, ListItemText, Divider, IconButton, Paper } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';

export default function PageBuilder() {
    const [components, setComponents] = useState<any[]>([]);
    const [pageSections, setPageSections] = useState<any[]>([]);
    
    useEffect(() => {
        // Fetch components from registry
        fetch('/api/pages/components')
            .then(res => res.json())
            .then(data => setComponents(data))
            .catch(err => console.error(err));
    }, []);

    const addSection = (component: any) => {
        setPageSections([
            ...pageSections, 
            { id: Date.now().toString(), componentId: component.id, component, props: component.defaultProps }
        ]);
    };

    return (
        <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
            {/* Component Palette */}
            <Drawer variant="permanent" sx={{ width: 280, flexShrink: 0, '& .MuiDrawer-paper': { width: 280, boxSizing: 'border-box' } }}>
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6">Components</Typography>
                </Box>
                <Divider />
                <List>
                    {components.map((comp) => (
                        <ListItem key={comp.id} button onClick={() => addSection(comp)} sx={{ borderBottom: '1px solid #eee' }}>
                            <ListItemText 
                                primary={comp.name} 
                                secondary={comp.category} 
                            />
                            <IconButton size="small">
                                <DragIndicatorIcon />
                            </IconButton>
                        </ListItem>
                    ))}
                    {components.length === 0 && (
                        <ListItem>
                            <ListItemText secondary="No components registered yet. Use the API to register some." />
                        </ListItem>
                    )}
                </List>
            </Drawer>

            {/* Canvas */}
            <Box sx={{ flexGrow: 1, p: 3, bgcolor: '#f5f5f5', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="h5">Visual Page Builder</Typography>
                    <Button variant="contained" color="primary">Save Page</Button>
                </Box>
                
                <Paper sx={{ flexGrow: 1, p: 2, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
                    {pageSections.length === 0 ? (
                        <Box sx={{ m: 'auto', textAlign: 'center', color: 'text.secondary' }}>
                            <Typography variant="h6">Empty Canvas</Typography>
                            <Typography>Click a component from the palette to add it.</Typography>
                        </Box>
                    ) : (
                        pageSections.map((section, index) => (
                            <Paper key={section.id} variant="outlined" sx={{ p: 2, position: 'relative' }}>
                                <Typography variant="subtitle2" color="primary">{section.component.name}</Typography>
                                <Box sx={{ mt: 1 }}>
                                    <pre style={{ margin: 0, fontSize: '12px', background: '#f8f8f8', padding: '8px' }}>
                                        {JSON.stringify(section.props, null, 2)}
                                    </pre>
                                </Box>
                                <Button size="small" variant="text" color="error" sx={{ position: 'absolute', top: 8, right: 8 }} 
                                        onClick={() => setPageSections(pageSections.filter(s => s.id !== section.id))}>
                                    Remove
                                </Button>
                            </Paper>
                        ))
                    )}
                </Paper>
            </Box>
            
            {/* Prop Editor (Placeholder) */}
            <Drawer variant="permanent" anchor="right" sx={{ width: 300, flexShrink: 0, '& .MuiDrawer-paper': { width: 300, boxSizing: 'border-box' } }}>
                <Box sx={{ p: 2 }}>
                    <Typography variant="h6">Properties</Typography>
                </Box>
                <Divider />
                <Box sx={{ p: 2 }}>
                    <Typography color="text.secondary">Select a section to edit its properties and data bindings.</Typography>
                </Box>
            </Drawer>
        </Box>
    );
}
