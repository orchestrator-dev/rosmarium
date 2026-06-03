# Rosmarium COS — Current Development Phase

## Active Phase: V2 Phase 1 — Content Authoring Revolution
**Target release:** v2.0.0
**Duration:** Months 1-3

## Completed V1 Phases
- ✅ V1 Phase 1 — CMS Foundation
- ✅ V1 Phase 2 — AI Layer
- ✅ V1 Phase 3 — API Layer & Graph
- ✅ V1 Phase 4 — Expansion & Scalability (v1.1.1 released)

## Planned V2 Phases
- ⏳ V2 Phase 1 — Content Authoring Revolution (Months 1-3)
  - Month 1: Structured Rich Text Engine (G01, G03)
  - Month 2: Live Preview Engine (G02, G04)
  - Month 3: Admin UI Polish & Content Hierarchy
- ⏳ V2 Phase 2 — Workflow & Collaboration Engine (Months 4-6)
  - Month 4: Workflow Automation Engine (G05)
  - Month 5: Content Branching & Environments (G07)
  - Month 6: Real-Time Collaboration Foundation (G06, G26)
- ⏳ V2 Phase 3 — Developer Experience & Extensibility (Months 7-9)
  - Month 7: Plugin/Extension System (G09)
  - Month 8: CLI & Config-as-Code (G10, G11)
  - Month 9: SDK Integrations & i18n (G12, G13)
- ⏳ V2 Phase 4 — AI-Native Content Intelligence (Month 10)
  - Month 10: Generative AI Content Studio (G15)
  - Month 10: AI Governance Framework & Smart Search (G16, G17)

## V2 Phase 1 Checklist (Starting Soon)

### Month 7: Plugin/Extension System (G09)
- [x] **Task 7.1: Plugin Architecture**
  - [x] `packages/types/src/plugin.ts` Plugin interface definitions
  - [x] Plugin registry, discovery, loading, and validation
  - [x] Hook engine execution with priority ordering
  - [x] Admin UI plugin loader
- [x] **Task 7.2: Custom Field Types & Routes**
  - [x] Allow plugins to register custom REST routes
  - [x] Allow plugins to register custom field types
  - [x] Allow plugins to extend GraphQL schema

### Month 8: CLI & Config-as-Code (G10, G11)
- [x] **Task 8.1: CLI Implementation**
  - [x] Rewrite CLI in TypeScript with Commander.js
  - [x] `rosmarium init`, `dev`, `migrate` commands
  - [x] `rosmarium content export/import` commands
- [x] **Task 8.2: Config-as-Code System**
  - [x] `rosmarium schema pull/push/diff` commands
  - [x] Bidirectional schema sync (DB ↔ YAML files)

### Month 9: SDK Integrations & i18n (G12, G13)
- [x] **Task 9.1: SDK/Framework Integrations**
- [x] **Task 9.2: Full i18n Framework**

## V2 Phase 5 Checklist (In Progress)

### Month 12: Edge Delivery Network (G18)
- [x] **Task 12.1: Edge Content API**
  - [x] `apps/rosmarium-edge/` Edge worker application
  - [x] `apps/rosmarium-edge/src/worker.ts` Cloudflare Worker entry point
  - [x] `apps/rosmarium-edge/src/cache.ts` Tiered cache (edge KV → origin)
  - [x] `apps/rosmarium-edge/src/router.ts` Edge API routing
  - [x] `apps/rosmarium-server/src/modules/cache/invalidation.service.ts` Cache invalidation via webhooks

### Month 13: Media Processing Pipeline (G21)
- [x] **Task 13.1: Image Processing**
  - [x] `apps/rosmarium-server/src/modules/media/processing.service.ts` Image processing with Sharp
  - [x] `apps/rosmarium-server/src/modules/media/transforms.ts` Transformation definitions
  - [x] `apps/rosmarium-server/src/modules/media/media.routes.ts` Transformation query parameters

### Month 14: Performance & Horizontal Scale
- [x] **Task 14.1: Query Performance Optimization**
  - [x] `apps/rosmarium-server/src/modules/content/query.builder.ts` Optimize relation loading
  - [x] `apps/rosmarium-server/src/modules/content/dataloader.ts` DataLoader for batched relation resolution
  - [x] `apps/rosmarium-server/src/modules/content/cache.service.ts` Redis caching layer

## V2 Phase 6 Checklist (In Progress)

### Month 15: SSO & Advanced Auth (G22)
- [x] **Task 15.1: SSO/OAuth/OIDC Integration**
  - [x] OAuth 2.0 authorization code flow with PKCE
  - [x] OIDC discovery
  - [x] SAML 2.0 SP-initiated flow
  - [x] Auto-provision users from SSO claims
  - [x] Role mapping from SSO groups/claims
  - [x] Admin UI: SSO provider configuration

### Month 16: Workspaces & Governance (G23, G24, G25)
- [x] **Task 16.1: Workspaces & Isolation (G23)**
  - [x] DB schema updates for workspace separation
  - [x] API routes and service layer logic
  - [x] RBAC middleware injection
- [x] **Task 16.2: Content Governance & Audit (G24, G25)**
  - [x] Freshness decay and ROT detection logic
  - [x] Governance API routes
  - [x] Governance & Audit Admin UIs

## Notes
V1 (including all scaling and edge features) is now officially complete.
Current priority: **V2 Phase 1 Kickoff!** Preparing for structured rich text and block editor.