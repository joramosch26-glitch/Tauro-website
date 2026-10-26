# Contact inquiry screening and automation handoff

Prepared 2026-10-26. Base: `abeef97` on `main`. Changes are proposed on
`fix/contact-inquiry-spam-triage`; production deployment requires Jose's approval.

## Audit

- Home (`src/components/ContactSection.tsx`) and `/contact`
  (`src/pages/Contact.tsx`) collect name, email, project type and message.
  Phone and city/ZIP remain optional. A valid project type or a plausible city
  says nothing about the intent of the message.
- Both call `src/lib/lead-submission.ts`, which POSTs JSON directly from the
  browser to `https://formsubmit.co/ajax/office@tauropainting.com`.
- Before this change the CSS-hidden `website` trap had no `name` and was checked
  only in the UI; no `_honey` was sent to the provider. Each component prevents
  concurrent submissions and repeats of an acknowledged identical submission
  within 60 seconds **in that mounted component**. This is not global rate limiting.
- The existing transport handles provider rejection, uncertain acknowledgment,
  HTTP/network failure and a 15-second timeout. Those behaviors are preserved.
- Before this change every acknowledged submission fired GA4 `generate_lead`,
  and the notification subject called every submission a new lead.
- Repository search found no email-to-CRM worker, webhook handler or automation
  that consumes these notifications. No external mail rules, automation settings,
  CRM records or existing messages were modified.
- The three Oct 15–20 incidents and their service categories were supplied by
  Jose. Tests use **synthetic paraphrases**, not retrieved copies of those emails.

## FormSubmit research

Official sources checked 2026-10-26 (the `.co` service used by this repository;
features of similarly named `.app`, `.site` or `.cloud` products are not assumed):

- https://formsubmit.co/help says the provider has reCAPTCHA v2/v3 and intelligent
  spam prevention. These incidents do not establish that those protections are absent.
- https://formsubmit.co/documentation documents `_honey`, which silently ignores
  a submission if populated, and `_blacklist`, comma-separated phrases that cause
  silent discard (recommended maximum 20). It recommends retaining reCAPTCHA
  rather than setting `_captcha=false`.
- https://formsubmit.co/ajax-documentation documents browser JSON POSTs. It does
  not establish an interactive CAPTCHA/verification contract for our AJAX flow.
  This PR neither disables CAPTCHA nor claims to enable a verified CAPTCHA check.
- The documentation also offers a masked recipient identifier. Hiding an email
  address is not content screening or authorization.

We deliberately do **not** add `_blacklist`. Keywords such as financing, website,
SEO and Wikipedia may appear in a real customer's message. Silent, provider-side
phrase deletion would remove the recovery path. A new captcha/backend/provider
migration is disproportionate to these three observed submissions without first
measuring this reversible triage step. CAPTCHA also cannot establish buying intent.

## Proposed behavior

`src/lib/inquiry-screening.ts` normalizes case, accents, whitespace and zero-width
characters and looks for an offer near a known unrelated service. It inspects the
message, not names, domains, phone numbers, project selections or location.
There is no minimum message length, English-only requirement, link prohibition,
new required field or additional step for customers.

| Message classification | Notification | GA4 generate_lead | Sales opportunity |
| --- | --- | --- | --- |
| Possible solicitation | `[REVIEW REQUIRED] Tauro Painting inquiry — possible solicitation` | Suppressed | Unqualified; manual review |
| No offer detected | `New Tauro Painting inquiry — unverified` | Existing inquiry conversion on provider acknowledgment | Unqualified; manual review |
| Unknown delivery or provider failure | Existing recovery UI; original text retained | None | No qualification implied |
| Populated honeypot | Local submission suppressed | None | None |

Suspected content is **still sent to the same office mailbox intact**. This reduces
misclassification and separates the review queue; it does not promise fewer total
emails or stop all solicitation. The normal provider confirmation UI and duplicate
suppression also apply to acknowledged review submissions.

Both forms give the trap its provider-recognized `_honey` name and pass it to a
shared guard. The AJAX payload includes `_honey`. The shared guard rejects a
populated trap before network access. Since that value is never forwarded in a
normal send, we do not claim to have tested the provider's honeypot enforcement.

Explicit payload fields prevent unexpected extra caller properties from overriding
control/qualification metadata in our code path. Fixed subjects also keep arbitrary
visitor names out of routing subject prefixes. This is **not authentication**.

## Automation contract (requires integration outside this repository)

Every new payload contains:

```json
{
  "inquiryScreening": "possible_solicitation OR unverified_inquiry",
  "screeningReasons": "wikipedia_offer, finance_offer, digital_services_offer OR none_detected",
  "screeningVersion": "1",
  "opportunityStatus": "unqualified",
  "automationAction": "manual_review"
}
```

