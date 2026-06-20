# Graph Report - .  (2026-06-20)

## Corpus Check
- Corpus is ~5,594 words - fits in a single context window. You may not need a graph.

## Summary
- 128 nodes · 167 edges · 16 communities (8 shown, 8 thin omitted)
- Extraction: 87% EXTRACTED · 13% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Nominal Roll Display|Nominal Roll Display]]
- [[_COMMUNITY_TypeScript Compiler Options|TypeScript Compiler Options]]
- [[_COMMUNITY_Commander Login & Lockout|Commander Login & Lockout]]
- [[_COMMUNITY_Runtime Dependencies|Runtime Dependencies]]
- [[_COMMUNITY_Schema Sync & Dev Guidelines|Schema Sync & Dev Guidelines]]
- [[_COMMUNITY_App Page Routing|App Page Routing]]
- [[_COMMUNITY_Dev Build Dependencies|Dev Build Dependencies]]
- [[_COMMUNITY_App Root Layout|App Root Layout]]
- [[_COMMUNITY_Next.js Configuration|Next.js Configuration]]
- [[_COMMUNITY_PostCSS Configuration|PostCSS Configuration]]
- [[_COMMUNITY_CSS Toolchain Config|CSS Toolchain Config]]
- [[_COMMUNITY_Claude Tool Permissions|Claude Tool Permissions]]
- [[_COMMUNITY_Project Claude Settings|Project Claude Settings]]
- [[_COMMUNITY_Project README|Project README]]
- [[_COMMUNITY_TypeScript Config File|TypeScript Config File]]

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `Company` - 6 edges
3. `getSupabaseClient()` - 6 edges
4. `useAuth()` - 6 edges
5. `Canonical Schema Across All Companies` - 6 edges
6. `COMPANY_THEMES` - 5 edges
7. `scripts` - 5 edges
8. `Per-Company Pastel Color Token System` - 5 edges
9. `Row Level Security Policies` - 5 edges
10. `storageKey()` - 4 edges

## Surprising Connections (you probably didn't know these)
- `CLAUDE.md - Behavioral Guidelines` --conceptually_related_to--> `Canonical Schema Across All Companies`  [INFERRED]
  CLAUDE.md → supabase/schema.sql
- `CompanyContent()` --calls--> `useAuth()`  [EXTRACTED]
  components/CompanyContent.tsx → lib/useAuth.ts
- `useAuth()` --implements--> `Commander-Only Access Control Pattern`  [INFERRED]
  lib/useAuth.ts → supabase/schema.sql
- `nextConfig` --references--> `package.json - Project Manifest`  [INFERRED]
  next.config.mjs → package.json
- `PostCSS Config` --conceptually_related_to--> `Tailwind Config`  [INFERRED]
  postcss.config.mjs → tailwind.config.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Commander Authentication Gate Flow** — components_companycontent, components_commanderloginform, concept_lockout_auth [INFERRED 0.85]
- **Per-Company Data Access Pattern** — lib_supabase_getsupabaseclient, concept_per_company_supabase, lib_companies [INFERRED 0.90]
- **Parade State Multi-Table Data Flow** — components_paradestate, lib_supabase_soldier, lib_supabase_exception, lib_supabase_dutyentry, lib_supabase_configuration [EXTRACTED 1.00]
- **Commander Authentication and RLS Access Control Flow** — lib_useauth_useauth, supabase_schema_rls, concept_commander_access_control, concept_password_auth [INFERRED 0.85]
- **Canonical Schema Definition and Multi-Company Sync** — supabase_schema_nominalroll, supabase_schema_exceptions, supabase_schema_duty, supabase_schema_configuration, scripts_sync_schema, concept_canonical_schema [INFERRED 0.90]

## Communities (16 total, 8 thin omitted)

### Community 0 - "Nominal Roll Display"
Cohesion: 0.10
Nodes (23): ALL_RANKS, RANKS_BY_TYPE, RankSearch(), SECTION_ORDER, DUTY_TYPES, EXCEPTION_SCOPES, ExceptionScope, PARADE_TYPES (+15 more)

### Community 1 - "TypeScript Compiler Options"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 2 - "Commander Login & Lockout"
Cohesion: 0.17
Nodes (14): clearCooldown(), CommanderLoginForm(), readCooldown(), saveCooldown(), storageKey(), CompanyContent(), Tab, TABS (+6 more)

### Community 3 - "Runtime Dependencies"
Cohesion: 0.14
Nodes (13): dependencies, next, react, react-dom, @supabase/supabase-js, name, private, scripts (+5 more)

### Community 4 - "Schema Sync & Dev Guidelines"
Cohesion: 0.21
Nodes (11): CLAUDE.md - Behavioral Guidelines, Canonical Schema Across All Companies, PROJECT_REFS, schemaPath, sql, targets, Configuration Table, Duty Table (+3 more)

### Community 5 - "App Page Routing"
Cohesion: 0.33
Nodes (7): CompanyPage(), Disabled Companies Gate (Coming Soon), Per-Company Pastel Color Token System, COMPANIES, COMPANY_THEMES, companyLabel(), DISABLED_COMPANIES

### Community 6 - "Dev Build Dependencies"
Cohesion: 0.25
Nodes (8): devDependencies, postcss, tailwindcss, @tailwindcss/postcss, @types/node, @types/react, @types/react-dom, typescript

## Knowledge Gaps
- **64 isolated node(s):** `metadata`, `Tab`, `TABS`, `RANKS_BY_TYPE`, `SECTION_ORDER` (+59 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useAuth()` connect `Commander Login & Lockout` to `Nominal Roll Display`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Why does `Commander-Only Access Control Pattern` connect `Commander Login & Lockout` to `Schema Sync & Dev Guidelines`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Why does `Row Level Security Policies` connect `Schema Sync & Dev Guidelines` to `Commander Login & Lockout`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **What connects `metadata`, `Tab`, `TABS` to the rest of the system?**
  _66 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Nominal Roll Display` be split into smaller, more focused modules?**
  _Cohesion score 0.09655172413793103 - nodes in this community are weakly interconnected._
- **Should `TypeScript Compiler Options` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Runtime Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._