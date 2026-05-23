import React from 'react'
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
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  return React.useCallback((...args: Parameters<T>) => {
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
  const [query, setQuery] = React.useState('')
  const [suggestions, setSuggestions] = React.useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = React.useState(false)
  const [alpha, setAlpha] = React.useState(0.5)
  const [showAlpha, setShowAlpha] = React.useState(false)

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
          onClick={() => setShowAlpha((v: boolean) => !v)}
          style={{ ...btnStyle, background: '#334155', fontSize: 12 }}
          title="Advanced: adjust keyword vs semantic balance"
        >
          ⚙️ Alpha
        </button>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <ul style={suggestionsStyle} id="search-suggestions">
          {suggestions.map((s: string, i: number) => (
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

// ─── AI Dashboard ────────────────────────────────────────────────────────────

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

function Panel({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#1e293b',
      border: '1px solid #334155',
      borderRadius: 12,
      padding: '20px 24px',
      marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 20 }}>{icon}</span>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>{title}</h2>
      </div>
      {children}
    </div>
  )
}

function QueueStatCard({ stat }: { stat: QueueStat }) {
  return (
    <div style={{
      background: '#0f172a',
      border: '1px solid #334155',
      borderRadius: 8,
      padding: '12px 16px',
      flex: '1 1 200px',
    }}>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {stat.queueName}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          { label: 'waiting', value: stat.waiting, color: '#f59e0b' },
          { label: 'active', value: stat.active, color: '#22d3ee' },
          { label: 'done', value: stat.completed, color: '#4ade80' },
          { label: 'failed', value: stat.failed, color: '#f87171' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={{ fontSize: 10, color: '#64748b' }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function AIDashboard() {
  const [queueStats, setQueueStats] = React.useState<QueueStat[]>([])
  const [queueLoading, setQueueLoading] = React.useState(false)
  const [dupContentType, setDupContentType] = React.useState('')
  const [dupResults, setDupResults] = React.useState<DuplicatePair[]>([])
  const [dupLoading, setDupLoading] = React.useState(false)
  const [dupError, setDupError] = React.useState<string | null>(null)
  const [tagContentType, setTagContentType] = React.useState('')
  const [tagLabel, setTagLabel] = React.useState('')
  const [taxonomy, setTaxonomy] = React.useState<string[]>(['technology', 'business', 'science', 'health', 'politics'])

  // Poll queue stats every 5 seconds
  React.useEffect(() => {
    const fetchStats = async () => {
      setQueueLoading(true)
      try {
        const res = await fetch('/api/admin/queue-stats')
        if (res.ok) {
          const json = await res.json() as { data: QueueStat[] }
          setQueueStats(json.data)
        }
      } catch { /* ignore */ }
      finally { setQueueLoading(false) }
    }
    void fetchStats()
    const interval = setInterval(() => void fetchStats(), 5000)
    return () => clearInterval(interval)
  }, [])

  const scanDuplicates = async () => {
    if (!dupContentType.trim()) return
    setDupLoading(true)
    setDupError(null)
    try {
      const res = await fetch(`/api/content/${dupContentType}/duplicates`)
      if (res.ok) {
        const json = await res.json() as { pairs: DuplicatePair[] }
        setDupResults(json.pairs)
      } else {
        setDupError(`Error: ${res.status}`)
      }
    } catch (e) {
      setDupError(String(e))
    } finally {
      setDupLoading(false)
    }
  }

  const addLabel = () => {
    const label = tagLabel.trim().toLowerCase()
    if (label && !taxonomy.includes(label)) {
      setTaxonomy(prev => [...prev, label])
      setTagLabel('')
    }
  }

  const removeLabel = (label: string) => setTaxonomy(prev => prev.filter(l => l !== label))

  return (
    <div style={{ maxWidth: 900, margin: '32px auto', padding: '0 24px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: '#f1f5f9', margin: '0 0 4px' }}>
          🧠 AI Intelligence Dashboard
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
          Monitor embedding coverage, manage auto-tagging, detect duplicates, and track AI queue health.
        </p>
      </div>

      {/* Panel 1 — Embedding Coverage */}
      <Panel title="Embedding Coverage" icon="📊">
        <p style={{ color: '#94a3b8', fontSize: 13 }}>
          Embedding coverage is tracked via the <code style={{ color: '#818cf8' }}>metadata.embeddedAt</code> field
          on each content entry. Use the search or RAG endpoints to verify embeddings are live.
        </p>
        <div style={{
          background: '#0f172a',
          border: '1px solid #334155',
          borderRadius: 8,
          padding: '12px 16px',
          marginTop: 8,
        }}>
          <div style={{ fontSize: 12, color: '#4ade80', marginBottom: 4 }}>✅ pgvector active</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>
            Embedding tables follow the pattern <code style={{ color: '#818cf8' }}>rosmarium_{'{type}'}_embeddings</code>
          </div>
        </div>
      </Panel>

      {/* Panel 2 — Auto-tagging taxonomy */}
      <Panel title="Auto-tagging Taxonomy" icon="🏷️">
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
            Content Type
          </label>
          <input
            id="tag-content-type"
            type="text"
            value={tagContentType}
            onChange={e => setTagContentType(e.target.value)}
            placeholder="e.g. article"
            style={dashInputStyle}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
            Tag Taxonomy
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {taxonomy.map(label => (
              <span
                key={label}
                id={`tag-label-${label}`}
                style={{
                  background: '#312e81',
                  color: '#a5b4fc',
                  borderRadius: 99,
                  padding: '4px 10px',
                  fontSize: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {label}
                <button
                  onClick={() => removeLabel(label)}
                  style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', padding: 0, fontSize: 14, lineHeight: 1 }}
                >×</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="add-tag-input"
              type="text"
              value={tagLabel}
              onChange={e => setTagLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addLabel() }}
              placeholder="Add a label…"
              style={{ ...dashInputStyle, flex: 1 }}
            />
            <button id="add-tag-btn" onClick={addLabel} style={dashBtnStyle}>Add</button>
          </div>
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 8 }}>
          Configure <code style={{ color: '#818cf8' }}>aiIntelligence.tagTaxonomy</code> in your content type settings to use this taxonomy.
        </div>
      </Panel>

      {/* Panel 3 — Duplicate Detection */}
      <Panel title="Duplicate Detection" icon="🔎">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            id="dup-content-type"
            type="text"
            value={dupContentType}
            onChange={e => setDupContentType(e.target.value)}
            placeholder="Content type (e.g. article)"
            style={{ ...dashInputStyle, flex: 1 }}
          />
          <button
            id="scan-duplicates-btn"
            onClick={() => void scanDuplicates()}
            disabled={dupLoading}
            style={{ ...dashBtnStyle, opacity: dupLoading ? 0.6 : 1 }}
          >
            {dupLoading ? '⏳ Scanning…' : '🔍 Scan'}
          </button>
        </div>

        {dupError && (
          <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{dupError}</div>
        )}

        {dupResults.length > 0 ? (
          <div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 8 }}>
              Found {dupResults.length} duplicate pair{dupResults.length !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dupResults.map((pair, i) => (
                <div key={i} style={{
                  background: '#0f172a',
                  border: '1px solid #7f1d1d',
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <span style={{ fontSize: 12, color: '#94a3b8', flex: 1, fontFamily: 'monospace' }}>
                    {pair.entryIdA.slice(0, 8)}…
                  </span>
                  <span style={{ fontSize: 11, color: '#475569' }}>↔</span>
                  <span style={{ fontSize: 12, color: '#94a3b8', flex: 1, fontFamily: 'monospace' }}>
                    {pair.entryIdB.slice(0, 8)}…
                  </span>
                  <span style={{
                    background: pair.score >= 0.95 ? '#7f1d1d' : '#78350f',
                    color: pair.score >= 0.95 ? '#fca5a5' : '#fcd34d',
                    borderRadius: 99,
                    padding: '2px 8px',
                    fontSize: 11,
                    fontWeight: 700,
                  }}>
                    {(pair.score * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : dupResults.length === 0 && !dupLoading && dupContentType && !dupError ? (
          <div style={{ color: '#4ade80', fontSize: 13 }}>✅ No duplicates found</div>
        ) : null}
      </Panel>

      {/* Panel 4 — Intelligence Queue */}
      <Panel title="Intelligence Queue" icon="⚡">
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Live stats · refreshes every 5s</span>
            {queueLoading && <span style={{ fontSize: 12, color: '#818cf8' }}>↻ Refreshing…</span>}
          </div>
          {queueStats.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {queueStats.map(stat => <QueueStatCard key={stat.queueName} stat={stat} />)}
            </div>
          ) : (
            <div style={{ color: '#475569', fontSize: 13 }}>
              {queueLoading ? 'Loading queue stats…' : 'Queue stats unavailable (requires admin auth)'}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#475569', marginTop: 4 }}>
          Queues: <code style={{ color: '#818cf8' }}>embedding-jobs</code>,{' '}
          <code style={{ color: '#818cf8' }}>intelligence-jobs</code>,{' '}
          <code style={{ color: '#818cf8' }}>webhook-deliveries</code>
        </div>
      </Panel>
    </div>
  )
}

// ─── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [results, setResults] = React.useState<SearchResponse | null>(null)
  const [searchedQuery, setSearchedQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [view, setView] = React.useState<'search' | 'ai'>('search')

  return (
    <div style={appStyle}>
      <header style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            ⬡ Rosmarium
          </span>
          <nav style={{ display: 'flex', gap: 4 }}>
            <button
              id="nav-search"
              onClick={() => setView('search')}
              style={{
                ...navBtnStyle,
                background: view === 'search' ? '#6366f1' : 'transparent',
                color: view === 'search' ? '#fff' : '#94a3b8',
              }}
            >
              🔍 Search
            </button>
            <button
              id="nav-ai"
              onClick={() => setView('ai')}
              style={{
                ...navBtnStyle,
                background: view === 'ai' ? '#6366f1' : 'transparent',
                color: view === 'ai' ? '#fff' : '#94a3b8',
              }}
            >
              🧠 AI
            </button>
          </nav>
        </div>
        {view === 'search' && (
          <SearchBar
            onResults={(resp, q) => { setResults(resp); setSearchedQuery(q) }}
            onLoading={setLoading}
          />
        )}
      </header>
      <main style={mainStyle}>
        {view === 'search' && <SearchResults response={results} query={searchedQuery} loading={loading} />}
        {view === 'ai' && <AIDashboard />}
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
  maxWidth: 900,
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

const navBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  transition: 'background 0.15s, color 0.15s',
}

const dashInputStyle: React.CSSProperties = {
  padding: '9px 13px',
  background: '#0f172a',
  border: '1px solid #334155',
  borderRadius: 8,
  color: '#f1f5f9',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const dashBtnStyle: React.CSSProperties = {
  padding: '9px 18px',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  fontWeight: 600,
  fontSize: 13,
  whiteSpace: 'nowrap',
}

// ─── Mount ────────────────────────────────────────────────────────────────────

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
