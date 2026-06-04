import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  LinearProgress,

  MenuItem,
  Paper,
  Select,
  Slider,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Alert,
  Tabs,
  Tab,
  Collapse,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Cancel as CancelIcon,
  PublishOutlined as PublishIcon,
  DeleteOutlined as DeleteIcon,
  CheckCircleOutlined as SuccessIcon,
  ErrorOutlined as ErrorIcon,
  SkipNextOutlined as SkipIcon,
  ExpandMore as ExpandMoreIcon,
  OpenInNew as OpenInNewIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ContentType {
  name: string;
  displayName: string;
}

interface ContentSet {
  id: string;
  name: string;
  sourceUrl: string;
  jobId: string;
  status: string;
  stats: {
    crawledPages?: number;
    importedEntries?: number;
    skippedDuplicates?: number;
    failedPages?: number;
    totalPages?: number;
  };
  createdAt: string;
  completedAt?: string;
}

interface LiveStatus {
  jobId: string;
  contentSetName: string;
  startUrl: string;
  status: string;
  totalPages: number;
  crawledPages: number;
  classifiedPages: number;
  importedEntries: number;
  skippedDuplicates: number;
  failedPages: number;
  errors: string[];
  recentResults: Array<{
    entryId: string | null;
    sourceUrl: string;
    contentType: string;
    status: string;
    errorMessage?: string;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusChip(status: string) {
  const map: Record<string, { label: string; color: 'default' | 'warning' | 'info' | 'success' | 'error' }> = {
    queued:      { label: 'Queued',      color: 'default' },
    crawling:    { label: 'Crawling',    color: 'info' },
    classifying: { label: 'Classifying', color: 'info' },
    importing:   { label: 'Importing',   color: 'warning' },
    complete:    { label: 'Complete',    color: 'success' },
    failed:      { label: 'Failed',      color: 'error' },
    cancelled:   { label: 'Cancelled',   color: 'default' },
  };
  const conf = map[status] ?? { label: status, color: 'default' };
  return <Chip label={conf.label} color={conf.color} size="small" />;
}

function resultIcon(status: string) {
  if (status === 'created') return <SuccessIcon sx={{ color: '#22c55e', fontSize: 16, mr: 0.5 }} />;
  if (status === 'skipped_duplicate') return <SkipIcon sx={{ color: '#94a3b8', fontSize: 16, mr: 0.5 }} />;
  return <ErrorIcon sx={{ color: '#ef4444', fontSize: 16, mr: 0.5 }} />;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function IngestorPage() {
  // Form state - Source
  const [sourceType, setSourceType] = React.useState<'web' | 'file' | 'database' | 'cloud'>('web');
  const [startUrl, setStartUrl] = React.useState('');
  const [maxDepth, setMaxDepth] = React.useState(2);
  const [respectRobots, setRespectRobots] = React.useState(true);
  const [includePatterns, setIncludePatterns] = React.useState('');
  const [excludePatterns, setExcludePatterns] = React.useState('');
  
  const [filePath, setFilePath] = React.useState('');
  const [fileFormat, setFileFormat] = React.useState<'json'|'xml'|'text'>('json');
  
  const [dbProvider, setDbProvider] = React.useState<'postgres'|'mongo'>('postgres');
  const [dbConnectionString, setDbConnectionString] = React.useState('');
  const [dbQuery, setDbQuery] = React.useState('');

  const [cloudProvider, setCloudProvider] = React.useState<'s3'>('s3');
  const [cloudBucket, setCloudBucket] = React.useState('');
  const [cloudPrefix, setCloudPrefix] = React.useState('');
  const [cloudEndpoint, setCloudEndpoint] = React.useState('');

  // Form state - Global
  const [contentSetName, setContentSetName] = React.useState('');
  const [targetType, setTargetType] = React.useState('__auto__');
  const [maxPages, setMaxPages] = React.useState(100);
  const [importAs, setImportAs] = React.useState<'draft' | 'published'>('draft');
  const [submitting, setSubmitting] = React.useState(false);
  const [formError, setFormError] = React.useState<string | null>(null);

  // Form state - AI Options
  const [classificationModel, setClassificationModel] = React.useState('');
  const [systemPrompt, setSystemPrompt] = React.useState('');
  const [userPrompt, setUserPrompt] = React.useState('');
  const [availableModels, setAvailableModels] = React.useState<string[]>([]);

  // Data state
  const [contentTypes, setContentTypes] = React.useState<ContentType[]>([]);
  const [jobs, setJobs] = React.useState<ContentSet[]>([]);
  const [loadingJobs, setLoadingJobs] = React.useState(true);

  // Live progress state
  const [activeJobId, setActiveJobId] = React.useState<string | null>(null);
  const [liveStatus, setLiveStatus] = React.useState<LiveStatus | null>(null);
  const [sseSource, setSseSource] = React.useState<EventSource | null>(null);

  // UI state
  const [cancelDialogOpen, setCancelDialogOpen] = React.useState(false);
  const [publishDialogJobId, setPublishDialogJobId] = React.useState<string | null>(null);

  // ── Effects ──────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    fetch('/api/content-types')
      .then(r => r.json())
      .then(d => setContentTypes(d.data ?? []))
      .catch(() => void 0);

    fetch('/api/intelligence/models')
      .then(r => r.json())
      .then(d => {
        const models = d.data ?? [];
        setAvailableModels(models);
        if (d.recommended) setClassificationModel(d.recommended);
        else if (models.length > 0) setClassificationModel(models[0]);
      })
      .catch(() => void 0);

    loadJobs();
  }, []);

  // Auto-suggest content set name from URL
  React.useEffect(() => {
    if (startUrl && !contentSetName) {
      setContentSetName(domainFromUrl(startUrl) + ' import');
    }
  }, [startUrl, contentSetName]);

  // Cleanup SSE on unmount
  React.useEffect(() => {
    return () => sseSource?.close();
  }, [sseSource]);

  // ── Actions ──────────────────────────────────────────────────────────────────

  const loadJobs = async () => {
    setLoadingJobs(true);
    try {
      const r = await fetch('/api/ingestor/jobs');
      const d = await r.json();
      setJobs(d.data ?? []);
    } finally {
      setLoadingJobs(false);
    }
  };

  const startIngestion = async () => {
    if (!contentSetName) {
      setFormError('Content set name is required');
      return;
    }
    if (sourceType === 'web' && !startUrl) {
      setFormError('URL is required for Web import');
      return;
    }
    if (sourceType === 'file' && !filePath) {
      setFormError('File path is required');
      return;
    }
    if (sourceType === 'database' && (!dbConnectionString || !dbQuery)) {
      setFormError('Database connection string and query are required');
      return;
    }
    if (sourceType === 'cloud' && !cloudBucket) {
      setFormError('Cloud bucket is required');
      return;
    }
    setSubmitting(true);
    setFormError(null);

    try {
      const keyResp = await fetch('/api/auth/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Ingestor Job ${new Date().toISOString()}`,
          scopes: ['*']
        })
      });
      const keyData = await keyResp.json();
      const apiKey = keyData?.data?.rawKey;
      
