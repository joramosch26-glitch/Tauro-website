# Paint Guide color catalog: local implementation

## Behavior

- Staff can search one color-origin collection at a time: Sherwin-Williams, Benjamin Moore, or Farrow & Ball. Search is by name or code and returns separate choices for duplicate-looking results.
- A staff member must explicitly choose a result. That action fills the color name, code, origin brand, independent approximate swatch, provider record ID, source URL, and retrieval timestamp. The actual coating brand, product, sheen, verified can-sticker swatch, and formula-label photo are separate fields and are not changed.
- If selecting a different color would leave an existing manually verified swatch attached to the prior color name, saving is blocked until staff review the swatch and its provenance. Formula-label photos remain a separate photo workflow and are not silently replaced.
- Manually editing the selected color name or code clears its catalog-reference metadata so a stale swatch is not presented as matching.
- Requests are on-demand only, with an 8-second timeout, cancellation on form close, a bounded 20-result query, rate-limit handling, and manual-entry fallback. The app does not bulk-import or cache the provider catalog. Only a color a staff member explicitly selects is persisted, with its source and retrieval date.
- The UI labels this as an approximate digital reference and says it is not manufacturer-verified; physical confirmation remains necessary. It does not create or infer a mixing formula.

## Provider and attribution

PaintDB's API documentation says its API is free for personal and commercial use, documents `GET /api/v1/colors`, and documents rate limiting. PaintDB's About page says it is not affiliated with manufacturers. Its separate downloadable snapshots are described as CC BY 4.0; that license is not attributed to API responses here. The implementation uses the documented API for individual searches and persists only a result explicitly selected by staff: brand, color name/code, returned HEX, provider ID, source URL, and retrieval timestamp. It does not import or retain the catalog collection. PaintDB attribution is shown beside the approximation and linked to its source. No manufacturer-verified accuracy claim is made.

- API documentation: https://paintdb.com/api/v1
- Provider information: https://paintdb.com/about

Underlying manufacturer rights and color-value provenance are not independently certified by this integration. The UI therefore presents the HEX as an approximate independent reference, not a manufacturer's official swatch or formula. No account, API credential, bulk import, or paid service is part of this implementation.

## Persistence prerequisite

Selected reference metadata uses six new nullable `paint_records` columns: `color_origin_brand`, `color_reference_hex`, `color_reference_provider`, `color_reference_id`, `color_reference_url`, and `color_reference_retrieved_at`. Existing `brand` remains the coating manufacturer, while `color_name`/`color_code` remain the selected color identity. Existing `swatch_hex`/`swatch_provenance` retain their verified/manual meaning.

The original one-step reviewed migration is preserved byte-for-byte at `docs/reviewed-migrations/20261028120000_add_color_catalog_reference_fields.reviewed.sql` (SHA-256 `099035D50D15B7B378089B6C1988914E954F59467BC529CD416D88E3CF991AF0`). It is deliberately outside the executable migrations directory because it alters the homeowner RPC response in the same step as the schema; the currently live strict production parser rejects the added design/catalog keys.

For a compatible rollout, the candidate now separates that approved change into two ordered migrations:

1. `supabase/migrations/20261028150000_add_color_catalog_reference_columns.sql` adds only nullable columns and validating constraints. It does not modify the homeowner RPC, response JSON, permissions, RLS, or policies. Existing application writes that omit the columns leave them null; existing explicit-column reads retain their prior response shape.
2. `supabase/migrations/20261028160000_extend_homeowner_document_color_catalog.sql` replaces the existing homeowner RPC only after the tolerant application parser is deployed. It returns the optional design/catalog values while preserving current photo descriptors, session and token checks, stable security-invoker attributes, empty search path, owner, and ACL.

The candidate does not authorize applying either stage yet. Since QA and Production share the same backend, Stage A would allow testing catalog persistence without changing the live RPC. After those QA checks and compatible application deployment, Stage B can add the optional RPC data. The original combined migration must not be applied alongside either stage. This staging approach is a local proposal and requires approval before publication or hosted execution.

## Validation

Run `npm run test:paint-guide-color-catalog`, `node --test tests/catalog-migration-staging.test.mjs`, and `npx tsc -p tsconfig.app.json --noEmit` from this isolated candidate. The focused catalog tests cover supported brands, brand-scoped name/code queries, duplicates, malformed/cross-brand result filtering, selection mapping without overwriting the applied product or verified swatch, empty results, rate limiting, malformed JSON, network failure, timeout, and cancellation. The staging test asserts Stage A contains no RPC/permission/data changes and Stage B retains the reviewed RPC contract and security gates. Existing homeowner server tests separately cover acceptance of both legacy five-key/photo-aware payloads and optional design/catalog payloads. These are source-level/unit checks, not execution against PostgreSQL.
