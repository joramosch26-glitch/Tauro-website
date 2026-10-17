# Paint Guide pilot functional regression coverage

Base: `paint-guide-v1` at `e7c30ffe1c59771b8440abff83789eef1caf281e`.
This change adds synthetic regression coverage, not pilot or deployment approval.
Only deterministic location/record ordering changes. Gate A/B/C containment status, migrations, live Auth,
Vercel configuration, Windows recovery scripts and backup artifacts remain unchanged.

## Coverage added

Run `npm run test:paint-guide-functional` for 13 tests loading the actual TypeScript
browser data/presentation modules through Vite SSR. Only the Supabase SDK adapter
is replaced with a deterministic in-process query mock. Query outcomes are
scripted; no network, live identity, database or customer data is involved.

- Guide create/edit: draft creation, published edit, optional notes, exact ID
  filters, returned rows, missing guides, denied writes and zero-row saves.
- Locations: parent/type/order creation payload, edit/delete guide-and-location
  filters, empty mutations and simulated constraint/authorization failures.
- Colors: text trimming/null optionals, section/order preservation, guide-and-record
  filters, failed updates/deletes, and failed reads propagating errors.
- Assignment multi-selection: duplicate IDs, unchanged selections, add/remove/clear,
  exact guide/record/removal filters, rejected additions preventing removals,
  and partial-write outcomes surfacing failure rather than success.
- Homeowner presentation: stable ID tie-breaks across input permutations,
  hierarchy ordering, exact junction assignments without parent inheritance,
  duplicate assignment deduplication, multiple locations, orphan/unknown locations,
  unassigned exception visibility and no input mutation.

These are data/query-contract and presentation tests. They do NOT render staff
forms, click selection controls, validate actual SQL persistence/constraints,
prove database permissions, or replace interactive browser testing.

The environment regression now provides complete synthetic keyrings (validated
against a matching Production configuration) and a syntax-valid JWT. It asserts
that the staff authorizer reaches the Preview environment loader, so malformed
JWT rejection or missing crypto configuration cannot mask the intended guard.
No token is signed or accepted as an authorized live identity.

Three composed server tests execute real exchange, document and logout handlers
with real token/session HMAC computation and a simulated RPC backend. They check
session issuance/TTL, initial document access, expiry-boundary rejection,
revocation, logout, wrong links, no read-based TTL refresh, cookie clearing,
generic unavailable responses and no-store headers. Expiry/revocation decisions
come from the mock: live SQL predicates and RLS remain NOT VERIFIED here.

## Existing coverage retained

Existing server suites exercise installed-SDK JWT verification, Owner/Supervisor
permissions, unauthorized/inactive profiles and all five staff access operations,
including CAS conflicts, rotation/revocation races and crypto failures. Existing
homeowner bootstrap and QR tests remain in place. These are automated module and
handler tests; the access-ui command name does not imply rendered UI/E2E coverage.

## Limitations and follow-up work

Assignment saving uses two requests (insert then delete), not one database
transaction. A failed delete can leave additions persisted. The regression checks
that the save rejects; GuideColors already refreshes assignments after failures
and disables further edits if refresh fails. This suite does not render that UI
reconciliation flow. Any atomic RPC redesign requires a separate reviewed task;
no schema change or retry strategy was introduced here.

A small deterministic-ordering defect was corrected: staff location queries and
editor upserts had no final ID tie-break for matching sort_order/created_at.
The queries now order by ID too (including paint records), and editor updates
use the tested compareGuideLocations comparator. A regression covers tied fetch
order, unchanged ordering after a rename, and inserted tied rows.
Interactive staff sorting/selection, form validation, stale navigation and
partial-write UI recovery still need focused rendered UI regressions or manual
QA; this suite does not claim browser interaction coverage.

Before a real-client pilot, the operational gates in
`paint-guide-single-database.md` still apply: current project/organization identity,
shared migration/RLS/RPC state, old Preview containment, backup/restore proof,
Owner provisioning, SMTP/OTP, Production configuration, and approved hosted smoke
checks. The Preview build configuration error and paused Windows recovery
validation are unresolved; synthetic tests do not complete either activity.

Gate A/B/C status is unchanged. Real-client access remains unauthorized.

## Fresh validation

153 automated tests passed: 13 functional, 119 server/environment/access,
7 homeowner bootstrap and 14 staff-access/QR. Frontend, server and Vite
TypeScript checks and local runtime compilation passed. Four local/synthetic
builds passed, including Marketing prerender/SEO, bundle isolation and secret
canaries; nine negative build scenarios passed. Whitespace checks passed.
No hosted end-to-end, live SQL/RLS, real OTP or manual Windows testing was run.
