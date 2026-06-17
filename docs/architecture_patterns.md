# Architecture Patterns

This project is a static, plain-JavaScript single-page app backed by Google
Sheets through per-company Google Apps Script web apps. There is no bundler,
framework, npm runtime, or module system. Load order in `index.html` is the
dependency graph.

## Multi-Company Runtime

- One shared frontend codebase supports multiple companies.
- Each company owns its own Google Sheet and bound Apps Script deployment.
- `js/companies.js` resolves the active company from `?company=...`, then the
  saved browser selection, then defaults to `cougar`.
- Unknown company IDs fail closed: no Apps Script URL is used, so the app cannot
  accidentally fall back to Cougar data.
- Browser persistence is scoped by company with keys like
  `battalion-system:cougar:data-v2` and `battalion-system:hercules:auth`.
- Legacy Cougar keys are copied into scoped Cougar keys on first load for
  backward compatibility.
- Company-specific non-secret settings live in the company Sheet's `Config`
  tab. The existing Telegram bot also uses `Config`, so company settings are
  additive columns in the same wide config row.
- Secrets, auth tokens, API keys, and rollup tokens stay in Apps Script
  Properties, never in the visible Sheet.

## Runtime Shape

- `index.html` owns the fixed shell: sidebar navigation, topbar search/filter,
  `#content`, and one shared modal container. It loads Chart.js, PapaParse,
  `styles.css`, then every app script as classic global scripts.
- `js/companies.js` must load before `js/state.js`; it defines the active
  company, Apps Script URL, branding defaults, and scoped storage helpers.
- `apps-script-Code.gs` is the backend to paste/deploy inside each company
  Sheet. It exposes JSON endpoints for auth, tab reads/writes, email sending,
  Polar photo analysis proxying, config reads, and aggregate rollups.
- `js/state.js` defines the single global `STATE`, localStorage keys, and
  normalization helpers.
- `js/api.js` is the only frontend wrapper around the Apps Script URL.
- `js/helpers.js` contains cross-tab domain helpers, formatting, filtering,
  exports, date/time parsing, conduct lookup, medical logic, IPPT aggregation,
  and MSK classification.
- `js/render.js` renders the current tab into `#content`.
- `js/forms.js` owns modal content, form submitters, CSV imports, report
  generation, conduct migration, and Polar photo import staging.
- `js/sync.js` owns the Sync tab plus pull/push/ping/sign-out flows.
- `js/main.js` wires nav, search, filters, invite redemption, bootstrap, and
  launch-time sync.
- `styles.css` provides global layout, tokens, component classes, modal rules,
  and mobile behavior.

## Bootstrap Flow

1. `main.js` attaches event listeners to nav, search, sidebar, filters, and
   report menu controls.
2. `tryRedeemInviteFromURL()` consumes `?token=...`, calls
   `API.redeemInvite()`, stores the returned auth token under the active
   company's scoped key, and scrubs only the token from the URL.
3. `loadLocal()` hydrates `STATE` from localStorage, running normalizers.
4. `loadFilter()` restores scope filters.
5. If authenticated and the cache is empty or an invite was just redeemed,
   bootstrap blocks on `API.pullAll()` before first meaningful render.
6. Otherwise the app renders cached data immediately, then `autoSyncOnLaunch()`
   refreshes in the background.
7. `maybeRunConductMigration()` runs after launch to migrate old free-text
   conduct fields to `conductId` when needed.

## Backend Contract

Each company Apps Script backend is intentionally generic around sheet tabs:

- `doGet`: `ping`, `readAll`, `read&tab=...`, `readRollup`.
- `doPost`: `redeemInvite`, `write`, `append`, `appendMany`, `deleteRow`,
  `updateRow`, `sendEmail`, `getEmailInfo`, `analyzePhoto`.
- Normal app auth is token-based. Invite and auth records live in
  `PropertiesService` as `invite:<token>` and `auth:<token>`.
- Battalion rollups use a separate `ROLLUP_READ_TOKEN` Script Property and do
  not accept normal user invite tokens.
- The browser stores the issued auth token in localStorage and sends it on
  every data call.
