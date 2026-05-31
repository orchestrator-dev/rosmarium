# Rosmarium COS — Current Development Phase

## Active Phase: V2 Phase 3 — Developer Experience & Extensibility
**Target release:** v2.0.0-beta
**Duration:** Month 7 - 9

## Completed V1 Phases
- ✅ V1 Phase 1 — CMS Foundation
- ✅ V1 Phase 2 — AI Layer
- ✅ V1 Phase 3 — API Layer & Graph
- ✅ V1 Phase 4 — Expansion & Scalability (v1.0.1 released)

## Completed V2 Phases
- ✅ V2 Phase 1 — Content Authoring Revolution (Months 1-3)
  - Month 1: Structured Rich Text Engine (G01, G03)
  - Month 2: Live Preview Engine (G02, G04)
  - Month 3: Admin UI Polish & Content Hierarchy
- ✅ V2 Phase 2 — Workflow & Collaboration Engine (Months 4-6)
  - Month 4: Workflow Automation Engine (G05)
  - Month 5: Content Branching & Environments (G07)
  - Month 6: Real-Time Collaboration Foundation (G06, G26)

## V2 Phase 3 Checklist (In Progress)

### Month 7: Plugin/Extension System (G09)
- [x] **Task 7.1: Plugin Architecture**
  - [x] `packages/types/src/plugin.ts` Plugin interface definitions
  - [x] Plugin registry, discovery, loading, and validation
  - [x] Hook engine execution with priority ordering
  - [x] Admin UI plugin loader
- [ ] **Task 7.2: Custom Field Types & Routes**
  - [ ] Allow plugins to register custom REST routes
  - [ ] Allow plugins to register custom field types
  - [ ] Allow plugins to extend GraphQL schema

### Month 8: CLI & Config-as-Code (G10, G11)
- [x] **Task 8.1: CLI Implementation**
  - [x] Rewrite CLI in TypeScript with Commander.js
  - [x] `rosmarium init`, `dev`, `migrate` commands
  - [x] `rosmarium content export/import` commands
- [x] **Task 8.2: Config-as-Code System**
  - [x] `rosmarium schema pull/push/diff` commands
  - [x] Bidirectional schema sync (DB ↔ YAML files)

### Month 9: SDK Integrations & i18n (G12, G13)
- [ ] **Task 9.1: SDK/Framework Integrations**
- [ ] **Task 9.2: Full i18n Framework**

## Notes
Official transition from V2 Phase 2 to Phase 3 Roadmap.
Current priority: **Month 7 — Plugin/Extension System**.
Use the `/v2-feature` playbook to generate an implementation plan for Task 7.1.