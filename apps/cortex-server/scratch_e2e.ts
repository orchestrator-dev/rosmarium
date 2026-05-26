// E2E Integration Audit v0.8.0 — Complete (Run 2)
const BASE = "http://localhost:3000";
const COOKIE = "auth_session=ojffqecavjetk6i2mfenxvlloyrjgyh6r34dc2hc";

async function api(method: string, path: string, body?: unknown) {
  const hdrs: Record<string,string> = { Cookie: COOKIE };
  if (body !== undefined) hdrs["Content-Type"] = "application/json";
  const opts: RequestInit = { method, headers: hdrs };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(`${BASE}${path}`, opts);
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const R: { step: string; pass: boolean; detail: string }[] = [];
function rec(step: string, pass: boolean, detail: string) {
  console.log(`${pass ? "✅" : "❌"} [${step}] ${detail}`);
  R.push({ step, pass, detail });
}

async function main() {
  // ── Step 1: CT + settings update ──
  console.log("\n═══ Step 1: Content type + settings ═══");
  const ct = await api("POST", "/api/content-types", {
    name: "article", displayName: "Article",
    fields: [
      { type: "text", name: "title", label: "Title", required: true },
      { type: "richText", name: "body", label: "Body" },
      { type: "slug", name: "slug", label: "Slug", generatedFrom: "title" },
    ],
    settings: { aiIntelligence: { enabled: true, operations: ["tag","ner","deduplicate"], tagTaxonomy: ["technology","databases","ai","backend","search"] }, graph: { enabled: true, allowedEdgeTypes: [{ edgeType: "references", label: "References", bidirectional: false }, { edgeType: "relatedTo", label: "Related To", bidirectional: true }], autoInferSimilarity: true, similarityThreshold: 0.8, autoInferNER: true } },
  });
  rec("1-ct", ct.status === 201 || ct.status === 409, `status=${ct.status}`);
  // Always PATCH settings in case CT pre-existed without them
  await api("PATCH", "/api/content-types/article", {
    settings: { aiIntelligence: { enabled: true, operations: ["tag","ner","deduplicate"], tagTaxonomy: ["technology","databases","ai","backend","search"] }, graph: { enabled: true, allowedEdgeTypes: [{ edgeType: "references", label: "References", bidirectional: false }, { edgeType: "relatedTo", label: "Related To", bidirectional: true }], autoInferSimilarity: true, similarityThreshold: 0.8, autoInferNER: true } },
  });
  console.log("  Settings PATCH applied");

  // ── Step 2: Create 5 articles ──
  console.log("\n═══ Step 2: Create articles ═══");
  const articles = [
    { title: "Introduction to PostgreSQL pgvector", body: "pgvector is a PostgreSQL extension for vector similarity search. It enables semantic search directly in your database. Alice Johnson at Cortex CMS uses it for production RAG pipelines." },
    { title: "Building RAG Pipelines with LlamaIndex", body: "LlamaIndex provides tooling for retrieval augmented generation. When combined with PostgreSQL pgvector, you get a powerful knowledge base for AI applications." },
    { title: "Hybrid Search Architecture", body: "Combining BM25 full-text search with vector cosine similarity using Reciprocal Rank Fusion produces better results than either approach alone. PostgreSQL supports both natively." },
    { title: "Cortex CMS Quick Start Guide", body: "This guide covers installing Cortex CMS, configuring the AI worker, and creating your first content type with semantic search enabled." },
    { title: "Performance Tuning pgvector HNSW Indexes", body: "HNSW indexes in pgvector require careful tuning of m and ef_construction parameters. This guide covers production configuration for high-traffic deployments." },
  ];
  for (const a of articles) {
    const r = await api("POST", "/api/content/article", { data: { title: a.title, body: a.body } });
    rec("2-create", r.status === 201, `"${a.title.slice(0,35)}…" status=${r.status}`);
  }
  const list = await api("GET", "/api/content/article?limit=10");
  const entries = Array.isArray(list.data?.data) ? list.data.data : [];
  const ids = entries.map((e: any) => e.id).reverse();
  const [idA, idB, idC, idD, idE] = ids;
  rec("2-ids", ids.length >= 5, `found ${ids.length} entries`);

  // ── Step 3: Publish all ──
  console.log("\n═══ Step 3: Publish ═══");
  for (let i = 0; i < Math.min(ids.length, 5); i++) {
    const r = await api("POST", `/api/content/article/${ids[i]}/publish`);
    rec(`3-pub-${String.fromCharCode(65+i)}`, r.status === 200, `status=${r.status}`);
  }

  // ── Step 4: Wait ──
  console.log("\n═══ Step 4: Wait 30s for async pipelines ═══");
  await new Promise(r => setTimeout(r, 30000));

  // ── Step 5: Check embeddings via search ──
  console.log("\n═══ Step 5: Verify embeddings ═══");
  const searchCheck = await api("GET", "/api/search?q=pgvector&alpha=1");
  rec("5-embeddings", searchCheck.status === 200 && (searchCheck.data?.data?.length ?? 0) > 0, `vector results=${searchCheck.data?.data?.length ?? 0}`);

  // ── Step 6: Intelligence pipeline ──
  console.log("\n═══ Step 6: Intelligence pipeline ═══");
  const artA = await api("GET", `/api/content/article/${idA}`);
  const meta = artA.data?.data?.metadata;
  const aiTags = meta?.ai?.tags || [];
  const aiEnts = meta?.ai?.entities || {};
  rec("6-tags", aiTags.length > 0, `tags=${JSON.stringify(aiTags).slice(0,100)}`);
  rec("6-ner", Object.keys(aiEnts).length > 0, `entities=${JSON.stringify(aiEnts).slice(0,100)}`);

  // ── Step 7: Graph auto-inference ──
  console.log("\n═══ Step 7: Graph inference ═══");
  const pend = await api("GET", "/api/graph/pending");
  rec("7-pending", pend.status === 200, `count=${pend.data?.data?.length ?? 0}`);
  const graphEnts = await api("GET", "/api/graph/entities?entityType=ORG");
  rec("7-entities", graphEnts.status === 200, `count=${graphEnts.data?.data?.length ?? 0}`);

  // ── Step 8: Search ──
  console.log("\n═══ Step 8: Hybrid search ═══");
  const s1 = await api("GET", "/api/search?q=vector+similarity+search&alpha=0.5");
  rec("8-hybrid", s1.status === 200 && (s1.data?.data?.length ?? 0) > 0, `results=${s1.data?.data?.length} latency=${s1.data?.meta?.latencyMs}ms`);
  const s2 = await api("GET", "/api/search?q=vector+similarity+search&alpha=0");
  rec("8-fulltext", s2.status === 200, `results=${s2.data?.data?.length ?? 0}`);
  const s3 = await api("GET", "/api/search?q=vector+similarity+search&alpha=1");
  rec("8-vector", s3.status === 200, `results=${s3.data?.data?.length ?? 0}`);

  // ── Step 9: RAG ──
  console.log("\n═══ Step 9: RAG retrieval ═══");
  const rag1 = await api("POST", "/api/rag/retrieve", { query: "how does PostgreSQL support semantic search", topK: 5, format: "chunks" });
  rec("9-chunks", rag1.status === 200, `status=${rag1.status}`);
  const rag2 = await api("POST", "/api/rag/retrieve", { query: "how does PostgreSQL support semantic search", topK: 5, format: "context" });
  rec("9-context", rag2.status === 200, `hasCtx=${!!rag2.data?.data?.context}`);

  // ── Journey 2: Graph Ops ──
  console.log("\n═══ Step 11: Accept pending ═══");
  const pedges = (pend.data?.data || []).slice(0, 3);
  for (const e of pedges) {
    const r = await api("POST", `/api/graph/edges/${e.id}/accept`);
    rec("11-accept", r.status === 200, `edge=${e.id?.slice(0,8)} status=${r.status}`);
  }
  if (pedges.length === 0) rec("11-accept", true, "no pending edges to accept (expected if NER slow)");

  console.log("\n═══ Step 12: Manual edge ═══");
  const me = await api("POST", "/api/graph/edges", {
    fromEntryId: idA, fromContentType: "article", toEntryId: idB, toContentType: "article", edgeType: "references", weight: 1.0,
  });
  rec("12-manual", me.status === 201, `status=${me.status} source=${me.data?.data?.source}`);

  console.log("\n═══ Step 13: Traversal ═══");
  const trav = await api("GET", `/api/graph/traverse?from=${idA}&depth=2&populate=true`);
  rec("13-traverse", trav.status === 200, `nodes=${trav.data?.data?.nodes?.length ?? 0} edges=${trav.data?.data?.edges?.length ?? 0}`);
  const pathR = await api("GET", `/api/graph/path?from=${idA}&to=${idE}`);
  rec("13-path", pathR.status === 200, `found=${pathR.data?.data?.found}`);

  console.log("\n═══ Step 14: Recommendations ═══");
  const reco = await api("GET", `/api/graph/recommend?id=${idA}&contentType=article`);
  rec("14-recommend", reco.status === 200, `count=${reco.data?.data?.recommendations?.length ?? reco.data?.data?.length ?? 0}`);

  console.log("\n═══ Step 15: Cypher-lite ═══");
  const cy1 = await api("POST", "/api/graph/query", { query: `MATCH (n {id: "${idA}"})-[:references*1..2]->(m) RETURN m LIMIT 5` });
  rec("15-match", cy1.status === 200, `status=${cy1.status}`);
  const cy2 = await api("POST", "/api/graph/query", { query: "CREATE (n) RETURN n" });
  rec("15-write-blocked", cy2.status === 400, `status=${cy2.status}`);
  const cy3 = await api("POST", "/api/graph/query", { query: "MATCH (n)-[:references*1..10]->(m) RETURN m" });
  rec("15-depth-blocked", cy3.status === 400, `status=${cy3.status}`);

  console.log("\n═══ Step 16: Visualization ═══");
  const viz = await api("GET", `/api/graph/visualize?rootId=${idA}&depth=2`);
  rec("16-viz", viz.status === 200, `nodes=${viz.data?.data?.nodes?.length ?? 0} edges=${viz.data?.data?.edges?.length ?? 0}`);

  // ── Journey 3: Analytics + Export ──
  console.log("\n═══ Step 17: Analytics ═══");
  const comp = await api("POST", "/api/graph/analytics/compute", { contentType: "article" });
  rec("17-compute", comp.status === 202, `status=${comp.status}`);
  console.log("  Waiting 20s for NetworkX...");
  await new Promise(r => setTimeout(r, 20000));
  const anA = await api("GET", `/api/graph/analytics/${idA}`);
  rec("17-analytics", anA.status === 200, `status=${anA.status} pr=${anA.data?.data?.pagerankScore}`);

  console.log("\n═══ Step 18: Communities ═══");
  const comm = await api("GET", "/api/graph/communities/article");
  rec("18-communities", comm.status === 200, `count=${comm.data?.data?.length ?? 0}`);
  const infl = await api("GET", "/api/graph/influential/article?limit=5");
  rec("18-influential", infl.status === 200, `count=${infl.data?.data?.length ?? 0}`);

  console.log("\n═══ Step 19: Export ═══");
  for (const fmt of ["json-ld", "rdf", "graphml", "cytoscape"]) {
    const r = await api("GET", `/api/graph/export?format=${fmt}`);
    rec(`19-${fmt}`, r.status === 200, `status=${r.status}`);
  }

  // ── Journey 4: Webhooks ──
  console.log("\n═══ Step 20: Webhooks ═══");
  const wh = await api("POST", "/api/webhooks", { name: "audit webhook", url: "https://webhook.site/test", events: ["entry.created","entry.published"], contentTypes: [] });
  rec("20-webhook", wh.status === 201 || wh.status === 200, `status=${wh.status}`);

  // ── Journey 5: RBAC ──
  console.log("\n═══ Step 21: RBAC ═══");
  const reg = await api("POST", "/api/auth/register", { email: "vieweraudit@test.local", password: "testpass123", role: "viewer" });
  rec("21-register", reg.status === 201 || reg.status === 200 || reg.status === 409, `status=${reg.status}`);

  const loginRes = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "vieweraudit@test.local", password: "testpass123" }) });
  const vc = loginRes.headers.get("set-cookie")?.split(";")[0] || "";
  rec("21-login", loginRes.status === 200 && vc.length > 0, `status=${loginRes.status} cookie=${vc.slice(0,30)}`);

  async function vApi(method: string, path: string, body?: unknown) {
    const h: Record<string,string> = { Cookie: vc };
    if (body !== undefined) h["Content-Type"] = "application/json";
    const o: RequestInit = { method, headers: h };
    if (body !== undefined) o.body = JSON.stringify(body);
    const res = await fetch(`${BASE}${path}`, o);
    return { status: res.status };
  }

  const vc1 = await vApi("POST", "/api/content/article", { data: { title: "viewer test" } });
  rec("21-create-blocked", vc1.status === 403, `status=${vc1.status} (expect 403)`);
  const vc2 = await vApi("DELETE", `/api/content/article/${idA}`);
  rec("21-delete-blocked", vc2.status === 403, `status=${vc2.status} (expect 403)`);
  const vc4 = await vApi("GET", "/api/content/article");
  rec("21-read-ok", vc4.status === 200, `status=${vc4.status} (expect 200)`);
  const vc5 = await vApi("GET", "/api/search?q=pgvector");
  rec("21-search-ok", vc5.status === 200, `status=${vc5.status} (expect 200)`);

  // ── Summary ──
  console.log("\n\n════════════════════════════════════════════");
  console.log("  E2E INTEGRATION AUDIT v0.8.0 RESULTS");
  console.log("════════════════════════════════════════════");
  const passed = R.filter(r => r.pass).length;
  const failed = R.filter(r => !r.pass);
  console.log(`  TOTAL: ${passed}/${R.length} passed`);
  if (failed.length > 0) {
    console.log(`\n  FAILURES:`);
    failed.forEach(f => console.log(`    ❌ ${f.step}: ${f.detail}`));
  }
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
