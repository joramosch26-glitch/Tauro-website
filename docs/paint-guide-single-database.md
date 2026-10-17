# Paint Guide: one hosted database, separate deployment identities

## Decision and repository behavior

The existing hosted project is Tauro Paint Guide Dev, reference
`hgfgnfhfqqetxjhasbbe`. The name does not establish production readiness.
There is no second Production database and no database merge is required.
No project reference is hardcoded into executable code. The project can later
serve real clients only after the gates below are independently verified.

| Deployment | Database destination | Paint Guide behavior |
| --- | --- | --- |
| Production | Explicitly verified existing hosted project | Existing functionality, subject to all P0-C/auth/access checks and explicit access-enabled configuration |
| Preview | May configure the same hosted reference | Builds validate identity agreement; browser SDK is not created; staff and homeowner APIs deny access before Auth, profile lookup or RPC |
| Development/test | Existing loopback Supabase only | Synthetic local data and local identities; hosted URLs fail closed |
| Local marketing build without PG configuration | None | Existing public website remains available |

Preview is intentionally unavailable for Paint Guide, including login/OTP,
CRUD, access status, Issue/Recover/Rotate/Revoke, document reads, session exchange
and end-session. There is no read-only customer-data preview, UI-only write
control, flag to bypass this policy, or deployment-header override.
The browser data modules all use the single guarded SDK adapter; the API
handlers all use the guarded environment loader. Marketing previews still build.
Test Paint Guide end-to-end through the established ignored Windows launcher
against local Supabase and synthetic guides, preserving its environment/keyrings.
This creates no additional hosted infrastructure.

Local URL validation protects against accidental hosted connections, not a
malicious operator forwarding a hosted database onto a loopback port. Never
proxy real client data into local development. Do not use hosted identities,
credentials or customer exports as local fixtures.

## Configuration and cryptographic boundaries

Keep the existing variable names in `.env.example`. Within each deployment,
browser/server URL, expected project reference and environment must agree.
Across deployments, reference equality is allowed: Preview uses environment
`preview`, Production uses `production`; never relabel a Preview as Production
just to unlock Paint Guide. Vercel system markers must match the explicit labels.
Keep credentials/keyrings out of VITE_ variables and request/proxy headers.
Production origins use HTTPS and the existing canonical website origin.
Secure/HttpOnly/SameSite=Strict cookies, JWT validation, authoritative active
Owner/Supervisor profiles, RLS, and private server privileges are unchanged.

Cryptographic AAD still binds ciphertext to environment, project, guide and
existing generation/version context. Keyrings and HMAC formats are unchanged.
Sharing the project does not permit production to recover old Preview/test
ciphertext. Before pilot access is issued, inventory synthetic records through
an approved process and decide their retention/removal. If any guide is to be
retained, plan an explicitly authorized access rotation from its intended
production environment and verify resulting session invalidation. Do not
change environment labels, AAD, or delete shared records to make recovery work.

## Limits that repository controls cannot resolve

This change does not update live RLS, existing deployments, live keys or accounts.
An old Preview build can still use its old browser SDK and server functions.
A copied Production browser bundle also cannot attest its hosting environment
to Supabase. Authorized direct Data API access remains controlled by Auth/RLS,
not deployment labels. The Preview policy prevents access through these new
Preview assets/functions; it is not database-level isolation from already
issued credentials. Retire or replace all old accessible Preview deployments
before real customer data enters the backend; review their retained credentials
and access/session material under a separate approved operational plan.
Do not place server credentials in Preview runtime configuration unnecessarily;
removing existing credentials/settings requires a separate authorized action.

P0-C checks configuration within each build/function. They cannot detect cached
browser assets paired with independently changed functions. Deploy assets and
functions together from one reviewed commit/configuration snapshot; rebuild on
configuration changes. Roll back them together. Do not promote a Preview-built
artifact to Production: rebuild with validated Production labels. Never manually
override Vercel identity. See `paint-guide-environment.md` for the release procedure.

