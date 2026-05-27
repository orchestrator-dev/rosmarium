import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Tabs,
  Tab,
  Card,
  CardContent,
  Chip,
  Stack,
  IconButton,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Paper,
  
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Download as DownloadIcon,
  PlayArrow as PlayIcon,
  Search as SearchIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import cytoscape from 'cytoscape';

interface GraphEdge {
  id: string
  fromEntryId: string
  fromContentType: string
  toEntryId: string
  toContentType: string
  edgeType: string
  weight: number
  source: string
  isAccepted: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

interface EntityMention {
  id: string
  entryId: string
  entityId: string
  confidence: number
  entity: {
    id: string
    entityText: string
    entityType: string
    mentionCount: number
  }
}

interface NodeAnalytics {
  pagerankScore: number;
  betweennessScore: number;
  communityId: number;
  hubScore: number;
  authorityScore: number;
  degreeIn: number;
  degreeOut: number;
  computedAt: string;
}

const EDGE_TYPE_COLORS: Record<string, string> = {
  relatedTo: '#6366f1',
  mentions: '#0891b2',
  references: '#16a34a',
  partOf: '#d97706',
  deprecates: '#dc2626',
}

const SOURCE_LABELS: Record<string, string> = {
  manual: '✍️ Manual',
  auto_ner: '🤖 NER',
  auto_similarity: '🔗 Similarity',
  auto_reference: '📎 Reference',
  api: '🌐 API',
}

function CytoscapeViewer({ rootId }: { rootId: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const cyRef = React.useRef<cytoscape.Core | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [depth, setDepth] = React.useState(2);
  const [edgeType, setEdgeType] = React.useState('');

  const loadGraph = async () => {
    if (!rootId) return;
    setLoading(true);
    try {
      const qs = new URLSearchParams({ rootId, depth: depth.toString() });
      if (edgeType) qs.set('edgeType', edgeType);
      const res = await fetch(`/api/graph/visualize?${qs}`);
      if (res.ok) {
        const json = await res.json();
        if (cyRef.current) cyRef.current.destroy();
        if (containerRef.current) {
          cyRef.current = cytoscape({
            container: containerRef.current,
            elements: [...json.data.nodes, ...json.data.edges],
            style: [
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { selector: 'node', style: { 'label': 'data(label)', 'background-color': '#6366f1', 'color': '#fff', 'text-valign': 'center', 'font-size': '10px', 'text-outline-width': 2, 'text-outline-color': '#1e293b' } as any },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { selector: 'node[group="article"]', style: { 'background-color': '#0891b2' } as any },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { selector: `node[id="${rootId}"]`, style: { 'background-color': '#d946ef', 'width': 40, 'height': 40 } as any },
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              { selector: 'edge', style: { 'label': 'data(label)', 'width': 2, 'line-color': '#475569', 'target-arrow-color': '#475569', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'font-size': '8px', 'color': '#cbd5e1', 'text-outline-width': 1, 'text-outline-color': '#0f172a' } as any },
            ],
            layout: { name: 'cose', padding: 30 }
          });
        }
      }
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { void loadGraph(); }, [rootId]);

  return (
    <Card variant="outlined" sx={{ mt: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
          <TextField 
            type="number" 
            size="small" 
            label="Depth" 
            value={depth} 
            onChange={e => setDepth(Number(e.target.value))} 
            slotProps={{ htmlInput: { min: 1, max: 5 } }} 
            sx={{ width: 100 }}
          />
          <TextField 
            size="small" 
            label="Edge filter" 
            value={edgeType} 
            onChange={e => setEdgeType(e.target.value)} 
            sx={{ width: 200 }}
          />
          <Button variant="outlined" onClick={() => void loadGraph()} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Stack>
        <Box ref={containerRef} sx={{ width: '100%', height: 500, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }} />
      </CardContent>
    </Card>
  );
}

export function GraphPage() {
  const [entryId, setEntryId] = React.useState('');
  const [edges, setEdges] = React.useState<GraphEdge[]>([]);
  const [pending, setPending] = React.useState<GraphEdge[]>([]);
  const [mentions, setMentions] = React.useState<EntityMention[]>([]);
  const [analytics, setAnalytics] = React.useState<NodeAnalytics | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState(0);
  const [showAddEdge, setShowAddEdge] = React.useState(false);
  
  // Add edge state
  const [addToEntryId, setAddToEntryId] = React.useState('');
  const [addEdgeType, setAddEdgeType] = React.useState('relatedTo');
  const [addFromCt, setAddFromCt] = React.useState('');
  const [addToCt, setAddToCt] = React.useState('');
  const [addLoading, setAddLoading] = React.useState(false);

  const loadEntry = async (id: string) => {
    if (!id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const [edgeRes, mentionRes, analyticsRes] = await Promise.all([
        fetch(`/api/graph/edges/${id}`),
        fetch(`/api/graph/entities/${id}/mentions`),
        fetch(`/api/graph/analytics/${id}`),
      ]);
      if (edgeRes.ok) {
        const j = await edgeRes.json() as { data: GraphEdge[] };
        setEdges(j.data);
      }
      if (mentionRes.ok) {
        const j = await mentionRes.json() as { data: EntityMention[] };
        setMentions(j.data);
      }
      if (analyticsRes.ok) {
        const j = await analyticsRes.json() as { data: NodeAnalytics };
        setAnalytics(j.data);
      } else {
        setAnalytics(null);
      }
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const loadPending = async () => {
    const res = await fetch('/api/graph/pending');
    if (res.ok) {
      const j = await res.json() as { data: GraphEdge[] };
      setPending(j.data);
    }
  };

  React.useEffect(() => { void loadPending(); }, []);

  const handleAccept = async (id: string) => {
    await fetch(`/api/graph/edges/${id}/accept`, { method: 'POST' });
    void loadPending();
    if (entryId) void loadEntry(entryId);
  };

  const handleReject = async (id: string) => {
    await fetch(`/api/graph/edges/${id}/reject`, { method: 'POST' });
    void loadPending();
    if (entryId) void loadEntry(entryId);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/graph/edges/${id}`, { method: 'DELETE' });
    if (entryId) void loadEntry(entryId);
  };

  const handleAddEdge = async () => {
    if (!entryId || !addToEntryId || !addEdgeType) return;
    setAddLoading(true);
    try {
      await fetch('/api/graph/edges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromEntryId: entryId,
          fromContentType: addFromCt || 'article',
          toEntryId: addToEntryId,
          toContentType: addToCt || 'article',
          edgeType: addEdgeType,
        }),
      });
      setShowAddEdge(false);
      setAddToEntryId('');
      void loadEntry(entryId);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" gutterBottom>
          🕸️ Knowledge Graph
        </Typography>
        <Typography variant="body2" color="text.secondary">
          View and manage typed relations between content entries and entity nodes.
        </Typography>
      </Box>

      {/* Entry Lookup */}
      <Paper sx={{ p: 3, mb: 3, bgcolor: 'background.paper' }}>
        <Typography variant="caption" color="text.secondary" sx={{fontWeight: "bold", mb: 1, display: 'block'}}>
          ENTRY ID
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mb: showAddEdge ? 2 : 0 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Paste content entry ID…"
            value={entryId}
            onChange={e => setEntryId(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void loadEntry(entryId); }}
          />
          <Button 
            variant="contained" 
            onClick={() => void loadEntry(entryId)}
            disabled={loading}
            startIcon={<SearchIcon />}
          >
            Load
          </Button>
          <Button 
            variant="outlined" 
            onClick={() => setShowAddEdge(v => !v)}
            startIcon={<AddIcon />}
            color="secondary"
          >
            Edge
          </Button>
        </Stack>

        {showAddEdge && (
          <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>Create Manual Edge</Typography>
            <Grid container spacing={2}>
              <Grid size={{xs: 12, sm: 4}}  >
                <TextField fullWidth size="small" label="Target entry ID" value={addToEntryId} onChange={e => setAddToEntryId(e.target.value)} />
              </Grid>
              <Grid size={{xs: 12, sm: 4}}  >
                <FormControl fullWidth size="small">
                  <InputLabel>Edge Type</InputLabel>
                  <Select value={addEdgeType} label="Edge Type" onChange={e => setAddEdgeType(e.target.value as string)}>
                    {['relatedTo', 'mentions', 'references', 'partOf', 'deprecates'].map(t => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{xs: 6, sm: 2}}  >
                <TextField fullWidth size="small" label="From CT" value={addFromCt} onChange={e => setAddFromCt(e.target.value)} placeholder="article" />
              </Grid>
              <Grid size={{xs: 6, sm: 2}}  >
                <TextField fullWidth size="small" label="To CT" value={addToCt} onChange={e => setAddToCt(e.target.value)} placeholder="article" />
              </Grid>
              <Grid size={{xs: 12}}  >
                <Button variant="contained" onClick={() => void handleAddEdge()} disabled={addLoading} sx={{ mt: 1 }}>
                  {addLoading ? 'Creating...' : 'Create Edge'}
                </Button>
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {error && <Typography color="error" sx={{ mb: 2 }}>{error}</Typography>}

      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={tab} onChange={(_, nv) => setTab(nv)} variant="scrollable" scrollButtons="auto">
          <Tab label={`🔗 Relations (${edges.length})`} />
          <Tab label="🧭 Explorer" />
          <Tab label={`⏳ Pending (${pending.length})`} />
          <Tab label={`🏷️ Entities (${mentions.length})`} />
          <Tab label="📊 Analytics" />
          <Tab label="📥 Export" />
        </Tabs>
      </Box>

      {/* Relations Tab */}
      {tab === 0 && (
        <Stack spacing={2}>
          {edges.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>
              {entryId ? 'No edges found for this entry.' : 'Enter an entry ID above to load its relations.'}
            </Typography>
          ) : (
            edges.map(edge => (
              <Card key={edge.id} variant="outlined">
                <CardContent sx={{ py: '12px !important', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {edge.fromEntryId.slice(0, 8)}…
                    </Typography>
                    <Chip size="small" label={edge.edgeType} sx={{ bgcolor: EDGE_TYPE_COLORS[edge.edgeType] || '#475569', color: 'white', fontWeight: 'bold' }} />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                      {edge.toEntryId.slice(0, 8)}…
                    </Typography>
                    <Typography variant="caption" color="text.secondary">w={edge.weight.toFixed(2)}</Typography>
                    <Typography variant="caption" color="text.secondary">{SOURCE_LABELS[edge.source] ?? edge.source}</Typography>
                  </Box>
                  <Chip size="small" label={edge.isAccepted} color={edge.isAccepted === 'accepted' ? 'success' : edge.isAccepted === 'pending' ? 'warning' : 'error'} />
                  {edge.source === 'manual' && (
                    <IconButton size="small" color="error" onClick={() => void handleDelete(edge.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* Explorer Tab */}
      {tab === 1 && (
        <Box>
          {entryId ? <CytoscapeViewer rootId={entryId} /> : <Typography color="text.secondary" sx={{ py: 3 }}>Enter an entry ID above to explore the graph.</Typography>}
        </Box>
      )}

      {/* Pending Tab */}
      {tab === 2 && (
        <Stack spacing={2}>
          {pending.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>No pending edges — the queue is clear.</Typography>
          ) : (
            pending.map(edge => (
              <Card key={edge.id} variant="outlined" sx={{ borderColor: 'warning.dark' }}>
                <CardContent sx={{ py: '12px !important', display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{edge.fromEntryId.slice(0, 8)}…</Typography>
                    <Chip size="small" label={edge.edgeType} sx={{ bgcolor: EDGE_TYPE_COLORS[edge.edgeType] || '#475569', color: 'white', fontWeight: 'bold' }} />
                    <Typography variant="body2" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>{edge.toEntryId.slice(0, 8)}…</Typography>
                    <Typography variant="caption" color="text.secondary">{SOURCE_LABELS[edge.source] ?? edge.source}</Typography>
                    <Typography variant="caption" color="text.secondary">w={edge.weight.toFixed(2)}</Typography>
                  </Box>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />} onClick={() => void handleAccept(edge.id)}>Accept</Button>
                    <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />} onClick={() => void handleReject(edge.id)}>Reject</Button>
                  </Stack>
                </CardContent>
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* Entities Tab */}
      {tab === 3 && (
        <Box>
          {mentions.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>{entryId ? 'No entity mentions found for this entry.' : 'Enter an entry ID above.'}</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {mentions.map(m => (
                <Chip
                  key={m.id}
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: 'primary.light', textTransform: 'uppercase' }}>{m.entity.entityType}</Typography>
                      <span>{m.entity.entityText}</span>
                      <Typography variant="caption" color="info.light">×{m.entity.mentionCount}</Typography>
                    </Box>
                  }
                  title={`confidence: ${m.confidence.toFixed(2)}`}
                  sx={{ bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#93c5fd', borderRadius: 2 }}
                />
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* Analytics Tab */}
      {tab === 4 && (
        <Box>
          {!entryId ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>Enter an entry ID above to view its graph analytics.</Typography>
          ) : !analytics ? (
            <Typography color="text.secondary" sx={{ py: 3 }}>No analytics computed for this entry yet. Trigger a compute job first.</Typography>
          ) : (
            <Grid container spacing={2}>
              {[
                { label: 'PageRank', value: analytics.pagerankScore.toFixed(6) },
                { label: 'Betweenness', value: analytics.betweennessScore.toFixed(6) },
                { label: 'Hub Score', value: analytics.hubScore.toFixed(6) },
                { label: 'Authority Score', value: analytics.authorityScore.toFixed(6) },
                { label: 'In-Degree', value: analytics.degreeIn },
                { label: 'Out-Degree', value: analytics.degreeOut },
                { label: 'Community ID', value: analytics.communityId },
              ].map(({ label, value }) => (
                <Grid size={{xs: 6, sm: 4}}  key={label}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 'bold' }}>{label}</Typography>
                      <Typography variant="h5" color="primary.light" sx={{ mt: 1 }}>{value}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          <Paper sx={{ p: 3, mt: 4, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: "bold" }} gutterBottom>Compute Network Analytics</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Triggers a background job to compute graph analytics (PageRank, Community Detection, etc.) across the entire knowledge graph.
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={async () => {
                await fetch('/api/graph/analytics/compute', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ contentType: 'article' })
                });
                alert('Analytics compute job queued.');
              }}
            >
              Run Compute Job
            </Button>
          </Paper>
        </Box>
      )}

      {/* Export Tab */}
      {tab === 5 && (
        <Stack spacing={2}>
          {[
            { id: 'json-ld', name: 'JSON-LD', desc: 'Schema.org compatible graph data' },
            { id: 'rdf', name: 'RDF / Turtle', desc: 'Standard Semantic Web format' },
            { id: 'cytoscape', name: 'Cytoscape JSON', desc: 'Visualizer ready graph' },
            { id: 'graphml', name: 'GraphML', desc: 'XML-based standard' }
          ].map(format => (
            <Card key={format.id} variant="outlined">
              <CardContent sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>{format.name}</Typography>
                  <Typography variant="body2" color="text.secondary">{format.desc}</Typography>
                </Box>
                <Button
                  component="a"
                  href={`/api/graph/export?format=${format.id}`}
                  target="_blank"
                  download={`cortex-knowledge-graph.${format.id === 'rdf' ? 'ttl' : format.id === 'graphml' ? 'graphml' : 'json'}`}
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                >
                  Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Box>
  );
}
