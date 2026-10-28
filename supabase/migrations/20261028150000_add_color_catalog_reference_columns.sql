-- Stage A: add nullable color-reference columns only.
-- This stage leaves homeowner_document_read unchanged so the currently deployed
-- strict response parser remains compatible while catalog writes are verified.
begin;

alter table public.paint_records
  add column if not exists color_origin_brand text,
  add column if not exists color_reference_hex text,
  add column if not exists color_reference_provider text,
  add column if not exists color_reference_id text,
  add column if not exists color_reference_url text,
  add column if not exists color_reference_retrieved_at timestamptz;

alter table public.paint_records
  add constraint paint_records_color_reference_hex_format
  check (color_reference_hex is null or color_reference_hex ~ '^#[0-9A-Fa-f]{6}$')
  not valid;

alter table public.paint_records
  validate constraint paint_records_color_reference_hex_format;

alter table public.paint_records
  add constraint paint_records_color_reference_complete
  check (
    (color_origin_brand is null and color_reference_hex is null and color_reference_provider is null and color_reference_id is null and color_reference_url is null and color_reference_retrieved_at is null)
    or
    (color_origin_brand is not null
      and color_reference_hex is not null
      and color_reference_provider is not null
      and color_reference_id is not null
      and color_reference_url is not null
      and color_reference_retrieved_at is not null
      and color_origin_brand in ('Sherwin-Williams', 'Benjamin Moore', 'Farrow & Ball')
      and color_reference_hex ~ '^#[0-9A-Fa-f]{6}$'
      and color_reference_provider = 'PaintDB'
      and nullif(btrim(color_reference_id), '') is not null
      and color_reference_url ~ '^https://paintdb[.]com/colors/[^[:space:]]+$'
      and color_reference_retrieved_at is not null)
  ) not valid;

alter table public.paint_records
  validate constraint paint_records_color_reference_complete;

commit;
