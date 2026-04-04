import React, { useState, useCallback, useRef } from 'react'
import ReactDOM from 'react-dom/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResultItem {
  id: string
  contentType: string
  data: Record<string, unknown>
  status: string
  publishedAt: string | null
  score: number
  matchType: 'fulltext' | 'vector' | 'hybrid'
  snippet: string | null
  chunkText: string | null
}

interface SearchMeta {
  query: string
  total: number
  alpha: number
  contentTypes: string[]
  latencyMs: number
  embeddingProvider: string | null
}

interface SearchResponse {
  data: SearchResultItem[]
  meta: SearchMeta
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounce<T extends (...args: Parameters<T>) => void>(fn: T, delay: number): T {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  return useCallback((...args: Parameters<T>) => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => fn(...args), delay)
  }, [fn, delay]) as T
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

function SearchBar({
  onResults,
  onLoading,
}: {
  onResults: (resp: SearchResponse | null, query: string) => void
  onLoading: (loading: boolean) => void
}) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [alpha, setAlpha] = useState(0.5)
  const [showAlpha, setShowAlpha] = useState(false)

  const fetchSuggestions = useDebounce(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); return }
    try {
      const res = await fetch(`/api/search/suggest?q=${encodeURIComponent(q)}&limit=6`)
      if (res.ok) {
        const json = await res.json() as { data: string[] }
        setSuggestions(json.data)
        setShowSuggestions(json.data.length > 0)
      }
    } catch { /* ignore */ }
  }, 300)

  const runSearch = async (q: string, a = alpha) => {
    if (!q.trim()) return
    onLoading(true)
    setShowSuggestions(false)
    try {
      const url = `/api/search?q=${encodeURIComponent(q)}&alpha=${a}&limit=20`
      const res = await fetch(url)
      if (res.ok) {
        const json = await res.json() as SearchResponse
        onResults(json, q)
      } else {
        onResults(null, q)
      }
    } catch {
      onResults(null, q)
    } finally {
      onLoading(false)
    }
  }

  return (
    <div style={{ position: 'relative', maxWidth: 640 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          id="search-input"
          type="text"
          value={query}
          placeholder="Search content…"
          autoComplete="off"
          style={inputStyle}
          onChange={(e) => {
            setQuery(e.target.value)
            fetchSuggestions(e.target.value)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') runSearch(query)
            if (e.key === 'Escape') setShowSuggestions(false)
          }}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true) }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
        />
        <button
          id="search-button"
          onClick={() => runSearch(query)}
          style={btnStyle}
        >
          Search
        </button>
        <button
          id="alpha-toggle"
          onClick={() => setShowAlpha((v) => !v)}
          style={{ ...btnStyle, background: '#334155', fontSize: 12 }}
          title="Advanced: adjust keyword vs semantic balance"
        >
          ⚙️ Alpha
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul style={suggestionsStyle} id="search-suggestions">
          {suggestions.map((s, i) => (
            <li
              key={i}
              style={suggestionItemStyle}
              onMouseDown={() => {
                setQuery(s)
                runSearch(s)
              }}
            >
              {s}
            </li>
          ))}
        </ul>
      )}

      {/* Alpha slider */}
      {showAlpha && (
        <div style={alphaBoxStyle} id="alpha-slider-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>⌨️ Keyword</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>α = {alpha.toFixed(2)}</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>🧠 Semantic</span>
          </div>
          <input
            id="alpha-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={alpha}
            onChange={(e) => setAlpha(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── SearchResults ────────────────────────────────────────────────────────────

function MatchTypeBadge({ type }: { type: SearchResultItem['matchType'] }) {
  const colors: Record<typeof type, string> = {
    hybrid: '#7c3aed',
    fulltext: '#0369a1',
    vector: '#0f766e',
  }
  return (
    <span style={{
      background: colors[type],
      color: '#fff',
      fontSize: 10,
      padding: '2px 6px',
      borderRadius: 4,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {type}
    </span>
  )
}

function ScoreBar({ score }: { score: number }) {
  // RRF scores are typically in range 0 - 0.05; normalize visually
  const pct = Math.min(100, score * 2000)
  return (
    <div style={{ background: '#1e293b', borderRadius: 99, height: 6, width: 120, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${pct}%`,
        background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
        borderRadius: 99,
        transition: 'width 0.3s ease',
      }} />
    </div>
  )
}

function SearchResults({
  response,
  query,
  loading,
}: {
  response: SearchResponse | null
  query: string
  loading: boolean
}) {
  if (loading) {
    return (
      <div id="search-loading" style={{ padding: '32px 0', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
        Searching…
      </div>
    )
  }

  if (!response) return null

  if (response.data.length === 0) {
    return (
      <div id="search-empty" style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>No results for "{query}"</div>
        <div style={{ fontSize: 14 }}>Try different keywords or adjust the alpha slider</div>
      </div>
    )
  }

  return (
    <div id="search-results">
      {/* Meta bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, padding: '8px 0', borderBottom: '1px solid #1e293b' }}>
        <span style={{ fontSize: 13, color: '#64748b' }}>
          {response.meta.total} result{response.meta.total !== 1 ? 's' : ''} in {response.meta.latencyMs}ms
        </span>
        <span style={{ fontSize: 13, color: '#64748b' }}>·</span>
        <span style={{ fontSize: 13, color: '#64748b' }}>α = {response.meta.alpha.toFixed(2)}</span>
        {response.meta.embeddingProvider && (
          <>
            <span style={{ fontSize: 13, color: '#64748b' }}>·</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>via {response.meta.embeddingProvider}</span>
          </>
        )}
        {!response.meta.embeddingProvider && (
          <>
            <span style={{ fontSize: 13, color: '#64748b' }}>·</span>
            <span style={{ fontSize: 13, color: '#f59e0b' }}>fulltext only (AI worker offline)</span>
          </>
        )}
      </div>

      {/* Result cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {response.data.map((item) => {
          const title = (item.data['title'] as string) || (item.data['name'] as string) || item.id
          return (
            <div key={item.id} style={resultCardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: '#f1f5f9', flex: 1 }}>{title}</span>
                <MatchTypeBadge type={item.matchType} />
                <span style={{
                  fontSize: 11,
                  background: item.status === 'published' ? '#14532d' : '#1e293b',
                  color: item.status === 'published' ? '#4ade80' : '#94a3b8',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontWeight: 600,
                }}>
                  {item.status}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: item.snippet || item.chunkText ? 8 : 0 }}>
                <span style={{ fontSize: 12, color: '#64748b' }}>
                  {item.contentType}
                </span>
                <span style={{ fontSize: 12, color: '#334155' }}>·</span>
                <ScoreBar score={item.score} />
                <span style={{ fontSize: 11, color: '#475569' }}>{item.score.toFixed(5)}</span>
              </div>
              {item.snippet && (
                <div
                  style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}
                  dangerouslySetInnerHTML={{ __html: item.snippet }}
                />
              )}
              {!item.snippet && item.chunkText && (
                <div style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic', lineHeight: 1.5 }}>
                  "{item.chunkText.slice(0, 200)}{item.chunkText.length > 200 ? '…' : ''}"
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [searchedQuery, setSearchedQuery] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div style={appStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            ⬡ Rosmarium <span style={{ color: '#818cf8' }}>Search</span>
          </span>
        </div>
        <SearchBar
          onResults={(resp, q) => { setResults(resp); setSearchedQuery(q) }}
          onLoading={setLoading}
        />
      </header>
      <main style={mainStyle}>
        <SearchResults response={results} query={searchedQuery} loading={loading} />
      </main>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const appStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: '#0f172a',
  color: '#e2e8f0',
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
}

const headerStyle: React.CSSProperties = {
  background: '#1e293b',
  borderBottom: '1px solid #334155',
  padding: '16px 32px',
  display: 'flex',
  alignItems: 'center',
  gap: 32,
  flexWrap: 'wrap',
}

const mainStyle: React.CSSProperties = {
  maxWidth: 800,
  margin: '32px auto',
  padding: '0 24px',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 280,
  padding: '10px 14px',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 14,
  outline: 'none',
}

const btnStyle: React.CSSProperties = {
  padding: '10px 20px',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 14,
  whiteSpace: 'nowrap',
}

const suggestionsStyle: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  marginTop: 4,
  padding: '4px 0',
  listStyle: 'none',
  zIndex: 100,
  boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
}

const suggestionItemStyle: React.CSSProperties = {
  padding: '10px 16px',
  cursor: 'pointer',
  fontSize: 14,
  color: '#cbd5e1',
}

const alphaBoxStyle: React.CSSProperties = {
  marginTop: 8,
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 8,
  padding: '12px 16px',
}

const resultCardStyle: React.CSSProperties = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: 10,
  padding: '14px 18px',
  transition: 'border-color 0.2s',
}

// ─── Mount ────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
