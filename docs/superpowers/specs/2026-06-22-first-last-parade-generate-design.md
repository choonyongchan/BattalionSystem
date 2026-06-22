# First & Last Parade Generate Buttons

**Date:** 2026-06-22  
**Status:** Approved

## Problem

The current "Generate Parade State" button produces a report that includes both First Parade and Last Parade times in the header. Users need to generate a report for one specific parade, not both at once.

## Solution

Replace the single generate button with two side-by-side buttons: **First Parade** and **Last Parade**. Each generates a report scoped to that parade type only.

## Changes

### `components/ParadeState.tsx`

1. **`generate(paradeType)`** — add a `paradeType: 'First Parade' | 'Last Parade'` parameter. Filter `configs` to only the entry matching `paradeType` before passing to `generateParadeReport`. All other inputs (soldiers, exceptions, duties, strengthOverrides) are unchanged.

2. **Report label** — change the static "Report" heading above the textarea to "Report — First Parade" or "Report — Last Parade", derived from state set when `generate()` is called.

3. **Button row** — replace the single full-width generate button with two equal-width buttons side by side, both using the company theme:
   ```
   [ First Parade ]  [ Last Parade ]
   ```

4. **Analytics** — add `paradeType` to the `trackEvent('parade_state_generated', ...)` payload.

### `lib/parade-report.ts`

No changes. The function already supports a single-entry `configs` array — filtering happens at the call site.

## Out of Scope

- Exception filtering per parade time (exceptions are identical for both parades)
- Any changes to Configuration saving/loading
- Any changes to the Hercules format handler
