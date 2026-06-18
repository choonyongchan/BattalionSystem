# Graph Report - .  (2026-06-18)

## Corpus Check
- Corpus is ~3,700 words - fits in a single context window. You may not need a graph.

## Summary
- 107 nodes · 152 edges · 12 communities (7 shown, 5 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 8 edges (avg confidence: 0.85)
- Token cost: 12,800 input · 2,100 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Parade State Management|Parade State Management]]
- [[_COMMUNITY_TypeScript Configuration|TypeScript Configuration]]
- [[_COMMUNITY_Next.js & Dependencies|Next.js & Dependencies]]
- [[_COMMUNITY_App Routing & Navigation|App Routing & Navigation]]
- [[_COMMUNITY_Nominal Roll & Rank Logic|Nominal Roll & Rank Logic]]
- [[_COMMUNITY_CSS Toolchain|CSS Toolchain]]
- [[_COMMUNITY_Supabase & Dev Config|Supabase & Dev Config]]
- [[_COMMUNITY_Root Layout & Metadata|Root Layout & Metadata]]
- [[_COMMUNITY_MCP Server Config|MCP Server Config]]
- [[_COMMUNITY_PostCSS Config|PostCSS Config]]
- [[_COMMUNITY_Tailwind Config|Tailwind Config]]
- [[_COMMUNITY_Behavioral Guidelines|Behavioral Guidelines]]

## God Nodes (most connected - your core abstractions)
1. `ParadeState()` - 18 edges
2. `compilerOptions` - 15 edges
3. `NominalRoll()` - 9 edges
4. `COMPANIES` - 8 edges
5. `ParadeState.load` - 8 edges
6. `Company` - 7 edges
7. `COMPANY_LABELS` - 5 edges
8. `getSupabaseClient()` - 5 edges
9. `Soldier` - 5 edges
10. `scripts` - 5 edges

## Surprising Connections (you probably didn't know these)
- `README - Company Colour Themes` --references--> `COMPANIES`  [INFERRED]
  README.md → lib/companies.ts
- `generateStaticParams()` --references--> `COMPANIES`  [EXTRACTED]
  app/[company]/page.tsx → lib/companies.ts
- `NominalRoll()` --calls--> `getSupabaseClient`  [EXTRACTED]
  components/NominalRoll.tsx → lib/supabase.ts
- `ParadeState()` --calls--> `getSupabaseClient()`  [EXTRACTED]
  components/ParadeState.tsx → lib/supabase.ts
- `ParadeState()` --calls--> `getSupabaseClient`  [EXTRACTED]
  components/ParadeState.tsx → lib/supabase.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Per-Company Supabase Data Flow** — lib_companies_company, lib_supabase_getsupabseclient, components_nominalroll_nominalroll, components_paradestate_paradestate [INFERRED 0.90]
- **Parade State Report: Data Sources Aggregated at Generate** — lib_supabase_soldier, lib_supabase_exception, lib_supabase_dutyentry, lib_supabase_configuration, components_paradestate_generate [INFERRED 0.95]
- **Company Dynamic Routing Pattern** — lib_companies_companies, company_page_generatestaticparams, company_page_companypage, components_companycontent_companycontent [EXTRACTED 0.95]

## Communities (12 total, 5 thin omitted)

### Community 0 - "Parade State Management"
Cohesion: 0.18
Nodes (18): ParadeState.addConfig, ParadeState.addDuty, ParadeState.addException, ParadeState.deleteConfig, ParadeState.deleteDuty, ParadeState.deleteException, EXCEPTION_SCOPES, ExceptionScope (+10 more)

### Community 1 - "TypeScript Configuration"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 2 - "Next.js & Dependencies"
Cohesion: 0.12
Nodes (15): nextConfig, dependencies, next, react, react-dom, @supabase/supabase-js, name, private (+7 more)

### Community 3 - "App Routing & Navigation"
Cohesion: 0.28
Nodes (11): HomePage(), CompanyPage(), generateStaticParams(), CompanyContent(), Tab, TABS, COMPANIES, Company (+3 more)

### Community 4 - "Nominal Roll & Rank Logic"
Cohesion: 0.22
Nodes (12): NominalRoll.addSoldier, NominalRoll.deleteSoldier, getRankType(), NominalRoll.load, NominalRoll(), OFFICER_PREFIXES, RANKS_BY_TYPE, SECTION_ORDER (+4 more)

### Community 5 - "CSS Toolchain"
Cohesion: 0.25
Nodes (8): devDependencies, autoprefixer, postcss, tailwindcss, @types/node, @types/react, @types/react-dom, typescript

### Community 6 - "Supabase & Dev Config"
Cohesion: 0.40
Nodes (5): Claude Settings (Project), Claude Settings Local, Per-Company Supabase Client Pattern, getSupabaseClient, MCP Server Configuration

## Knowledge Gaps
- **53 isolated node(s):** `supabase`, `metadata`, `Tab`, `TABS`, `OFFICER_PREFIXES` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ParadeState()` connect `Parade State Management` to `App Routing & Navigation`, `Nominal Roll & Rank Logic`, `Supabase & Dev Config`?**
  _High betweenness centrality (0.081) - this node is a cross-community bridge._
- **Why does `getSupabaseClient` connect `Supabase & Dev Config` to `Parade State Management`, `App Routing & Navigation`, `Nominal Roll & Rank Logic`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `NominalRoll()` connect `Nominal Roll & Rank Logic` to `App Routing & Navigation`, `Supabase & Dev Config`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **What connects `supabase`, `metadata`, `Tab` to the rest of the system?**
  _54 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `TypeScript Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `Next.js & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._