# Rosmarium COS — Current Development Phase

## Active Phase: V2 Phase 1 — Content Authoring Revolution
**Target release:** v2.0.0-alpha
**Duration:** Month 1 - 3

## Completed V1 Phases
- ✅ V1 Phase 1 — CMS Foundation
- ✅ V1 Phase 2 — AI Layer
- ✅ V1 Phase 3 — API Layer & Graph
- ✅ V1 Phase 4 — Expansion & Scalability (v1.0.1 released)

## V2 Phase 1 Checklist (In Progress)

### Month 1: Structured Rich Text Engine (G01, G03)
- [ ] **Task 1.1: Block-Based Document Model**
  - [ ] `BlockDocument` schema in `packages/types`
  - [ ] Update `richText` field validation
  - [ ] Block serializers (HTML, Markdown, Plain Text)
- [ ] **Task 1.2: Tiptap/ProseMirror Editor Integration**
  - [ ] Add `@tiptap/react` and extensions to admin
  - [ ] `BlockEditor.tsx` main component
  - [ ] Slash command menu (`/`)
- [ ] **Task 1.3: Content Templates System**
  - [ ] `content_templates` DB table
  - [ ] Templates service and REST API
  - [ ] Admin UI "Save as Template" / template picker

### Month 2: Live Preview Engine (G02, G04)
- [ ] **Task 2.1: Preview API & Token System**
  - [ ] JWT preview tokens (1hr TTL)
  - [ ] Live draft resolution API
  - [ ] Admin UI side-by-side preview panel
- [ ] **Task 2.2: Conditional Fields**
  - [ ] Condition schema definitions
  - [ ] Admin UI dynamic show/hide fields
  - [ ] Server-side conditional validation

### Month 3: Admin UI Polish & Content Hierarchy
- [ ] **Task 3.1: Content Tree View**
  - [ ] Recursive tree UI using graph edges
  - [ ] Drag-and-drop reordering
- [ ] **Task 3.2: Bulk Operations**
  - [ ] Multi-select floating action bar
  - [ ] Transactional batch publish, delete, AI tag

## Notes
Official transition from V1.0.1 to V2 Roadmap.
Current priority: **Month 1 — Structured Rich Text Engine**.
Use the `/v2-feature` playbook to generate an implementation plan for Task 1.1.