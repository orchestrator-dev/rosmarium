import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Button,
  Stack,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Add as AddIcon,
  Article as ArticleIcon,
} from '@mui/icons-material';

interface ContentType {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  fields: unknown[];
  settings: Record<string, unknown>;
  isSystem: boolean;
}

export function ContentLandingPage() {
  const navigate = useNavigate();
  const [contentTypes, setContentTypes] = useState<ContentType[]>([]);
  const [entryCounts, setEntryCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/content-types');
        if (!res.ok) return;
        const json = (await res.json()) as { data: ContentType[] };
        const types = (json.data || []).filter(
          (t) => !t.settings?.isComponent
        );
        setContentTypes(types);

        // Fetch entry counts in parallel
        const counts: Record<string, number> = {};
        await Promise.all(
          types.map(async (t) => {
            try {
              const r = await fetch(`/api/content/${t.name}`);
              if (r.ok) {
                const j = (await r.json()) as {
                  meta?: { pagination?: { total?: number } };
                };
                counts[t.name] = j.meta?.pagination?.total ?? 0;
              }
            } catch {
              counts[t.name] = 0;
            }
          })
        );
        setEntryCounts(counts);
      } catch (err) {
        console.error('Failed to fetch content types', err);
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: 400,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      {/* Page Header */}
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}
      >
        <Box>
          <Typography variant="h1" gutterBottom>
            Content
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a content type to manage entries
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => navigate('/settings/content-types?action=new')}
        >
          New Content Type
        </Button>
      </Stack>

      {/* Empty State */}
      {contentTypes.length === 0 ? (
        <Box
          sx={{
            textAlign: 'center',
            py: 10,
            px: 4,
            border: '1px dashed #334155',
            borderRadius: 3,
          }}
        >
          <ArticleIcon sx={{ fontSize: 56, color: '#475569', mb: 2 }} />
          <Typography variant="h3" sx={{ mb: 1, color: '#94a3b8' }}>
            No content types yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 3, maxWidth: 400, mx: 'auto' }}>
            Create your first content type to start managing structured content entries.
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/settings/content-types?action=new')}
          >
            Create Content Type
          </Button>
        </Box>
      ) : (
        /* Content Type Cards Grid */
        <Grid container spacing={3}>
          {contentTypes.map((ct) => (
            <Grid key={ct.id} size={{ xs: 12, sm: 6, md: 4 }}>
              <Card
                sx={{
                  bgcolor: 'background.paper',
                  transition: 'all 0.2s ease-in-out',
                  cursor: 'pointer',
                  '&:hover': {
                    borderColor: '#6366F1',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
                  },
                }}
              >
                <CardActionArea onClick={() => navigate(`/content/${ct.name}`)}>
                  <CardContent sx={{ p: 3 }}>
                    <Stack
                      direction="row"
                      sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}
                    >
                      <Typography
                        variant="h3"
                        sx={{
                          color: '#f1f5f9',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ct.displayName}
                      </Typography>
                      <Chip
                        label={entryCounts[ct.name] ?? 0}
                        size="small"
                        color="primary"
                        variant="outlined"
                        sx={{ fontWeight: 600, minWidth: 32 }}
                      />
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{
                        color: '#94a3b8',
                        mb: 2,
                        minHeight: 40,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {ct.description || 'No description'}
                    </Typography>
                    <Typography
                      variant="caption"
                      sx={{ color: '#64748b' }}
                    >
                      {ct.fields.length} field{ct.fields.length !== 1 ? 's' : ''}
                    </Typography>
                  </CardContent>
                </CardActionArea>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}
