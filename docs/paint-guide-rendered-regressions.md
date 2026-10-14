# Rendered Paint Guide regressions

`tests/paint-guide-browser.test.mjs` runs actual React route/editor components,
styles, data modules and QR rendering in a headless Chromium-compatible browser.
It uses synthetic in-memory SDK data and an explicitly replaced Auth fixture.
External HTTP requests are blocked. This is not live SQL/RLS or OTP verification.

Use an existing Playwright installation; no application dependency, production
build input or lockfile change is needed. `TAURO_QA_PLAYWRIGHT_MODULE` may identify
its `index.mjs`; otherwise the test imports `playwright` normally. The suite uses
an existing Windows Edge executable when present, otherwise an installed
Playwright Chromium. No browser is downloaded automatically.

Run `npm run test:paint-guide-browser` after selecting that existing runtime.
Run `npm run test:paint-guide-functional`, `npm run test:server`,
`npm run test:homeowner-bootstrap` and `npm run test:paint-guide-access-ui`
separately. `node scripts/validate-paint-guide-environment.mjs` verifies local,
synthetic Preview/Production builds, Marketing prerender/SEO and bundle isolation.
The build verifier invokes Node entrypoints directly so Windows requires no
command-shell interpolation of configuration or diagnostics.

## Defects corrected

- Guide-scoped routes remount only when guide identity changes. Pending callbacks
  belonging to old editor instances cannot mutate another guide's UI, including
  A → B → A navigation. Drafts, errors and pending states are discarded.
- A New Guide create result cannot navigate after its screen was cancelled or
  unmounted. An already sent database request is not cancelled or rolled back;
  return to the dashboard to find any successfully created draft before retrying.
- Editor navigation wraps on small screens rather than overflowing horizontally.
- Overview/New Guide text now describes the implemented Colors and Access & QR
  workflows instead of obsolete “coming later” placeholders.

## Twelve rendered checks

Draft isolation; delayed create; A → B → A save; location-form isolation; delayed
overview save; cancelled-create navigation; partial assignment reconciliation;
refresh-failure lockout; house/publish/location/color/finish workflow; actual
PNG/SVG downloads and memory-only QR with lifecycle UI transitions; supervisor
control visibility; 360px mobile layout.

Downloaded synthetic test files and browser contexts are removed after each
test. Crypto output is genuine QR rendering, but the fixture lifecycle backend
is simulated; real handler/SQL lifecycle verification is a separate local test.
Do not count this suite as hosted QA, Owner-entered Pinentry or independent
backup recovery. Preview remains fail closed and release gates remain mandatory.
