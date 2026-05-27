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
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Paper
} from '@mui/material';

export interface SearchResponse {
  results: Array<{
    id: string
    title: string
    score: number
    content: string
    _metadata?: Record<string, any>
  }>
  query: { text: string; alpha: number }
  metrics: {
    durationMs: number
    totalFound: number
    method: 'hybrid' | 'vector' | 'keyword'
  }
}

export function SearchPage() {
  const [results, setResults] = React.useState<SearchResponse | null>(null);
  const [searchedQuery, setSearchedQuery] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  
  const [query, setQuery] = React.useState('');
  const [alpha, setAlpha] = React.useState(0.5);
  const [suggestions, setSuggestions] = React.useState<string[]>([]);

  const handleSearch = async (overrideQ?: string) => {
    const q = overrideQ ?? query;
    if (!q) return;
    setLoading(true);
    setSuggestions([]);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&alpha=${alpha}`);
      const data = await res.json() as SearchResponse;
      setResults(data);
      setSearchedQuery(q);
    } catch (e) {
      console.error(e);
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
      setSuggestions(data.suggestions || []);
    } catch (e) {
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
      {loading && <LinearProgress sx={{ mb: 4 }} />}

      {/* Search Results */}
      {!loading && results && (
        <Box>
          <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "center", mb: 3}}>
            <Typography variant="body2" color="text.secondary">
              Found {results.metrics.totalFound} results for "{searchedQuery}"
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Typography variant="caption" color="text.secondary">Method:</Typography>
              <Chip label={results.metrics.method} size="small" color="primary" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 2 }}>
                {results.metrics.durationMs}ms
              </Typography>
            </Stack>
          </Stack>

          <Stack spacing={2}>
            {results.results.map((hit) => (
              <Card key={hit.id} variant="outlined" sx={{ '&:hover': { borderColor: 'primary.main' } }}>
                <CardContent>
                  <Stack direction="row" sx={{justifyContent: "space-between", alignItems: "flex-start", mb: 1}}>
                    <Typography variant="h3" color="primary.light">
                      {hit.title || 'Untitled Document'}
                    </Typography>
                    <Chip 
                      label={`Score: ${hit.score.toFixed(3)}`} 
                      size="small" 
                      variant="outlined"
                      sx={{ color: 'text.secondary', borderColor: 'divider' }}
                    />
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {hit.content.length > 200 ? hit.content.slice(0, 200) + '...' : hit.content}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                    {hit._metadata?.tags?.map((t: string) => (
                      <Chip key={t} label={t} size="small" sx={{ bgcolor: 'rgba(34, 211, 238, 0.1)', color: 'secondary.main', mb: 1 }} />
                    ))}
                    {hit._metadata?.entities?.map((e: string) => (
                      <Chip key={e} label={e} size="small" sx={{ bgcolor: 'rgba(244, 114, 182, 0.1)', color: '#f472b6', mb: 1 }} />
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