- `readTab()` converts each sheet row to an object keyed by Row 1 headers.
- `readAllTabs()` maps sheet tab names to frontend `STATE` keys and includes
  `company` and `config` metadata.
- `getCompanyConfig()` reads the Sheet's `Config` tab and merges defaults.
  It supports both key/value config and the existing wide Telegram config row.
- `readRollup()` returns aggregate-only battalion data: strength, medical
  counts, attendance rates, fitness summaries, and MSK counts. It must not
  return names, phone numbers, emails, or 4D/person identifiers.
- `writeTab()` rewrites an entire tab and derives headers from
  `Object.keys(data[0])`.
- `appendRow()` and `appendMany()` append using the sheet's existing headers.
- External secrets stay server-side. Anthropic and MailApp calls are proxied by
  Apps Script so API keys and mail scopes are not exposed to the browser.

Important consequence: when adding a new field to a tab that is pushed with
`writeTab()`, make sure normalized rows include that key. If the first object is
missing a key, `writeTab()` will omit that column for the whole sheet.

## State And Persistence

`STATE` is the frontend source of truth during a session. Most arrays map one
to one with a Google Sheet tab:

- `roster` -> `Roster`
- `medical` -> `Medical`
- `attendance` -> `Attendance`
- `ippt` -> `IPPT`
- `rm` -> `RouteMarch`
- `soc` -> `SOC`
- `polar` -> `PolarFlow`
- `conductDetail` -> `ConductDetail`
- `appointments` -> `Appointments`
- `leave` -> `Leave`
- `msk` -> `MSK`
- `conducts` -> `Conducts`

The app is local-first for user interactions:

- Form submitters mutate `STATE`.
- They call `saveLocal()` so the browser cache reflects the mutation.
- They call `render()` to repaint the current screen.
- New rows usually also fire `API.appendRow(...)` in the background.
- Edits/deletes are local until the user pushes the relevant tab, because
  `pushTab()` rewrites that sheet tab from `STATE`.

The cache is versioned and company-scoped with keys generated by
`companyStorageKey(...)`. Legacy Cougar cache keys are copied into the scoped
Cougar keys during startup; old v1 Cougar cache is still removed in
`loadLocal()`.

## Data Normalization

Normalization happens at read boundaries, not inside every view:

- `normalizeRoster()` mirrors sheet `4d`/`4D` into `r.id`, strips legacy fields,
  infers commander role from `00xx`, and coerces `leaveQuota`.
- `padD4()` strips a leading `C` and pads 1-3 digit values to 4 digits.
- `normalizeMedical()` canonicalizes status names and ensures all current
  medical schema keys exist.
- `padD4OnLayer()` is the generic normalizer for layers keyed by `d4`.
- `normalizeMSK()` translates Google Form header variants into stable keys.

Date conventions are mixed by necessity:

- Sheet display dates are commonly `17 May 2026`.
- `<input type="date">` values are ISO `2026-05-17`.
- Helpers such as `isoToDisplayDate()`, `displayDateToISO()`, and
  `dateJoinKey()` bridge those formats before comparisons or joins.

## Identity Patterns

- Roster personnel use 4D as the person identity.
- In the frontend, roster rows expose that value as `id`.
- Other tabs refer to personnel with `d4`.
- Commander IDs are administrative `00xx` IDs. UI display helpers hide the raw
  ID and show rank/name instead.
- Most record rows also have a short local `id` from `nextId()` for edit/delete
  lookup inside arrays. That `id` is not the person identity.

## Conduct Registry Pattern

Conduct names are normalized into a registry:

- `STATE.conducts` stores `{ id, name }`.
- Attendance, Polar, and ConductDetail rows should store `conductId`.
- UI uses `conductName(conductId)` for display.
- Forms use `conductPicker(...)`, which can create a conduct inline.
- `normalizeConductKey()` supports duplicate detection and migration by
  collapsing case, whitespace, Unicode variants, and smart quotes.
- `commitConductMigration()` converts legacy free-text `conduct` values into
  stable IDs and pushes `Conducts`, `Attendance`, `PolarFlow`, and
  `ConductDetail` together.

