# Paint Guide environment consistency (P0-C)

This is a review checkpoint, not production deployment approval.

## Configuration contract

Set the same project reference in `VITE_TAURO_PG_EXPECTED_PROJECT_REF` and
`TAURO_PG_EXPECTED_PROJECT_REF`, the same environment (`development`, `test`,
`preview`, `production`) in `VITE_TAURO_PG_ENVIRONMENT` and `TAURO_PG_ENVIRONMENT`,
and the same Supabase root URL in `VITE_SUPABASE_URL` and `TAURO_PG_SUPABASE_URL`.
There is no hardcoded production project reference. Hosted URLs must exactly
match `https://<expected-reference>.supabase.co` (optional trailing slash).
Custom domains are deliberately unsupported until reviewed separately.

Browser keys use `VITE_SUPABASE_PUBLISHABLE_KEY`: a publishable key or legacy
anon JWT. Hosted anon JWT references must match. JWT parsing here classifies
configuration, it does not verify signatures or grant authorization. Opaque
publishable keys cannot be checked offline for project ownership or validity;
Supabase validates them. Secret/service_role keys are rejected in the browser.
No server secret or crypto key may use a VITE_ variable. Validation errors omit values.
Server credentials and existing crypto keyrings remain server-only.

Local marketing builds with no browser configuration remain supported. Partial
browser configuration fails the build; the browser fails closed without creating
a client. Configured local builds require matching server public boundary values,
but not a server secret or keyring during asset compilation.

Development/test permit exact `http://127.0.0.1:<port>` or
`http://localhost:<port>` roots for local Supabase. Preview/production require
hosted HTTPS Supabase and HTTPS allowed origins. HTTP origins are permitted only
for explicit loopback development/test. Mixed HTTP/HTTPS origin sets are rejected
so one cookie policy is safe for every configured origin. Session cookies keep
HttpOnly, SameSite=Strict and their existing scope/TTL; all HTTPS configurations
use Secure, including cookie deletion. Loopback HTTP cookies omit Secure.
No Host or proxy headers determine environment or cookie policy.

On Vercel, system variables `VERCEL=1` and `VERCEL_ENV` must both be available and
match the explicitly configured environment. Enable Vercel's system environment
variables for builds/functions. Unsupported or partial markers fail closed.
These process variables are trusted deployment inputs, not cryptographic
attestation. Vite loads only public build inputs from dotenv files and ignores
dotenv platform markers; only process markers establish platform identity.
Never derive them from request headers or manually override them to
pretend a deployment belongs to another environment. `NODE_ENV=production` means
optimized JavaScript, not a Paint Guide production deployment.

## Release boundary and required procedure

Vite validates browser/server public configuration before compiling immutable
assets. Server loaders validate the public browser variables against server
identity at runtime, requiring them on Vercel. Keep all four public variables
available in serverless runtime configuration as well as at build time.

This cannot prove that an independently deployed function is paired with the
browser assets a client has cached. There is no runtime build-identity handshake.
A stale build can reference an old project even when new function configuration
is internally consistent. Do not claim runtime or cross-release agreement.

For every release:

1. Select reviewed environment-specific configuration and expected project;
   independently confirm the target project before any release action.
2. Run `npx tsc -p tsconfig.app.json --noEmit`, server and Vite TypeScript checks,
   server/homeowner/staff/QR tests, and
   `node scripts/validate-paint-guide-environment.mjs` (synthetic only).
3. Build fresh assets and server functions from the same reviewed commit and
   configuration snapshot. Deploy both together in one Vercel deployment.
   Never reuse another environment's dist directory or publish functions alone.
4. Before promotion, compare the reviewed build configuration with the function
   configuration: environment, expected reference and URL (no key disclosure).
   Configuration-only changes require a fresh joint build/deployment.
5. Smoke-test the resulting deployment, staff authentication, access and homeowner
   routes with approved disposable data. Check HTTPS cookies and browser/server
   project destinations without recording credentials or private links.
6. Roll back assets and functions together to the same known-good deployment.

Live key validity, hosted project configuration, real OTP and deployment smoke
checks are not established by synthetic repository tests. Cached old clients
remain a limitation requiring release discipline. Auth permissions, roles,
session/token formats, database schema and RLS are outside this change.

Vite env diagnostics must not receive server process credentials. The build loader
selects VITE_ values and only the three public server identity fields, excluding
backend secrets, crypto keyrings and deployment tokens. Vite verbose diagnostics
can print raw dotenv file contents before filtering, so the config rejects DEBUG
selectors that enable `vite:env` (including `*` and `vite:*`) before calling
loadEnv. CLI `--debug` is also rejected. This is intentionally conservative even
if a negative selector also disables that namespace. Normal builds and other
debug namespaces remain available. Keep privileged credentials out of VITE_
variables; use platform secret configuration or the existing server-only keyrings.

## Fresh recovery validation

The recovered implementation passed 133 automated checks: 112 server checks
(including shared environment negative regressions and authorization/access),
7 homeowner bootstrap tests, and 14 staff access/QR tests. Frontend, server and
Vite TypeScript checks and local HTTP runtime compilation passed.

Local marketing, synthetic preview and synthetic production builds passed.
Five negative builds rejected missing deployment configuration, project mismatch,
platform mismatch, privileged browser keys and privileged alternate public values.
Generated local asset graphs passed synthetic server-secret canary and server-code
boundary checks; Marketing asset dependencies, prerendered canonical tags,
structured data, sitemap exclusion and Paint Guide noindex checks passed.
Existing external analytics scripts were not fetched or audited.

The final security review passed 134 tests (113 server, 7 homeowner, 14 staff/QR).
Synthetic `DEBUG=vite:env` and CLI `--debug` builds were rejected before env
diagnostics, with backend/keyring/deployment-token canaries absent from output.
The CLI case included a synthetic backend credential in a temporary dotenv file.
Actual Vite dotenv loading was tested to exclude privileged fields and file-supplied
platform markers. Three normal build modes and five other negative builds passed.

Manual browser QA, real OTP/key validity, live database state and hosted deployment
smoke tests: NOT RUN. These results support code review, not release approval.