      if (!apiKey) {
        throw new Error(keyData?.error?.message || "Failed to generate internal API key for job.");
      }

      let source: Record<string, unknown> = { type: sourceType };
      if (sourceType === 'web') {
        source = { ...source, startUrl, maxDepth, respectRobotsTxt: respectRobots, includePatterns: includePatterns ? includePatterns.split('\n').filter(Boolean) : [], excludePatterns: excludePatterns ? excludePatterns.split('\n').filter(Boolean) : [] };
      } else if (sourceType === 'file') {
        source = { ...source, path: filePath, format: fileFormat };
      } else if (sourceType === 'database') {
        source = { ...source, provider: dbProvider, connectionString: dbConnectionString, queryOrCollection: dbQuery };
      } else if (sourceType === 'cloud') {
        source = { ...source, provider: cloudProvider, bucket: cloudBucket, prefix: cloudPrefix || undefined, endpoint: cloudEndpoint || undefined };
      }

      const body = {
        source,
        contentSetName,
        targetContentType: targetType === '__auto__' ? null : targetType,
        maxPages,
        importAs,
        apiKey,
        apiBaseUrl: window.location.origin,
        duplicateThreshold: 0.92,
        classificationModel: classificationModel || undefined,
        systemPrompt: systemPrompt || undefined,
        userPrompt: userPrompt || undefined,
      };

