# Inline Editing — Nominal Roll & Parade State

**Date:** 2026-06-21

## Summary

Add inline editing to existing rows in the Nominal Roll and Parade State (Duties + Exceptions). Clicking a pencil icon on a row turns its cells into inputs in-place. A Save button validates and persists; Cancel discards. Invalid fields show a red box outline. Only one row is editable at a time per table.

## Scope

| View | Editable entities | Fields |
|---|---|---|
| Nominal Roll | Soldiers | 4D, Rank, Name, Platoon |
| Parade State › Duties | Duty assignments | Assigned To (name) |
| Parade State › Exceptions | Exceptions | Soldier, Scope, Start, End, Reason |

Config is already editable inline — no changes there.

## NominalRoll

### UI changes

- Add a **4D column** to the table (currently in data but not displayed; shows value or `—`).
- Add a **pencil icon button** (`✎`) next to the existing delete (`✕`) button on every row.
- Opening a new row for edit closes any previously open row (single-row edit state).

### State

```ts
editRow: {
  originalName: string   // used as WHERE key for the DB update
  rank: string
  name: string
  platoon: string
  four_d: string
} | null
```

### Edit mode rendering

| Column | Control |
|---|---|
| Rank | `RankSearch` component (existing) |
| Name | `<input type="text">` |
| Platoon | `<select>` with PLATOONS options |
| 4D | `<input type="text">` |
| Actions | Save + Cancel buttons (replace ✎ / ✕) |

### Validation (on Save click)

| Field | Rule |
|---|---|
| Name | `name.trim() !== ''` |
| Platoon | `platoon !== ''` |
| Rank | `ALL_RANKS.some(r => r.rank === rank)` |

Invalid fields replace `border-gray-300 focus:ring-<theme>` with `border-red-500 ring-red-500 ring-2`. Save is blocked until all fields pass; the button stays clickable so the user sees the red feedback.

### DB operation

```ts
supabase
  .from(tbl(company, 'NominalRoll'))
  .update({ rank, name: name.trim().toUpperCase(), platoon, four_d: four_d || null })
  .eq('name', originalName)
```

After success: reload, clear `editRow`.

---

## Parade State — Duties

### UI changes

- Pencil icon on each duty row in the Duties tab.

### State

```ts
editDuty: { duty_type: string; name: string } | null
```

`duty_type` is the identifier (PK with date) and is not editable.

### Edit mode rendering

| Column | Control |
|---|---|
| Duty | Read-only text (not editable) |
| Assigned To | `SoldierSearch` component (existing) |
| Actions | Save + Cancel |

### Validation

No hard validation — name can be empty (TBC is valid).

### DB operation

```ts
supabase
  .from(tbl(company, 'Duty'))
  .upsert({ duty_type, date, name: editDuty.name.toUpperCase() })
```

---

## Parade State — Exceptions

### UI changes

- Pencil icon on each exception row in the Exceptions tab.

### State

```ts
editEx: Exception | null  // { id, name, scope, reason, start, end }
```

Keyed by `id` (auto-increment PK).

### Edit mode rendering

| Column | Control |
|---|---|
| Soldier | `SoldierSearch` |
| Scope | Pill buttons (same as add form) |
| Period | Date input(s) — single date for `SINGLE_DATE_SCOPES`, from/to otherwise |
| Reason | `<input type="text">` |
| Actions | Save + Cancel |

Because the exception row spans multiple columns, in edit mode the row expands to two rows: the first row has the field inputs, the second row has Save/Cancel (or Save/Cancel can live in the actions column with icons).

### Validation (on Save click)

Reuse `isExceptionValid()` logic applied to `editEx`:
- `name` non-empty
- `reason.trim()` non-empty
- `end` non-empty
- `start` non-empty unless scope is in `SINGLE_DATE_SCOPES`

Invalid fields get red outline. Save blocked until valid.

### DB operation

```ts
supabase
  .from(tbl(company, 'Exceptions'))
  .update({ name, scope, reason, start, end })
  .eq('id', editEx.id)
```

---

## Shared UX rules

- **One row at a time**: opening edit on row B while row A is open silently discards row A's unsaved changes and opens row B.
- **Escape key**: pressing Escape cancels edit (add `onKeyDown` to inputs).
- **Red outline**: `border-red-500 ring-2 ring-red-500` on the specific invalid field's input. Applied only after the first Save attempt (not on initial open).
- **Save button disabled** while a DB request is in flight (prevents double-submit).
- **No toast / modal**: errors surface in the existing per-component `error` state banner.

## Out of scope

- Undo/redo
- Bulk edit
- Editing `duty_type` or `date` on duties (those are the primary key)
- Editing `id` on exceptions
