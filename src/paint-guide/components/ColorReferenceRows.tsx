import type { HomeownerPaintRecord } from "../presentation/types.js";
import type { approximateCatalogSwatchForRecord } from "../presentation/homeowner-features.js";

export type ApproximateCatalogReference = NonNullable<ReturnType<typeof approximateCatalogSwatchForRecord>>;

export function ColorReferenceRows({
  record,
  reference,
  showMissingColorCode = false,
}: {
  record: Pick<HomeownerPaintRecord, "brand" | "color_code">;
  reference: ApproximateCatalogReference | null;
  showMissingColorCode?: boolean;
}) {
  return <>
    <div>
      <dt>Coating manufacturer</dt>
      <dd>{record.brand || "Not recorded"}</dd>
    </div>
    {reference ? <div>
      <dt>Color reference brand</dt>
      <dd>{reference.brand}</dd>
    </div> : null}
    {reference || record.color_code || showMissingColorCode ? <div>
      <dt>{reference ? "Color reference code" : "Color code"}</dt>
      <dd>{record.color_code || "Not recorded"}</dd>
    </div> : null}
  </>;
}
