import React from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Button, 
  Slider, 
  Card, 
  CardContent, 
  Chip, 
  Stack,
  List,
  ListItem,
  ListItemText,
  Paper,
  Skeleton
} from '@mui/material';

export interface SearchResponse {
  data: Array<{
    id: string
    contentType: string
    data: Record<string, unknown>
    status: string
    publishedAt: string | null
    score: number
    matchType: string
    snippet: string | null
    chunkText: string | null
  }>
  meta: {
    query: string
    total: number
    alpha: number
    contentTypes: string[]
    latencyMs: number
    embeddingProvider: string | null
  }
}

export function SearchPage() {
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const [searchedQuery, setSearchedQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);
  
  const [query, setQuery] = React.useState('');
  const [alpha, setAlpha] = React.useState(0.5);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  const handleSearch = async (overrideQ?: string) => {
    const q = overrideQ ?? query;
    if (!q) return;
    setLoading(true);
    setError(false);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&alpha=${alpha}`);
      if (!res.ok) throw new Error('Search request failed');
      const data = await res.json() as SearchResponse;
      setResults(data);
      setSearchedQuery(q);
    } catch (e) {
      console.error(e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleAutocomplete = async (text: string) => {
    setQuery(text);
    if (text.length < 3) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      setSuggestions((data.data || []).map((s: { title: string }) => s.title));
    } catch {
      // ignore
    }
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h1" gutterBottom>
          Hybrid Search
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Find content using BM25 keyword matching and vector embeddings.
        </Typography>
      </Box>

      {/* Search Bar */}
      <Paper sx={{ p: 3, mb: 4, position: 'relative', bgcolor: 'background.paper', borderRadius: 2 }}>
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Box sx={{ flexGrow: 1, position: 'relative' }}>
            <TextField
              fullWidth
              placeholder="Search documents, concepts, or entities..."
              value={query}
              onChange={(e) => void handleAutocomplete(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void handleSearch();
              }}
              variant="outlined"
            />
            {suggestions.length > 0 && (
              <Paper sx={{ position: 'absolute', top: '100%', left: 0, right: 0, mt: 1, zIndex: 10 }}>
                <List>
                  {suggestions.map((s, i) => (
                    <ListItem 
                      key={i} 
                      onClick={() => { setQuery(s); setSuggestions([]); void handleSearch(s); }}
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    >
                      <ListItemText primary={s} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            )}
          </Box>
          <Button 
            variant="contained" 
            onClick={() => void handleSearch()} 
            disabled={loading}
            sx={{ px: 4 }}
          >
            {loading ? 'Searching...' : 'Search'}
          </Button>
        </Stack>

        <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 700, textTransform: 'uppercase' }}>
            Search Alpha: {alpha.toFixed(2)}
          </Typography>
          <Slider
            value={alpha}
            onChange={(_, val) => setAlpha(val as number)}
            min={0}
            max={1}
            step={0.1}
            valueLabelDisplay="auto"
            sx={{ color: 'secondary.main' }}
          />
          <Stack direction="row" sx={{justifyContent: "space-between", mt: 1}}>
            <Typography variant="caption" color="text.secondary">Keyword (BM25)</Typography>
            <Typography variant="caption" color="text.secondary">Semantic (Vector)</Typography>
          </Stack>
        </Box>
      </Paper>

      {/* Loading State */}
      {loading && (
        <Stack spacing={2} sx={{ mt: 4 }}>
          {[1,2,3].map(i => (
            <Card key={i} variant="outlined"><CardContent><Skeleton height={32} width="60%" /><Skeleton height={20} /><Skeleton height={20} width="80%" /></CardContent></Card>
          ))}
        </Stack>
      )}

      {/* Idle State */}
      {!loading && !results && !error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="body1" color="text.secondary" gutterBottom>
            Try: <a href="#" onClick={(e) => { e.preventDefault(); setQuery('vector database'); handleAutocomplete('vector database'); void handleSearch('vector database'); }}>vector database</a> | <a href="#" onClick={(e) => { e.preventDefault(); setQuery('RAG pipeline'); handleAutocomplete('RAG pipeline'); void handleSearch('RAG pipeline'); }}>RAG pipeline</a> | <a href="#" onClick={(e) => { e.preventDefault(); setQuery('knowledge graph'); handleAutocomplete('knowledge graph'); void handleSearch('knowledge graph'); }}>knowledge graph</a>
          </Typography>
        </Box>
      )}

      {/* Empty State */}
      {!loading && results?.data?.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" gutterBottom>No results for "{searchedQuery}"</Typography>
          <Typography variant="body2" color="text.secondary">Try a broader query or Adjust the Alpha slider</Typography>
        </Box>
      )}

      {/* Error State */}
      {error && (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography variant="h6" color="error" gutterBottom>Search is unavailable</Typography>
          <Button variant="outlined" onClick={() => void handleSearch()}>Retry</Button>
        </Box>
      )}

      {/* Search Results */}
      {!loading && results && results.data && results.data.length > 0 && (
        <Box>
          <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 3}}>
            <Typography variant="body2" color="text.secondary">
              Found {results.meta.total} results for "{searchedQuery}"
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="caption" color="text.secondary">Method:</Typography>
              <Chip label={results.meta.alpha === 0 ? 'keyword' : results.meta.alpha === 1 ? 'vector' : 'hybrid'} size="small" color="primary" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                {results.meta.latencyMs}ms
              </Typography>
            </Stack>
          </Stack>

          <Stack spacing={2}>
            {results.data.map((hit) => {
              const contentPreview = hit.snippet || hit.chunkText || '';
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const dataAny = hit.data as any;
              const rawTags = dataAny?._metadata?.tags || dataAny?.tags;
              const tags = Array.isArray(rawTags) ? rawTags : [];
              const rawEntities = dataAny?._metadata?.entities || dataAny?.entities;
              const entities = Array.isArray(rawEntities) ? rawEntities : [];
              
              return (
                <Card key={hit.id} variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main' } }}>
                  <CardContent>
                    <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "flex-start", mb: 1}}>
                      <Typography variant="h3" color="primary.light">
                        {String(hit.data?.title || hit.data?.name || 'Untitled Document')}
                      </Typography>
                      <Chip 
                        label={`Score: ${(hit.score ?? 0).toFixed(3)}`} 
                        size="small" 
                        variant="outlined"
                        sx={{ color: 'text.secondary', borderColor: 'divider' }}
                      />
                    </Stack>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      {contentPreview.length > 200 ? contentPreview.slice(0, 200) + '...' : contentPreview}
                    </Typography>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                      {tags.map((t: string) => (
                        <Chip key={t} label={t} size="small" sx={{ bgcolor: 'rgba(34, 211, 238, 0.1)', color: 'secondary.main', mb: 1 }} />
                      ))}
                      {entities.map((e: string) => (
                        <Chip key={e} label={e} size="small" sx={{ bgcolor: 'rgba(244, 114, 182, 0.1)', color: '#f472b6', mb: 1 }} />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              );
            })}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