`none_detected` does not mean legitimate, and `possible_solicitation` does not
mean confirmed spam. FormSubmit acknowledgment means only provider acceptance,
not delivery to an inbox, customer identity verification or sales qualification.
GA4 `generate_lead` remains a marketing inquiry metric, not a qualified opportunity.

The owner of each email/CRM/AI ingestion workflow must apply these rules before
turning on any opportunity-creation step:

1. Treat **all** FormSubmit notifications (including the legacy `New Tauro Painting
   lead` subject and messages missing screening fields) as unverified inbound data.
   Pause automatic opportunity creation from this source until this gate is wired.
2. Evaluate the actual inquiry message. Reuse `screenInquiryMessage` in a JS/TS
   worker, or equivalent versioned rules. Do not rely exclusively on subjects,
   caller-supplied flags, selected service, address, sender name or email domain.
   These client-generated values can be forged or omitted. Missing/unknown
   versions, contradictory fields and ambiguous intent go to manual review.
3. Create a recoverable **inquiry**, not a sales opportunity. Route possible
   solicitation to a visible review queue. Do not delete, auto-archive out of sight,
   enroll in marketing, send outreach, schedule follow-ups or inflate pipeline value.
4. Promote to an opportunity only after a reviewer confirms a painting request
   (or a separately authenticated business qualification step does so). Record
   who approved, when, and the reason. Never infer approval from inbound text.
5. For an AI consumer, supply message content as untrusted data. Ignore embedded
   instructions to change classifications, send messages or invoke tools. Use a
   constrained intent result; uncertain/mixed painting-and-sales messages need review.
6. Deduplicate at ingestion using a stable provider message ID and an idempotent
   write. The browser's one-minute duplicate check does not protect the CRM.

Optional mailbox rule after approval: label subjects beginning `[REVIEW REQUIRED]
with a visible “Website inquiries / Review” label. Do not trash or silently discard.
Old notification-subject matchers need updating for the new normal subject. No mail
rule or external automation was changed by this PR, so **downstream qualification
protection is not fully active until the receiving workflow implements the gate**.

## Limits and escalation

Direct POSTs to the public FormSubmit endpoint bypass this browser classifier and
can forge every metadata field. Clearing a honeypot is also trivial. The classifier
has false positives and false negatives; the small synthetic corpus is not a spam
accuracy benchmark. Mixed-intent messages are intentionally reviewable, not lost.

If spam volume continues, the next concrete step is a same-origin server endpoint
with validation, server-verified challenge tokens, durable rate limiting and
server-side triage before delivery. A migration must first verify the provider's
server-to-server acceptance and retire/protect the old public destination; a
browser token or secret embedded in Vite would not solve this. No secrets, new
service account, paid plan, external dependency or infrastructure is introduced here.

## Validation and rollout

- `npm run test:inquiries`: classifier, bilingual customer cases, three incident
  categories, mixed messages, Unicode/spacing, expected payloads, extra-property
  injection, honeypot/no-network, provider errors and uncertain acknowledgment.
- `npx tsc -p tsconfig.app.json --noEmit`: strict frontend type check.
- `npm run build`: marketing/portal build and public prerender, local output only.
- `CHROMIUM_PATH=<installed-browser> node --test tests/prerender.test.mjs`:
  existing browser regressions plus both forms' three pitch categories, genuine
  financing questions, web-company customers, Spanish requests with links, short
  messages, optional fields, analytics exclusion and honeypots.

All new transport tests stub fetch; new browser tests deny every external origin
and intercept FormSubmit locally. No synthetic emails or Analytics events are sent.
See the PR for actual executed results and environment limitations.

After approval to merge/deploy, confirm one controlled end-to-end provider delivery
and inspect its subject/fields in the office mailbox. Confirm the receiving
workflow's review gate **before** allowing automatic opportunities. Review the
queue daily for the first week, recover any false positives, and track the share
of confirmed painting inquiries vs solicitations. Roll back by reverting this PR;
update subject-based ingestion rules alongside any rollback. Production and external
workflow changes are intentionally left for an approved rollout.

### Executed results (2026-10-26)

- `npm run test:inquiries`: **37 passed, 0 failed**.
- `npx tsc -p tsconfig.app.json --noEmit`: **passed**.
- `npm run build`: **passed**, including all public prerender routes.
- `CHROMIUM_PATH=/tmp/tauro-chromium/chromium node --test tests/prerender.test.mjs`:
  **16 passed, 0 failed**, Chromium 153.0.8010.0, including desktop/mobile and
  existing submission failure/timeout/duplicate regressions.
- `git diff --check`: **passed**.

The browser used a temporary QA installation; no browser package or new dependency
was added to the project. FormSubmit delivery/filter behavior and the external
CRM/automation integration were **not live-tested**. There were no real submissions,
mail changes, production deployments or merges during this work.
