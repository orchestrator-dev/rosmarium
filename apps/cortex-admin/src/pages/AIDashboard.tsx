import React from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardHeader,
  Stack,
  TextField,
  Button,
  Chip,
  IconButton,
  Grid,
  Divider,
} from '@mui/material';
import {
  BarChart as ChartIcon,
  Label as LabelIcon,
  Search as SearchIcon,
  Bolt as BoltIcon,
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
} from '@mui/icons-material';

interface QueueStat {
  queueName: string
  waiting: number
  active: number
  completed: number
  failed: number
  delayed: number
}

interface DuplicatePair {
  entryIdA: string
  entryIdB: string
  score: number
}

export function AIDashboardPage() {
  const [queueStats, setQueueStats] = React.useState<QueueStat[]>([]);
  const [queueLoading, setQueueLoading] = React.useState(false);
  const [dupContentType, setDupContentType] = React.useState('');
  const [dupResults, setDupResults] = React.useState<DuplicatePair[]>([]);
  const [dupLoading, setDupLoading] = React.useState(false);
  const [dupError, setDupError] = React.useState<string | null>(null);
  const [tagContentType, setTagContentType] = React.useState('');
  const [tagLabel, setTagLabel] = React.useState('');
  const [taxonomy, setTaxonomy] = React.useState<string[]>(['technology', 'business', 'science', 'health', 'politics']);

  React.useEffect(() => {
    const fetchStats = async () => {
      setQueueLoading(true);
      try {
        const res = await fetch('/api/admin/queue-stats');
        if (res.ok) {
          const json = await res.json() as { data: QueueStat[] };
          setQueueStats(json.data);
        }
      } catch { /* ignore */ }
      finally { setQueueLoading(false); }
    };
    void fetchStats();
    const interval = setInterval(() => void fetchStats(), 5000);
    return () => clearInterval(interval);
  }, []);

  const scanDuplicates = async () => {
    if (!dupContentType.trim()) return;
    setDupLoading(true);
    setDupError(null);
    try {
      const res = await fetch(`/api/content/${dupContentType}/duplicates`);
      if (res.ok) {
        const json = await res.json() as { pairs: DuplicatePair[] };
        setDupResults(json.pairs);
      } else {
        setDupError(`Error: ${res.status}`);
      }
    } catch (e) {
      setDupError(String(e));
    } finally {
      setDupLoading(false);
    }
  };

  const addLabel = () => {
    const label = tagLabel.trim().toLowerCase();
    if (label && !taxonomy.includes(label)) {
      setTaxonomy(prev => [...prev, label]);
      setTagLabel('');
    }
  };

  const removeLabel = (label: string) => setTaxonomy(prev => prev.filter(l => l !== label));

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" gutterBottom>
          🧠 AI Intelligence Dashboard
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Monitor embedding coverage, manage auto-tagging, detect duplicates, and track AI queue health.
        </Typography>
      </Box>

      <Stack spacing={4}>
        {/* Panel 1 — Embedding Coverage */}
        <Card variant="outlined">
          <CardHeader 
            avatar={<ChartIcon color="primary" />} 
            title="Embedding Coverage" 
            titleTypographyProps={{ variant: 'h2' }}
          />
          <Divider />
          <CardContent>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Embedding coverage is tracked via the <Typography component="span" color="primary" sx={{ fontFamily: 'monospace' }}>metadata.embeddedAt</Typography> field
              on each content entry. Use the search or RAG endpoints to verify embeddings are live.
            </Typography>
            <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} sx={{alignItems: "center", mb: 1}}>
                <CheckCircleIcon color="success" fontSize="small" />
                <Typography variant="body2" color="success.main" sx={{ fontWeight: "bold" }}>pgvector active</Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Embedding tables follow the pattern <Typography component="span" color="primary" sx={{ fontFamily: 'monospace' }}>cortex_{'{type}'}_embeddings</Typography>
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Panel 2 — Auto-tagging taxonomy */}
        <Card variant="outlined">
          <CardHeader 
            avatar={<LabelIcon color="primary" />} 
            title="Auto-tagging Taxonomy" 
            titleTypographyProps={{ variant: 'h2' }}
          />
          <Divider />
          <CardContent>
            <Grid container spacing={3}>
              <Grid size={{xs: 12, md: 6}}  >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 'bold' }}>
                  Content Type
                </Typography>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="e.g. article"
                  value={tagContentType}
                  onChange={e => setTagContentType(e.target.value)}
                />
              </Grid>
              <Grid size={{xs: 12}}  >
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', fontWeight: 'bold' }}>
                  Tag Taxonomy
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
                  {taxonomy.map(label => (
                    <Chip
                      key={label}
                      label={label}
                      onDelete={() => removeLabel(label)}
                      deleteIcon={<CloseIcon />}
                      color="primary"
                      variant="filled"
                      sx={{ bgcolor: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' }}
                    />
                  ))}
                </Box>
                <Stack direction="row" spacing={2}>
                  <TextField
                    fullWidth
                    size="small"
                    placeholder="Add a label…"
                    value={tagLabel}
                    onChange={e => setTagLabel(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') addLabel(); }}
                  />
                  <Button variant="contained" onClick={addLabel}>Add</Button>
                </Stack>
              </Grid>
            </Grid>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Configure <Typography component="span" color="primary" sx={{ fontFamily: 'monospace' }}>aiIntelligence.tagTaxonomy</Typography> in your content type settings to use this taxonomy.
            </Typography>
          </CardContent>
        </Card>

        {/* Panel 3 — Duplicate Detection */}
        <Card variant="outlined">
          <CardHeader 
            avatar={<SearchIcon color="primary" />} 
            title="Duplicate Detection" 
            titleTypographyProps={{ variant: 'h2' }}
          />
          <Divider />
          <CardContent>
            <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Content type (e.g. article)"
                value={dupContentType}
                onChange={e => setDupContentType(e.target.value)}
              />
              <Button 
                variant="contained" 
                onClick={() => void scanDuplicates()} 
                disabled={dupLoading}
                startIcon={<SearchIcon />}
                sx={{ px: 3 }}
              >
                {dupLoading ? 'Scanning…' : 'Scan'}
              </Button>
            </Stack>

            {dupError && (
              <Typography color="error" variant="body2" sx={{ mb: 2 }}>{dupError}</Typography>
            )}

            {dupResults.length > 0 ? (
              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  Found {dupResults.length} duplicate pair{dupResults.length !== 1 ? 's' : ''}
                </Typography>
                <Stack spacing={1}>
                  {dupResults.map((pair, i) => (
                    <Box key={i} sx={{ 
                      p: 1.5, 
                      bgcolor: 'background.default', 
                      borderRadius: 1, 
                      border: '1px solid', 
                      borderColor: 'error.dark',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 2 
                    }}>
                      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', color: 'text.secondary' }}>
                        {pair.entryIdA.slice(0, 8)}…
                      </Typography>
                      <Typography variant="body2" color="text.secondary">↔</Typography>
                      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'monospace', color: 'text.secondary' }}>
                        {pair.entryIdB.slice(0, 8)}…
                      </Typography>
                      <Chip 
                        label={`${(pair.score * 100).toFixed(1)}%`} 
                        size="small"
                        color={pair.score >= 0.95 ? 'error' : 'warning'}
                      />
                    </Box>
                  ))}
                </Stack>
              </Box>
            ) : dupResults.length === 0 && !dupLoading && dupContentType && !dupError ? (
              <Typography color="success.main" variant="body2">✅ No duplicates found</Typography>
            ) : null}
          </CardContent>
        </Card>

        {/* Panel 4 — Intelligence Queue */}
        <Card variant="outlined">
          <CardHeader 
            avatar={<BoltIcon color="primary" />} 
            title="Intelligence Queue" 
            titleTypographyProps={{ variant: 'h2' }}
            action={
              queueLoading ? <Typography variant="caption" color="primary">↻ Refreshing…</Typography> : null
            }
          />
          <Divider />
          <CardContent>
            {queueStats.length > 0 ? (
              <Grid container spacing={2}>
                {queueStats.map(stat => (
                  <Grid size={{xs: 12, sm: 6, md: 4}}  key={stat.queueName}>
                    <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" sx={{ display: 'block', mb: 1, fontWeight: 'bold', textTransform: 'uppercase', color: 'text.secondary' }}>
                        {stat.queueName}
                      </Typography>
                      <Grid container spacing={1}>
                        {[
                          { label: 'waiting', value: stat.waiting, color: 'warning.main' },
                          { label: 'active', value: stat.active, color: 'info.main' },
                          { label: 'done', value: stat.completed, color: 'success.main' },
                          { label: 'failed', value: stat.failed, color: 'error.main' },
                        ].map(({ label, value, color }) => (
                          <Grid size={{xs: 6}}  key={label} sx={{ textAlign: 'center' }}>
                            <Typography variant="h6" sx={{ color, fontWeight: 'bold' }}>{value}</Typography>
                            <Typography variant="caption" color="text.secondary">{label}</Typography>
                          </Grid>
                        ))}
                      </Grid>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Typography color="text.secondary" variant="body2">
                {queueLoading ? 'Loading queue stats…' : 'Queue stats unavailable (requires admin auth)'}
              </Typography>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
              Queues: <Typography component="span" color="primary" sx={{ fontFamily: 'monospace' }}>embedding-jobs</Typography>,{' '}
              <Typography component="span" color="primary" sx={{ fontFamily: 'monospace' }}>intelligence-jobs</Typography>,{' '}
              <Typography component="span" color="primary" sx={{ fontFamily: 'monospace' }}>webhook-deliveries</Typography>
            </Typography>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
