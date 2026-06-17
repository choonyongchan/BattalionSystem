# Testing

This repo intentionally has no npm, bundler, or Node test runner. Tests are
plain browser scripts.

## Run The Browser Suite

Open:

```text
tests/runner.html
```

The suite loads the same classic scripts as the app where possible, uses mocked
Google Apps Script responses, and does not call external services.

## Test Layers

- Unit tests: company resolution, scoped storage keys, legacy Cougar migration,
  roster normalization, and Config fallback behavior.
- Integration tests: mocked `API.pullAll()`, per-company auth/cache separation,
  unknown-company fail-closed behavior, and aggregate rollup privacy.
- End-to-end-style tests: browser DOM branding, mocked invite redemption,
  mocked company pull, same-browser company switching, and battalion rollup
  privacy checks.

## Fixture Data

Realistic test data lives in `tests/fixtures/company-data.js`:

- Cougar recruit and commander rows.
- Hercules recruit and commander rows.
- Attendance, medical, IPPT, MSK, and conduct examples.
- Aggregate-only rollup payloads that intentionally exclude person-level data.

## Safety Notes

Tests avoid `localStorage.clear()`. Cases that touch storage back up and restore
only the specific keys they use.

If future tests call `API.pullAll()`, back up `STORAGE_KEY` first because
`pullAll()` persists data as part of normal app behavior.