## Gates before the first real client (not performed by this change)

1. Independently confirm hosted project/organization identity, shared-system
   ownership, current schema/RLS/RPC/grants, extension dependencies and effective
   Data API exposure. Reconcile the documented five source/live migration-ID
   differences under one migration authority. Do not replay old migrations,
   repair history automatically, or deploy unrelated Commander/JCC migrations.
   Keep their objects and grants intact. No schema change is required by this policy.
2. Establish recoverability for the actual subscribed plan: verify backup/PITR
   availability and retention rather than assuming them. If using manual exports,
   define an owner, encrypted storage outside the project, backup frequency,
   retention, and measured recovery objectives. Include schema, roles/grants,
   application data and supported Auth recovery; separately preserve all active
   and historical server keyring versions. A database-only dump is not proof of
   complete Auth or crypto recovery. Demonstrate restore on an approved isolated
   local target, with no customer fixture disclosure or changes to the shared backend.
   Validate plan pause/availability limits against the proposed pilot.
3. Prepare a rollback runbook: joint asset/function rollback to a reviewed safe
   single-backend commit; preserve key versions and immutable crypto binding.
   Older code permitting Preview access is not a safe rollback candidate once
   customer data exists. Database restore is a separate last-resort approval
   affecting Commander/JCC too: define maintenance coordination and whole-project
   consistency; never restore or reset this shared project as a casual app rollback.
4. Verify a confirmed Auth identity and active `owner` profile for the initial
   Owner. Provision it through a separately authorized administrator procedure;
   do not assume historical profile rows are usable identities. Keep
   `shouldCreateUser:false`, remove/disable disposable access only with approval,
   and verify inactive/unauthorized account denial. Identify a recovery administrator.
5. Verify custom SMTP sender/domain, delivery, OTP templates/expiry/rate limits,
   email confirmation, exact permitted login URLs and abuse controls. Test real
   authorized staff OTP without recording codes or tokens. Supabase default
   development mail delivery is not evidence of pilot suitability.
6. Independently verify Vercel Production branch/domain and all existing public
   and server environment inputs, expected project agreement, platform markers,
   HTTPS/cookie behavior, canonical URL, and API route mapping. Retire old previews.
   Production release and environment changes require separate authorization.
7. Run fresh TypeScript, access/auth/homeowner/QR suites, synthetic deployment
   builds, bundle secret checks and Marketing SEO/prerender checks. Complete
   local manual regression, then approved hosted smoke tests with identified
   synthetic data before admitting one real client. Keep synthetic records
   explicitly inventoried and separate operationally; do not copy client data
   into tests. Agree an incident contact, generic credential-free error monitoring,
   backup alerts, pilot size and stop criteria.

This review branch authorizes neither live changes nor release. No database,
SMTP, Auth, Vercel configuration or deployment operations were performed.

## Fresh repository validation for this review

- 137 automated tests passed: 116 server/environment/authorization/access,
  7 homeowner bootstrap, 14 staff access/QR.
- Frontend (`tsconfig.app.json`), Vite (`tsconfig.node.json`) and server TypeScript
  checks passed, plus local HTTP runtime compilation.
- Four builds passed: local Marketing without PG config, synthetic Preview,
  synthetic Production (the same hosted reference), and synthetic loopback PG.
- Nine negative build scenarios passed, including hosted development/test,
  missing or mismatched identities, privileged browser inputs, and diagnostic
  credential-leak prevention. Marketing prerender/canonical/sitemap/noindex,
  asset isolation and server-secret canary checks passed for the positive builds.
- Production dependency audit reported zero vulnerabilities; dependencies unchanged.
- `git diff --check` passed. Manual Windows/browser QA, live project checks,
  SMTP/OTP delivery, backup/restore and hosted deployment smoke tests: NOT RUN.

These are fresh repository results, not proof of live production readiness.
