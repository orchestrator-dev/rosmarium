import React, { useState, DragEvent, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  IconButton,
  Stack,
  Button,
} from '@mui/material';
import {
  CloudUpload as CloudUploadIcon,
  Delete as DeleteIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';

interface MediaItem {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  createdAt: string;
}

export function MediaLibraryPage() {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleUpload(e.dataTransfer.files);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await handleUpload(e.target.files);
    }
  };

  const handleUpload = async (files: FileList) => {
    // In a real implementation, we would upload to /api/assets
    // For now, we mock the UI update since no API exists yet.
    const newItems: MediaItem[] = Array.from(files).map(file => ({
      id: Math.random().toString(36).substring(7),
      name: file.name,
      url: URL.createObjectURL(file),
      type: file.type,
      size: file.size,
      createdAt: new Date().toISOString()
    }));
    setMedia(prev => [...newItems, ...prev]);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Delete this file?')) {
      setMedia(prev => prev.filter(m => m.id !== id));
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 4}}>
        <Box>
          <Typography variant="h1" gutterBottom>
            Media Library
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your assets, images, and files.
          </Typography>
        </Box>
        <Button 
          variant="contained" 
          startIcon={<CloudUploadIcon />}
          onClick={() => fileInputRef.current?.click()}
        >
          Upload Files
        </Button>
      </Stack>

      <input
        type="file"
        multiple
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={(e) => void handleFileSelect(e)}
      />

      <Paper
        variant="outlined"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => void handleDrop(e)}
        sx={{
          p: 6,
          mb: 4,
          textAlign: 'center',
          backgroundColor: isDragging ? 'action.hover' : 'background.paper',
          borderStyle: isDragging ? 'solid' : 'dashed',
          borderColor: isDragging ? 'primary.main' : 'divider',
          borderWidth: 2,
          transition: 'all 0.2s ease',
          cursor: 'pointer'
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <CloudUploadIcon sx={{ fontSize: 48, color: isDragging ? 'primary.main' : 'text.secondary', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Drag & Drop files here
        </Typography>
        <Typography variant="body2" color="text.secondary">
          or click to select files from your computer
        </Typography>
      </Paper>

      {media.length > 0 ? (
        <Grid container spacing={3}>
          {media.map((item) => (
            <Grid size={{xs: 12, sm: 6, md: 4, lg: 3}}  key={item.id}>
              <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                {item.type.startsWith('image/') ? (
                  <CardMedia
                    component="img"
                    height="160"
                    image={item.url}
                    alt={item.name}
                    sx={{ objectFit: 'cover' }}
                  />
                ) : (
                  <Box sx={{ height: 160, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'action.hover' }}>
                    <FileIcon sx={{ fontSize: 64, color: 'text.secondary' }} />
                  </Box>
                )}
                <CardContent sx={{ flexGrow: 1, p: 2, pb: 1 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: "bold" }} title={item.name}>
                    {item.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                    {formatSize(item.size)} • {new Date(item.createdAt).toLocaleDateString()}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', p: 1 }}>
                  <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary">
            No media uploaded yet.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
