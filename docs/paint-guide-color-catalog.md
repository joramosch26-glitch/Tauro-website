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

Selected reference metadata uses six new nullable `paint_records` columns in `supabase/migrations/20261028120000_add_color_catalog_reference_fields.sql`: `color_origin_brand`, `color_reference_hex`, `color_reference_provider`, `color_reference_id`, `color_reference_url`, and `color_reference_retrieved_at`. Existing `brand` remains the coating manufacturer, while `color_name`/`color_code` remain the selected color identity. Existing `swatch_hex`/`swatch_provenance` retain their verified/manual meaning. The additive migration also updates the existing homeowner document RPC to return these public reference fields while retaining all six existing design metadata fields and current photo descriptors. It preserves the RPC's stable security-invoker/session checks and adds no grants, RLS, or storage changes. The app hides catalog search until the new columns are present, and its legacy query path remains usable before that migration. The SQL has not been applied to any database in this preparation.

## Validation

Run `npm run test:paint-guide-color-catalog` and `npx tsc -p tsconfig.app.json --noEmit` from this isolated candidate. The focused tests cover supported brands, brand-scoped name/code queries, duplicates, malformed/cross-brand result filtering, selection mapping without overwriting the applied product or verified swatch, empty results, rate limiting, malformed JSON, network failure, timeout, and cancellation.