Polar entries are the source of truth for LMS participation counts. After pulls,
imports, photo extraction, and migrations, `recomputeAttendanceLmsFromPolar()`
joins by normalized date plus conduct and updates `attendance[].lms`.

## Rendering Pattern

`render()` is the only tab dispatcher:

- It destroys existing Chart.js instances in `STATE.charts`.
- It resets `#content` scroll.
- It refreshes filter controls.
- It updates the strength counter.
- It switches on `STATE.nav` and calls a `renderX(el)` function.

Each tab renderer writes full HTML into `el.innerHTML` using template strings.
Charts are created only after the target canvas exists in the DOM. Modal-heavy
charts in `forms.js` are likewise created after `openModal()` inserts content.

The app uses inline `onclick` handlers heavily. New UI should follow that
existing style unless a broader refactor is intentional.

## Form And Mutation Pattern

Most CRUD flows follow this shape:

1. `openXForm(id)` finds an existing row when editing and renders modal HTML.
2. `submitX()` reads DOM values with `gv(...)`, builds a record object, then
   either updates the existing array element or pushes a new entry.
3. `saveLocal(); closeModal(); render();`
4. For new rows, `API.appendRow("SheetTab", entry).catch(() => {})` attempts a
   cheap sheet append.
5. The tab header includes `Push to Sheet`, which calls `pushTab(tab, array)`
   for authoritative sync.

For user-supplied text interpolated into attributes, use `escapeAttr(...)`.

## API Pattern

Always call Apps Script through `API`:

- `API.get(action, tab)` adds the auth token to query params.
- `API.post(body)` sends JSON as `text/plain` to avoid browser preflight issues
  against Apps Script.
- API errors are returned as JSON `{ error, code }`, not HTTP status failures.
- `code === 401` is converted to `AuthError`.
- `API.pullAll()` applies frontend normalizers, recomputes LMS counts, saves
  local cache, and returns the raw backend payload.

## UI And Styling Pattern

The UI is a dense operational dashboard:

- Global CSS custom properties in `:root` are the color system.
- Reused component classes include `.btn`, `.badge-*`, `.card`, `.stat`,
  `.stats-row`, `.table-wrap`, `.grid-2`, `.modal`, and `.sync-panel`.
- Mobile behavior is centralized in the `@media(max-width:768px)` block:
  slide-out sidebar, filter popover, full-screen modal, tighter tables, and
  collapsed grids.
- Chart containers use fixed wrapper heights so Chart.js does not resize modals
  unpredictably.

## Adding A Sheet-Backed Feature

1. Add the sheet tab to the Apps Script `readAllTabs()` map.
2. Add a `STATE` array and include it in `saveLocal()` / `loadLocal()`.
3. Add normalizers if the sheet has unstable headers, IDs, dates, or booleans.
4. Add the tab to `doPushAll()` if it should be part of full sync.
5. Add nav markup in `index.html` if it has a visible tab.
6. Add a `renderX(el)` function and a case in `render()`.
7. Add `openXForm()` / `submitX()` in `forms.js` if it is editable.
8. Prefer append for new rows and full-tab push for edits/deletes, matching the
   rest of the app.
9. If the feature joins on people, normalize 4D through `padD4()`.
10. If it joins on conducts, store `conductId`, not conduct name.

## Operational Gotchas

- Apps Script changes require redeploying a new web-app version for every
  affected company deployment.
- Frontend company-to-Apps-Script URL mappings live in `js/companies.js`.
- New company invite links must include `?company=<companyId>&token=<token>`.
- Add new companies by creating/cloning a Sheet, pasting/deploying the bound
  Apps Script, running `setupCompanyConfig(...)`, setting any Script Properties,
  and adding the deployed web-app URL to `js/companies.js`.
- Never reuse localStorage keys across companies; all new persisted browser
  values must go through `companyStorageKey(...)`.
- Cache busting is manual via query strings in `index.html` script/CSS tags.
- `sample_polar.csv` is tracked even though `.gitignore` ignores `*.csv`.
- The app can run from static hosting or `file://` because scripts are classic
  globals and dependencies are CDN-loaded.