      const r = await fetch('/api/ingestor/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const err = await r.json();
        let errMsg = 'Failed to start ingestion';
        if (typeof err.error === 'string') errMsg = err.error;
        else if (err.error?.message) errMsg = err.error.message;
        else if (err.message) errMsg = err.message;
        setFormError(errMsg);
        return;
      }

      const { data } = await r.json();
      setActiveJobId(data.jobId);
      connectSSE(data.jobId);
      await loadJobs();
    } catch (e) {
      setFormError(String(e));
    } finally {
      setSubmitting(false);
    }
  };

  const connectSSE = (jobId: string) => {
    sseSource?.close();
    const es = new EventSource(`/api/ingestor/jobs/${jobId}/stream`);

    es.addEventListener('progress', (e) => {
      try {
        setLiveStatus(JSON.parse(e.data));
      } catch { /* ignore */ }
    });

    es.addEventListener('complete', (e) => {
      try {
        setLiveStatus(JSON.parse(e.data));
      } catch { /* ignore */ }
      es.close();
      loadJobs();
    });

    es.addEventListener('error', () => {
      es.close();
    });

    setSseSource(es);
  };

  const cancelJob = async () => {
    if (!activeJobId) return;
    await fetch(`/api/ingestor/jobs/${activeJobId}`, { method: 'DELETE' });
    setCancelDialogOpen(false);
    setActiveJobId(null);
    setLiveStatus(null);
    sseSource?.close();
    setSseSource(null);
    await loadJobs();
  };

  const publishAll = async (jobId: string) => {
    await fetch(`/api/ingestor/jobs/${jobId}/publish-all`, { method: 'POST' });
    setPublishDialogJobId(null);
    await loadJobs();
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const isRunning = liveStatus &&
    !['complete', 'failed', 'cancelled'].includes(liveStatus.status);

  const progress = liveStatus && (liveStatus.totalPages || 0) > 0
    ? Math.round(((liveStatus.crawledPages || 0) / Math.min(liveStatus.totalPages, maxPages)) * 100)
    : 0;

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#f1f5f9' }}>
        <DownloadIcon sx={{ mr: 1, verticalAlign: 'middle', color: '#6366f1' }} />
        Content Ingestor
      </Typography>
      <Typography sx={{ mb: 3, color: '#64748b' }}>
        Crawl any website and import its content as structured entries.
      </Typography>

      <Grid container spacing={3}>
        {/* ── Left panel: Form or live progress ─────────────────────────── */}
        <Grid size={{ xs: 12, md: 5 }}>
          {activeJobId && liveStatus ? (
            /* ── Live progress view ────────────────────────────────────── */
            <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: '#f1f5f9', flexGrow: 1 }}>
                    {liveStatus.contentSetName}
                  </Typography>
                  {statusChip(liveStatus.status)}
                </Box>

                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 2, wordBreak: 'break-all' }}>
                  {liveStatus.startUrl}
                </Typography>

                <LinearProgress
                  variant="determinate"
                  value={progress || 0}
                  sx={{
                    mb: 2, height: 8, borderRadius: 4,
                    bgcolor: '#0f172a',
                    '& .MuiLinearProgress-bar': { bgcolor: '#6366f1', borderRadius: 4 }
                  }}
                />

                <Grid container spacing={1} sx={{ mb: 2 }}>
                  {[
                    { label: 'Crawled', value: liveStatus.crawledPages },
                    { label: 'Imported', value: liveStatus.importedEntries },
                    { label: 'Skipped', value: liveStatus.skippedDuplicates },
                    { label: 'Failed', value: liveStatus.failedPages },
                  ].map(({ label, value }) => (
                    <Grid key={label} size={{ xs: 6 }}>
                      <Box sx={{ bgcolor: '#0f172a', borderRadius: 1, p: 1, textAlign: 'center' }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: '#6366f1' }}>
                          {value}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          {label}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                {/* Live feed */}
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 0.5 }}>
                  Live feed (newest first)
                </Typography>
                <Box sx={{
                  bgcolor: '#0f172a', borderRadius: 1, p: 1,
                  maxHeight: 220, overflowY: 'auto',
                  fontFamily: 'monospace', fontSize: '0.7rem',
                }}>
                  {!liveStatus.recentResults || liveStatus.recentResults.length === 0 ? (
                    <Typography sx={{ color: '#475569', fontSize: '0.7rem' }}>
                      Waiting for pages...
                    </Typography>
                  ) : (
                    liveStatus.recentResults.map((r, i) => (
                      <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', mb: 0.5 }}>
                        {resultIcon(r.status)}
                        <Box sx={{ minWidth: 0 }}>
                          <Typography sx={{ color: '#94a3b8', fontSize: '0.65rem', wordBreak: 'break-all' }}>
                            {r.sourceUrl}
                          </Typography>
                          {r.status === 'created' && (
                            <Typography sx={{ color: '#6366f1', fontSize: '0.6rem' }}>
                              → {r.contentType}
                            </Typography>
                          )}
                          {r.status === 'failed' && r.errorMessage && (
                            <Typography sx={{ color: '#ef4444', fontSize: '0.6rem' }}>
                              {r.errorMessage.substring(0, 80)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  {isRunning && (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<CancelIcon />}
                      onClick={() => setCancelDialogOpen(true)}
                      fullWidth
                    >
                      Cancel
                    </Button>
                  )}
                  {liveStatus.status === 'complete' && (
                    <>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<PublishIcon />}
                        onClick={() => setPublishDialogJobId(activeJobId)}
                      >
                        Publish All
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          setActiveJobId(null);
                          setLiveStatus(null);
                        }}
                      >
                        New Import
                      </Button>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
          ) : (
            /* ── New import form ──────────────────────────────────────── */
            <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: '#f1f5f9' }}>
                  New Import Job
                </Typography>

                {formError && (
                  <Alert severity="error" sx={{ mb: 2, bgcolor: '#1e293b', border: '1px solid #ef4444' }}>
                    {typeof formError === 'string' ? formError : String(formError)}
                  </Alert>
                )}

                <Tabs 
                  value={sourceType} 
                  onChange={(_, v) => setSourceType(v)}
                  sx={{ mb: 2, minHeight: 36, '& .MuiTab-root': { minHeight: 36, py: 0.5, color: '#94a3b8' } }}
                  indicatorColor="primary"
                >
                  <Tab label="Web" value="web" />
                  <Tab label="File" value="file" />
                  <Tab label="Database" value="database" />
                  <Tab label="Cloud" value="cloud" />
                </Tabs>

                {sourceType === 'web' && (
                  <TextField
                    id="ingestor-start-url"
                    label="URL to ingest"
                    type="url"
                    fullWidth
                    required
                    placeholder="https://example.com/blog"
                    value={startUrl}
                    onChange={e => setStartUrl(e.target.value)}
                    helperText="Rosmarium will recursively crawl from this URL"
                    sx={{ mb: 2 }}
                    size="small"
                  />
                )}

                {sourceType === 'file' && (
                  <>
                    <TextField
                      id="ingestor-file-path"
                      label="File Path (Local Server)"
                      fullWidth
                      required
                      placeholder="/data/imports/catalog.json"
                      value={filePath}
                      onChange={e => setFilePath(e.target.value)}
                      sx={{ mb: 2 }}
                      size="small"
                    />
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>File Format</InputLabel>
                      <Select value={fileFormat} label="File Format" onChange={e => setFileFormat(e.target.value as 'json'|'xml'|'text')}>
                        <MenuItem value="json">JSON (Array of objects)</MenuItem>
                        <MenuItem value="xml">XML</MenuItem>
                        <MenuItem value="text">Raw Text (Line by Line)</MenuItem>
                      </Select>
                    </FormControl>
                  </>
                )}

                {sourceType === 'database' && (
                  <>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Provider</InputLabel>
                      <Select value={dbProvider} label="Provider" onChange={e => setDbProvider(e.target.value as 'postgres'|'mongo')}>
                        <MenuItem value="postgres">PostgreSQL</MenuItem>
                        <MenuItem value="mongo">MongoDB</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Connection String"
                      fullWidth
                      required
                      placeholder="postgres://user:pass@host:5432/db"
                      value={dbConnectionString}
                      onChange={e => setDbConnectionString(e.target.value)}
                      sx={{ mb: 2 }}
                      size="small"
                    />
                    <TextField
                      label={dbProvider === 'postgres' ? 'SQL Query' : 'Collection Name'}
                      fullWidth
                      required
                      placeholder={dbProvider === 'postgres' ? 'SELECT * FROM articles' : 'articles'}
                      value={dbQuery}
                      onChange={e => setDbQuery(e.target.value)}
                      sx={{ mb: 2 }}
                      size="small"
                    />
                  </>
                )}

                {sourceType === 'cloud' && (
                  <>
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Provider</InputLabel>
                      <Select value={cloudProvider} label="Provider" onChange={e => setCloudProvider(e.target.value as 's3')}>
                        <MenuItem value="s3">S3 / MinIO</MenuItem>
                      </Select>
                    </FormControl>
                    <TextField
                      label="Endpoint URL (Optional for AWS S3)"
                      fullWidth
                      placeholder="http://localhost:9000"
                      value={cloudEndpoint}
                      onChange={e => setCloudEndpoint(e.target.value)}
                      sx={{ mb: 2 }}
                      size="small"
                    />
                    <TextField
                      label="Bucket Name"
                      fullWidth
                      required
                      value={cloudBucket}
                      onChange={e => setCloudBucket(e.target.value)}
                      sx={{ mb: 2 }}
                      size="small"
                    />
                    <TextField
                      label="Prefix (Optional)"
                      fullWidth
                      placeholder="imports/2026/"
                      value={cloudPrefix}
                      onChange={e => setCloudPrefix(e.target.value)}
                      sx={{ mb: 2 }}
                      size="small"
                    />
                  </>
                )}

                <TextField
                  id="ingestor-set-name"
                  label="Content Set Name"
                  fullWidth
                  required
                  value={contentSetName}
                  onChange={e => setContentSetName(e.target.value)}
                  sx={{ mb: 2 }}
                  size="small"
                />

                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel id="ingestor-type-label">Target Content Type</InputLabel>
                  <Select
                    labelId="ingestor-type-label"
                    id="ingestor-content-type"
                    value={targetType}
                    label="Target Content Type"
                    onChange={e => setTargetType(e.target.value)}
                  >
                    <MenuItem value="__auto__">
                      <em>Auto-detect per page (AI)</em>
                    </MenuItem>
                    <Divider />
                    {contentTypes.map(ct => (
                      <MenuItem key={ct.name} value={ct.name}>
                        {ct.displayName || ct.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Accordion sx={{ bgcolor: '#0f172a', border: '1px solid #1e293b', mb: 2, boxShadow: 'none' }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#64748b' }} />}>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      Advanced options & AI Overrides
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    {sourceType === 'web' && (
                      <>
                        <Typography variant="body2" sx={{ color: '#94a3b8', mb: 0.5 }}>
                          Crawl Depth: <strong>{maxDepth}</strong>
                        </Typography>
                        <Slider
                          id="ingestor-depth-slider"
                          value={maxDepth}
                          onChange={(_, v) => setMaxDepth(v as number)}
                          min={1} max={5} step={1}
                          marks={[
                            { value: 1, label: 'Single page' },
                            { value: 3, label: 'Medium' },
                            { value: 5, label: 'Deep' },
                          ]}
                          sx={{
                            mb: 2, color: '#6366f1',
                            '& .MuiSlider-markLabel': { color: '#64748b', fontSize: '0.7rem' },
                          }}
                        />
                        <TextField
                          id="ingestor-include-patterns"
                          label="Include URL patterns (regex, one per line)"
                          multiline
                          rows={2}
                          fullWidth
                          size="small"
                          placeholder="/blog/.*"
                          value={includePatterns}
                          onChange={e => setIncludePatterns(e.target.value)}
                          sx={{ mb: 2 }}
                        />
                        <TextField
                          id="ingestor-exclude-patterns"
                          label="Exclude URL patterns (regex, one per line)"
                          multiline
                          rows={2}
                          fullWidth
                          size="small"
                          placeholder="/tag/.*\n/author/.*"
                          value={excludePatterns}
                          onChange={e => setExcludePatterns(e.target.value)}
                          sx={{ mb: 2 }}
                        />
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Switch
                            id="ingestor-robots-switch"
                            checked={respectRobots}
                            onChange={e => setRespectRobots(e.target.checked)}
                            size="small"
                          />
                          <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                            Respect robots.txt
                          </Typography>
                        </Box>
                      </>
                    )}
                    
                    <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                      <InputLabel>Classification Model</InputLabel>
                      <Select 
                        value={classificationModel} 
                        label="Classification Model"
                        onChange={e => setClassificationModel(e.target.value)}
                      >
                        {availableModels.map(m => (
                          <MenuItem key={m} value={m}>{m}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Custom System Prompt"
                      multiline
                      rows={3}
                      fullWidth
                      size="small"
                      placeholder="Override the default system prompt..."
                      value={systemPrompt}
                      onChange={e => setSystemPrompt(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                    
                    <TextField
                      label="Custom User Prompt Template"
                      multiline
                      rows={3}
                      fullWidth
                      size="small"
                      placeholder="Override the default user prompt..."
                      value={userPrompt}
                      onChange={e => setUserPrompt(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                  </AccordionDetails>
                </Accordion>
                <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                  <InputLabel id="ingestor-pages-label">Max Pages</InputLabel>
                  <Select
                    labelId="ingestor-pages-label"
                    id="ingestor-max-pages"
                    value={maxPages}
                    label="Max Pages"
                    onChange={e => setMaxPages(Number(e.target.value))}
                  >
                    {[10, 50, 100, 250, 500].map(n => (
                      <MenuItem key={n} value={n}>{n} pages</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Typography variant="body2" sx={{ color: '#94a3b8', mb: 1 }}>
                  Import as
                </Typography>
                <ToggleButtonGroup
                  id="ingestor-import-as"
                  value={importAs}
                  exclusive
                  onChange={(_, v) => v && setImportAs(v)}
                  size="small"
                  sx={{ mb: 2 }}
                >
                  <ToggleButton value="draft">Draft</ToggleButton>
                  <ToggleButton value="published">Published</ToggleButton>
                </ToggleButtonGroup>



                <Button
                  id="ingestor-start-btn"
                  variant="contained"
                  fullWidth
                  size="large"
                  startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
                  onClick={startIngestion}
                  disabled={
                    submitting || 
                    !contentSetName || 
                    (sourceType === 'web' && !startUrl) || 
                    (sourceType === 'file' && !filePath) || 
                    (sourceType === 'database' && (!dbConnectionString || !dbQuery)) || 
                    (sourceType === 'cloud' && !cloudBucket)
                  }
                  sx={{
                    bgcolor: '#6366f1',
                    '&:hover': { bgcolor: '#4f46e5' },
                    fontWeight: 600,
                  }}
                >
                  {submitting ? 'Starting…' : 'Start Import'}
                </Button>
              </CardContent>
            </Card>
          )}
        </Grid>

        {/* ── Right panel: Import History ─────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card sx={{ bgcolor: '#1e293b', border: '1px solid #334155' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600, color: '#f1f5f9', flexGrow: 1 }}>
                  Import History
                </Typography>
                <IconButton onClick={loadJobs} size="small" sx={{ color: '#64748b' }}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Box>

              {loadingJobs ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress size={32} sx={{ color: '#6366f1' }} />
                </Box>
              ) : jobs.length === 0 ? (
                <Typography sx={{ color: '#64748b', textAlign: 'center', py: 4 }}>
                  No imports yet. Start your first import on the left.
                </Typography>
              ) : (
                <TableContainer component={Paper} sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ color: '#64748b', borderColor: '#334155' }}>Name</TableCell>
                        <TableCell sx={{ color: '#64748b', borderColor: '#334155' }}>Pages</TableCell>
                        <TableCell sx={{ color: '#64748b', borderColor: '#334155' }}>Entries</TableCell>
                        <TableCell sx={{ color: '#64748b', borderColor: '#334155' }}>Status</TableCell>
                        <TableCell sx={{ color: '#64748b', borderColor: '#334155' }}>Date</TableCell>
                        <TableCell sx={{ color: '#64748b', borderColor: '#334155' }}>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {jobs.map(job => (
                        <React.Fragment key={job.id}>
                          <TableRow
                            onClick={() => {
                              if (activeJobId === job.jobId) {
                                setActiveJobId(null);
                              } else {
                                setActiveJobId(job.jobId);
                                connectSSE(job.jobId);
                              }
                            }}
                            sx={{
                              cursor: 'pointer',
                              '&:last-child td': { border: activeJobId === job.jobId ? undefined : 0 },
                              '& td': { borderColor: '#1e293b' },
                              bgcolor: activeJobId === job.jobId ? 'rgba(99, 102, 241, 0.08)' : 'transparent',
                              '&:hover': { bgcolor: 'rgba(99, 102, 241, 0.04)' }
                            }}
                          >
                            <TableCell>
                              <Tooltip title={job.sourceUrl ?? ''}>
                                <Typography sx={{ color: '#f1f5f9', fontSize: '0.85rem', fontWeight: 500 }}>
                                  {job.name}
                                </Typography>
                              </Tooltip>
                              <Typography sx={{ color: '#64748b', fontSize: '0.7rem', wordBreak: 'break-all' }}>
                                {job.sourceUrl}
                              </Typography>
                            </TableCell>
                            <TableCell sx={{ color: '#94a3b8' }}>
                              {job.stats?.crawledPages ?? '—'}
                            </TableCell>
                            <TableCell sx={{ color: '#94a3b8' }}>
                              {job.stats?.importedEntries ?? '—'}
                            </TableCell>
                            <TableCell>{statusChip(job.status)}</TableCell>
                            <TableCell sx={{ color: '#64748b', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                              {new Date(job.createdAt).toLocaleDateString()}
                            </TableCell>
                            <TableCell onClick={e => e.stopPropagation()}>
                              <Box sx={{ display: 'flex', gap: 0.5 }}>
                                {job.status === 'complete' && (
                                  <Tooltip title="Publish all drafts">
                                    <IconButton
                                      size="small"
                                      onClick={() => setPublishDialogJobId(job.jobId)}
                                      sx={{ color: '#22c55e' }}
                                    >
                                      <PublishIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Rollback (delete all entries)">
                                  <IconButton
                                    size="small"
                                    onClick={async () => {
                                      if (confirm(`Delete all imported entries for "${job.name}"?`)) {
                                        await fetch(`/api/ingestor/jobs/${job.jobId}`, { method: 'DELETE' });
                                        await loadJobs();
                                      }
                                    }}
                                    sx={{ color: '#ef4444' }}
                                  >
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Box>
                            </TableCell>
                          </TableRow>
                          <TableRow>
                            <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6} sx={{ border: 0 }}>
                              <Collapse in={activeJobId === job.jobId} timeout="auto" unmountOnExit>
                                <Box sx={{ py: 2 }}>
                                  {liveStatus && liveStatus.jobId === job.jobId ? (
                                    <Box>
                                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                                          Progress: {liveStatus.crawledPages} / {liveStatus.totalPages || '?'} pages
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#94a3b8' }}>
                                          {Math.round((liveStatus.crawledPages / Math.max(liveStatus.totalPages, 1)) * 100)}%
                                        </Typography>
                                      </Box>
                                      <LinearProgress 
                                        variant="determinate" 
                                        value={Math.min((liveStatus.crawledPages / Math.max(liveStatus.totalPages, 1)) * 100, 100)} 
                                        sx={{ mb: 2, bgcolor: '#334155', '& .MuiLinearProgress-bar': { bgcolor: '#6366f1' } }} 
                                      />
                                      <Typography variant="body2" sx={{ color: '#f1f5f9', mb: 1, fontWeight: 500 }}>Live Logs</Typography>
                                      <Paper sx={{ bgcolor: '#0f172a', p: 1.5, maxHeight: 200, overflow: 'auto', border: '1px solid #334155', fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>
                                        {liveStatus.recentResults.length === 0 && <Box sx={{ fontStyle: 'italic' }}>Waiting for logs...</Box>}
                                        {liveStatus.recentResults.map((res, i) => (
                                          <Box key={i} sx={{ mb: 0.5, display: 'flex', gap: 1 }}>
                                            <Box sx={{ color: res.status === 'success' ? '#22c55e' : res.status === 'skipped' ? '#eab308' : '#ef4444' }}>
                                              [{res.status.toUpperCase()}]
                                            </Box>
                                            <Box sx={{ flexGrow: 1, wordBreak: 'break-all' }}>{res.sourceUrl}</Box>
                                            {res.errorMessage && <Box sx={{ color: '#ef4444' }}>- {res.errorMessage}</Box>}
                                          </Box>
                                        ))}
                                      </Paper>
                                    </Box>
                                  ) : (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                      {['crawling', 'classifying', 'importing', 'queued'].includes(job.status) ? (
                                        <CircularProgress size={24} sx={{ color: '#6366f1' }} />
                                      ) : (
                                        <Typography variant="body2" sx={{ color: '#64748b' }}>Job is {job.status}.</Typography>
                                      )}
                                    </Box>
                                  )}
                                </Box>
                              </Collapse>
                            </TableCell>
                          </TableRow>
                        </React.Fragment>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* ── Cancel confirmation dialog ────────────────────────────────────── */}
      <Dialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        slotProps={{ paper: { sx: { bgcolor: '#1e293b', border: '1px solid #334155' } } }}
      >
        <DialogTitle sx={{ color: '#f1f5f9' }}>Cancel Import?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#94a3b8' }}>
            This will stop the crawl and delete all entries imported so far.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)} sx={{ color: '#94a3b8' }}>
            Keep running
          </Button>
          <Button onClick={cancelJob} color="error" variant="contained">
            Cancel & Rollback
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Publish all dialog ────────────────────────────────────────────── */}
      <Dialog
        open={!!publishDialogJobId}
        onClose={() => setPublishDialogJobId(null)}
        slotProps={{ paper: { sx: { bgcolor: '#1e293b', border: '1px solid #334155' } } }}
      >
        <DialogTitle sx={{ color: '#f1f5f9' }}>Publish All Drafts?</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: '#94a3b8' }}>
            All draft entries in this content set will be published immediately.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPublishDialogJobId(null)} sx={{ color: '#94a3b8' }}>
            Cancel
          </Button>
          <Button
            onClick={() => publishDialogJobId && publishAll(publishDialogJobId)}
            color="success"
            variant="contained"
            startIcon={<PublishIcon />}
          >
            Publish All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
