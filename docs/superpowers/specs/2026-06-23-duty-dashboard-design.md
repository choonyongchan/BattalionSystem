# Duty Dashboard — Design Spec

**Date:** 2026-06-23  
**Status:** Approved

---

## Problem

Duty assignment is currently done ad-hoc with no visibility into how many duties each soldier has done. This creates fairness issues. Commanders need a point-based view to assign duties equitably.

---

## Goal

A per-company dashboard at `/[company]/dashboard` that:
1. Computes cumulative duty points per soldier (weighted by duty type)
2. Suggests the next eligible person per duty type (lowest points, not back-to-back)
3. Lets commanders filter by rank type (Officers / WOSPECs / Troopers)
4. Lets commanders adjust duty type weights (stored in Supabase)

---

## Route

`app/[company]/dashboard/page.tsx` — new static page, same auth-guard pattern as the existing company page.

A "Dashboard" link is added to the existing `CompanyContent.tsx` nav so commanders can navigate to it.

---

## Data Sources (no schema changes)

| Table | Used for |
|---|---|
| `{Company}_Duty` | Raw duty entries: `duty_type`, `date`, `name` |
| `{Company}_NominalRoll` | Rank lookup per soldier for eligibility filtering |
| `{Company}_Configuration` | Weight rows: `parade_type = 'weight_CDO'`, `time = '1'` |

Weights default to `1` when no Configuration row exists for that duty type.

---

## Point Calculation

```ts
// ponytail: client-side — battalion data is small, no RPC needed
function computePoints(
  duties: DutyEntry[],
  weights: Record<string, number>
): Record<string, number> {
  return duties.reduce((acc, d) => {
    acc[d.name] = (acc[d.name] ?? 0) + (weights[d.duty_type] ?? 1)
    return acc
  }, {} as Record<string, number>)
}
```

---

## Rank Eligibility Rules

Hardcoded in `components/DutyDashboard.tsx`, derived from `RANKS_BY_TYPE` in `lib/companies.ts`.

| Duty type | Eligible ranks |
|---|---|
| CDO | Officers only (2LT and above) |
| CDS | WOSPECs 2SG and above (excludes 3SG) |
| PDS1–PDS4 | All WOSPECs (3SG and above) |
| COS | LCP, CPL, CFC + all WOSPECs + all Officers |

```ts
const ELIGIBILITY: Record<string, (rank: string) => boolean> = {
  CDO:  rank => getRankType(rank) === 'Officer',
  CDS:  rank => ['2SG','1SG','SSG','MSG','ME1','ME2','ME3','3WO','2WO','1WO','MWO','SWO','CWO'].includes(rank),
  COS:  rank => !['REC','PTE'].includes(rank),
  PDS1: rank => getRankType(rank) === 'WOSPEC',
  PDS2: rank => getRankType(rank) === 'WOSPEC',
  PDS3: rank => getRankType(rank) === 'WOSPEC',
  PDS4: rank => getRankType(rank) === 'WOSPEC',
}
```

---

## Suggestion Logic

For each duty type visible to the active filter:
1. Filter soldiers by eligibility rule above
2. Exclude anyone who did **any** duty the day before the target date (back-to-back prevention)
3. Sort by point total ascending
4. Top result = suggestion

Target date defaults to tomorrow's date.

---

## Rank Type Filter

Three mutually exclusive filters + "All":

| Filter | Shows | Visible duty type suggestions |
|---|---|---|
| All | Everyone | All 7 duty types |
| Officers | `getRankType(rank) === 'Officer'` | CDO, COS |
| WOSPECs | `getRankType(rank) === 'WOSPEC'` | CDS, COS, PDS1–PDS4 |
| Troopers | `getRankType(rank) === 'Enlistee'` | COS |

Filter updates both the leaderboard and breakdown table simultaneously.

---

## Weight Editor

- Visible only when `isCommander === true`
- Collapsed by default (toggle "Edit Weights")
- One number input per duty type (CDO, CDS, COS, PDS1, PDS2, PDS3, PDS4), min 0, step 0.5
- Save writes rows to `{Company}_Configuration` as `parade_type: 'weight_{TYPE}'`, `time: '{value}'` using upsert
- Reloads point totals after save (no page reload needed — update local state)

---

## UI Layout

Matches existing app design: white page, sticky amber nav, company-themed accents.

```
┌─ sticky nav: ← | [Company] Coy          [Sign Out] ─┐
│                                                       │
│  [ All ] [ Officers ] [ WOSPECs ] [ Troopers ]       │  ← company-themed active pill
│                                                       │
│  NEXT DUTY SUGGESTIONS                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ...            │  ← one card per visible duty type
│  │ CDO  │ │ CDS  │ │ COS  │ │ PDS1 │                 │
│  │ Name │ │ Name │ │ Name │ │ Name │                 │
│  │ 2 pts│ │ 3 pts│ │ 1 pt │ │ 4 pts│                 │
│  └──────┘ └──────┘ └──────┘ └──────┘                 │
│                                                       │
│  POINT LEADERBOARD                          12 pers.  │
│  ┌────┬──────────────┬──────┬─────────┬──────────┐   │
│  │ #  │ Name         │ Rank │ Points  │ Load     │   │
│  │ 1  │ TAN WEI      │ CPT  │ 1       │ ░░░░░░░░ │   │  ← bar uses theme colour
│  │ 2  │ LEE JUN      │ 3SG  │ 2       │ ░░░░░░░░ │   │
│  │ .. │ ...          │ ...  │ ...     │ ░░░░░░░░ │   │
│  └────┴──────────────┴──────┴─────────┴──────────┘   │
│                                                       │
│  DUTY BREAKDOWN                                       │
│  ┌──────────────┬─────┬─────┬─────┬─────┬───────┐   │
│  │ Name         │ CDO │ CDS │ COS │ PDS │ Total │   │
│  │ TAN WEI      │  1  │  —  │  —  │  —  │   1   │   │
│  └──────────────┴─────┴─────┴─────┴─────┴───────┘   │
│                                                       │
│  [Commander only] ▸ Edit Weights                      │
└───────────────────────────────────────────────────────┘
```

### Company theme usage

| Element | Token |
|---|---|
| Filter active pill background | `theme.buttonBg` |
| Filter active pill hover | `theme.buttonHoverBg` |
| Leaderboard bar fill | `theme.buttonBg` (Tailwind class) |
| Suggestion card left border | `theme.activeBorder` |
| #1 leaderboard row background | `theme.badgeBg` |
| #1 leaderboard rank number | `theme.activeText` |
| Section header text | `theme.activeText` |

---

## Files Changed

| File | Change |
|---|---|
| `app/[company]/dashboard/page.tsx` | New page — auth guard, fetch Duty + NominalRoll + Configuration, render `<DutyDashboard />` |
| `components/DutyDashboard.tsx` | New component — all dashboard logic and UI |
| `components/CompanyContent.tsx` | Add "Dashboard" nav link pointing to `/[company]/dashboard` |

`lib/companies.ts` and `lib/supabase.ts` are unchanged.

---

## Verification

1. Open `/stallion/dashboard` → leaderboard renders sorted by points ascending
2. Click "Officers" filter → only Officers shown; suggestion strip shows CDO and COS only
3. Click "WOSPECs" → only WOSPECs shown; PDS suggestions appear
4. Soldier who did duty yesterday → not shown as a suggestion
5. CDO suggestion → only Officers appear as candidates
6. CDS suggestion → 3SG not eligible, only 2SG and above
7. Commander edits CDO weight to 2 → point totals update, leaderboard re-sorts
8. `bun run build` — no type errors
